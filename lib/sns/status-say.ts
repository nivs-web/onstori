import { ERROR_SAY, PROVIDER_NAME, type ErrorKind, type SnsProvider } from "./types";

/**
 * 「이 영상이 그 SNS 에서 지금 어디까지 갔나」를 **사장님 말**로 바꾼다. (2026-09-12 지시 D1·D4)
 *
 * ★★★ **영어를 화면에 한 글자도 내보내지 않는다.**
 *   표에 들어 있는 값은 `queued` · `uploading` · `processing` · `published` · `failed` 이고,
 *   실패 이유는 `TRANSIENT` · `AUTH_EXPIRED` · `REJECTED` · `QUOTA_EXCEEDED` 다.
 *   이 글자가 화면에 뜨면 사장님은 **아무것도 알 수 없고**, 그 순간 우리에게 전화한다.
 *   그래서 번역을 **한 곳**에 두고, 화면은 여기서 나온 문장만 쓴다.
 *
 * ★ 상무님 설계서 §1-2 의 번역표를 그대로 옮겼다. 설계가 특히 강조한 넷:
 *   ① `processing` 을 따로 보여 주지 않는다 — 사장님에게 「올리는 중」과 다를 바 없다
 *   ② 「내일 올라갑니다」·「다시 해보는 중」은 **화면이 파생**한다. DB 에 상태를 더하지 않는다
 *   ③ 영어를 절대 노출하지 않는다
 *   ④ ★ **「안 올림」과 「안 됨」을 구분한다.** 기록이 아예 없으면 **줄을 그리지 않는다** —
 *      회색으로 「안 올림」이라 쓰면 그것이 실패처럼 읽힌다.
 */

/** 자동 재시도 횟수 — 이 숫자를 넘으면 사람이 [다시 시도]를 눌러야 한다 */
export const AUTO_RETRIES = 3;

export type PostState = {
  provider: string;
  /** DB 의 상태 글자. 모르는 값이 와도 안전하게 다룬다 */
  status?: string | null;
  errorKind?: string | null;
  attempts?: number | null;
  url?: string | null;
  /** 그쪽에서 지워진 것을 **확인한** 시각. null 은 「살아 있다」가 아니라 「확인 못 했다」 */
  deletedAt?: string | null;
};

export type Said = {
  /** 화면에 그대로 찍을 한 줄. **여기에 영어가 있으면 버그다** */
  text: string;
  /** 「좋다 / 기다린다 / 나쁘다」 — 화면이 색을 고를 때 쓴다 */
  tone: "good" | "wait" | "bad";
  /** 사장님이 눌러야 할 것이 있으면 그 **버튼 이름**. 화면의 버튼 글자와 **글자까지** 같아야 한다 */
  action?: "다시 시도" | "다시 연결하기" | "문의하기" | "보기";
};

export function providerName(p: string): string {
  return PROVIDER_NAME[p as SnsProvider] ?? p;
}

/**
 * 받침에 맞는 조사를 고른다 — 「인스타그램 릴스**가**」 · 「틱톡**이**」.
 *
 * ⚠ 왜 필요한가: 이름을 문장에 끼우면 조사가 따라 달라진다. 한쪽으로 박아 두면
 *   화면의 절반이 어색한 한국어가 된다("틱톡가 이 영상을 받지 않았어요").
 * ⚠ 한글이 아닌 글자로 끝나면(X 같은 이름) **받침 없음**으로 본다 — 「X가」가 자연스럽다.
 */
export function josa(word: string, pair: "이/가" | "은/는" | "을/를"): string {
  const last = (word ?? "").trim().slice(-1);
  const code = last.charCodeAt(0);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  const hasFinal = hangul && (code - 0xac00) % 28 !== 0;
  const [withFinal, without] = pair.split("/");
  return hasFinal ? withFinal : without;
}

/**
 * 한 줄을 사장님 말로.
 *
 * ⚠ `null` 을 돌려주면 **그 줄을 그리지 말라**는 뜻이다(위 ④).
 */
export function sayPost(p: PostState): Said | null {
  const status = (p.status ?? "").toLowerCase();

  /* 기록이 없거나 취소된 것 — 줄 자체를 안 그린다 */
  if (!status || status === "canceled") return null;

  if (status === "published") {
    /* ★ 「지워졌다」는 **확인된 것만** 말한다. 확인 못 한 것은 아무 말도 하지 않는다 */
    if (p.deletedAt) return { tone: "wait", text: "올렸는데, 지금은 그쪽에서 지워졌어요" };
    return { tone: "good", text: "올라갔어요", action: p.url ? "보기" : undefined };
  }

  /* ★ processing 과 uploading 을 **합친다.** 사장님에게 둘의 차이는 없다 */
  if (status === "uploading" || status === "processing") return { tone: "wait", text: "올리는 중…" };

  if (status === "queued") return { tone: "wait", text: "순서를 기다리고 있어요" };

  if (status === "failed") {
    const kind = (p.errorKind ?? "") as ErrorKind;
    if (kind === "AUTH_EXPIRED") return { tone: "bad", text: "연결이 풀렸어요", action: "다시 연결하기" };
    if (kind === "QUOTA_EXCEEDED") return { tone: "wait", text: "오늘 자리가 차서 내일 올라갑니다" };
    if (kind === "REJECTED") {
      const name = providerName(p.provider);
      return { tone: "bad", text: `${name}${josa(name, "이/가")} 이 영상을 받지 않았어요`, action: "문의하기" };
    }
    /* TRANSIENT 와 «모르는 값»은 같이 다룬다 — 모르면 「잠깐 그런 것」으로 본다 */
    const tries = p.attempts ?? 0;
    if (tries < AUTO_RETRIES) return { tone: "wait", text: `다시 해보는 중 (${Math.max(1, tries)}/${AUTO_RETRIES})` };
    return { tone: "bad", text: "안 올라갔어요", action: "다시 시도" };
  }

  /* ⚠ 모르는 상태 글자가 왔다. **그 글자를 그대로 보여 주지 않는다** — 영어가 샌다 */
  return { tone: "wait", text: "확인 중이에요" };
}

/** 실패 이유 네 개의 «긴 설명» — 필요하면 접어서 보여 준다. 영어는 여기에도 없다 */
export const WHY_LONG: Record<ErrorKind, string> = ERROR_SAY;
