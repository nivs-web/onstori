/**
 * 토스 심사 전용 «무료체험» 샘플 사이트 만들기 — 권반장 지시 [22] (2026-09-17).
 *
 * ★★ **왜 필요한가:** 토스 심사관이 심사용 계정으로 [결제하기] 를 누르면 지금은
 *   「이미 정회원이에요」가 뜹니다 — 심사용 사이트(`sample-interior`)가 `active` 라서입니다
 *   (`app/api/billing/checkout/route.ts:22`). **결제 과정을 끝까지 못 보면 반려**입니다.
 *   ⇒ **무료체험(`trial`) 상태인 사이트를 하나 더** 만들어 그쪽으로 보냅니다.
 *
 * ⚠ **`sample-interior` 는 한 글자도 안 건드립니다.** 그것을 `trial` 로 내리면
 *   `lib/indexable.ts` 가 `active` 를 요구해 **검색에서 빠지고**, 유튜브·인스타 심사 화면도 달라집니다.
 *
 * 실행: npx tsx --env-file=.env.local scripts/make-toss-sample.ts [--force]
 *   · 이미 있으면 **아무것도 안 합니다**(`--force` 면 내용만 다시 덮어씁니다).
 *   · 🔴 **지우지 않습니다.** 필요 없어지면 `status` 를 `suspended` 로 내리십시오(불변 규칙 10).
 */
import { sbAdmin } from "@/lib/db-admin";
import { TRIAL_DAYS } from "@/lib/trial";
import { recomputeScore } from "@/lib/score";

const FROM = "sample-interior";
const TO = "sample-toss";
/** 🔴 둘이 헷갈리지 않게 상호를 다르게 둡니다(권반장 지시). 「예시」 표시는 그대로 답니다 */
const NEW_NAME = "하남 종합인테리어 (토스 심사용 예시)";
const OLD_NAME = "다산 리모델링 (샘플사이트)";

const force = process.argv.includes("--force");

/** 문서 안에 박힌 옛 상호를 새 상호로 바꾼다 — 화면 어디에도 옛 이름이 남지 않게 */
function rename<T>(doc: T): T {
  const s = JSON.stringify(doc)
    .split(OLD_NAME).join(NEW_NAME)
    .split("다산 리모델링").join("하남 종합인테리어")
    /* ⚠ 지명도 함께 바꾼다. 상호만 「하남」으로 바꾸고 본문에 「남양주」가 남으면
       **한 화면 안에서 두 지역이 싸운다** — 심사관이 보면 지어낸 티가 난다(2026-09-17 실측으로 잡음). */
    .split("남양주시").join("하남시")
    .split("남양주").join("하남")
    .split("다산").join("하남");
  return JSON.parse(s) as T;
}

async function main() {
  const sb = sbAdmin();

  const { data: src, error } = await sb.from("sites").select("*").eq("slug", FROM).maybeSingle();
  if (error || !src) { console.log("🔴 원본을 못 찾았습니다:", error?.message ?? "없음"); return; }

  const { data: exists } = await sb.from("sites").select("id, status").eq("slug", TO).maybeSingle();
  if (exists && !force) {
    console.log(`이미 있습니다 — ${TO} (${exists.status}). 내용을 다시 덮으려면 --force`);
    return;
  }

  /* 무료 기간 — 🔴 **정상 30일**(lib/trial.ts). 원본처럼 2099년으로 두면 화면에
     「무료 기간이 9999일 남았어요」가 찍혀 심사관이 걸고 넘어집니다(권반장 지시). */
  const endsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();

  const settings = { ...((src.settings as Record<string, unknown>) ?? {}) };
  /* 🔴 문자·알림을 전부 끕니다. 심사용 껍데기에서 손님에게 아무것도 나가면 안 됩니다 */
  settings.weekly = { on: false, hour: 10, channel: "email", weekday: 2 };
  settings.notify = { email: "", phone: "" };
  delete settings.shots;          // 첫 페이지 카드용 스크린샷 — 이 사이트에는 필요 없다
  delete settings.pending_order;  // 원본에 남아 있을 수 있는 결제 시도 흔적

  const row = {
    slug: TO,
    business_name: NEW_NAME,
    industry: src.industry,
    category: src.category,
    template: src.template,
    cta_type: src.cta_type,
    inferred: src.inferred ?? {},
    mood: src.mood,
    theme: src.theme ?? {},
    /* 🔴 여기가 이 사이트의 «존재 이유»입니다 — trial 이라야 결제창이 열립니다 */
    status: "trial",
    trial_ends_at: endsAt,
    plan: null,
    paid_at: null,
    payment: null,
    /* 심사 계정이 두 사이트를 다 갖게 — 로그인 한 번으로 둘 다 보입니다(권반장 지시) */
    owner_id: src.owner_id,
    anon_id: null,
    settings,
    draft: rename(src.draft),
    published: rename(src.published),
    published_at: new Date().toISOString(),
    hero_movie: null,
  };

  if (exists) {
    const { error: e } = await sb.from("sites").update(row).eq("id", exists.id);
    if (e) { console.log("🔴 덮어쓰기 실패:", e.message); return; }
    console.log("덮어썼습니다:", TO);
  } else {
    const { error: e } = await sb.from("sites").insert(row);
    if (e) { console.log("🔴 만들기 실패:", e.message); return; }
    console.log("만들었습니다:", TO);
  }

  const { data: made } = await sb.from("sites").select("id, status, trial_ends_at").eq("slug", TO).single();
  await sb.from("site_progress").upsert(
    { site_id: made!.id, funnel: { created_at: new Date().toISOString() } },
    { onConflict: "site_id" },
  );
  const score = await recomputeScore(made!.id as string);

  const days = Math.ceil((new Date(made!.trial_ends_at as string).getTime() - Date.now()) / 86_400_000);
  console.log("── 확인 ──");
  console.log("  주소      : https://onstori.com/" + TO);
  console.log("  상태      :", made!.status, "← 🔴 trial 이라야 결제창이 열립니다");
  console.log("  무료 남은일:", days, "일  (9999 가 아니라 정상값)");
  console.log("  완성도    :", score?.score, "점");
  console.log("  문자·알림 : 껐습니다 (weekly.on=false · notify 비움)");
}

void main();
