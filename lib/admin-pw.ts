import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { sbAdmin } from "./db-admin";

/**
 * ★★★ **어드민 «아이디 + 비밀번호».** (2026-09-17 지시 [34])
 *
 * ★ 대표님: 「**키 입력이 불편해.** 아이디랑 비밀번호로 들어가게 해 줘.」
 *   「**첫 로그인할 때 즉시 내가 스스로 바꿀게.**」
 *
 * ★★ **왜 «환경변수»가 아니라 «저장소»에 두는가 — 세 가지 때문입니다.**
 *   ① 🔴 **제가 비밀번호를 볼 일이 없습니다.** 대표님이 화면에서 직접 정하십니다.
 *      불변 규칙 6(키는 코드·문서에 안 쓴다)을 **구조로** 지킵니다.
 *   ② 🔴 **대표님이 «스스로» 바꾸실 수 있습니다.** 환경변수면 Vercel 화면에 들어가
 *      다시 배포해야 합니다 — 「첫 로그인할 때 즉시 바꿀게」가 불가능해집니다.
 *   ③ **마이그레이션이 필요 없습니다.** 이미 있는 `admin_notes`(id·body 두 칸)를 씁니다 —
 *      `lib/admin-config.ts` 가 쓰는 것과 **같은 표, 다른 id** 입니다.
 *
 * 🔴🔴 **대표님 제안(「`review@onstori.com` 비번이랑 똑같은 걸로」)은 «그대로 하지 않았습니다».**
 *   그 비밀번호는 **토스·유튜브·메타 심사관에게 우리가 직접 알려 주는 값**입니다.
 *   어드민이 그 값을 받아 주면 **심사관이 `/admin` 에 들어올 수 있습니다** — 회원 명부·결제·
 *   문자 발송이 다 거기 있습니다. 「곧 바꿀 거니까 괜찮다」로 넘기기엔 **바꾸시기 «전»까지**가
 *   위험합니다. ⇒ 대신 **대표님이 화면에서 직접 정하는 길**을 만들었습니다. 한 번이면 끝납니다.
 *
 * ★ **비밀번호를 그대로 저장하지 않습니다.** `scrypt` 로 «되돌릴 수 없게» 바꿔 둡니다 —
 *   저장소를 통째로 가져가도 비밀번호는 안 나옵니다.
 * ⚠ 비교는 **시간이 일정한 방식**으로 합니다(`timingSafeEqual`). 한 글자씩 비교하면
 *   응답 시간 차이로 비밀번호를 한 글자씩 알아낼 수 있습니다.
 */

const scryptAsync = promisify(scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

/** 저장하는 모양. 🔴 «비밀번호 자체»는 어디에도 없다 */
type Stored = { id: string; salt: string; hash: string; at: string };

const ROW = "admin_pw";
/** 비밀번호 최소 길이 — 손님 로그인과 **같은 값**이다(`app/login/ui.tsx` 의 `PW_MIN`) */
export const ADMIN_PW_MIN = 8;

async function read(): Promise<Stored | null> {
  try {
    const { data } = await sbAdmin().from("admin_notes").select("body").eq("id", ROW).maybeSingle();
    if (!data?.body) return null;
    const v = JSON.parse(data.body as string) as Partial<Stored>;
    if (!v.id || !v.salt || !v.hash) return null;
    return v as Stored;
  } catch {
    /* 표가 없거나 못 읽으면 «아직 안 만든 것»으로 본다 — 열쇠로 들어가는 길이 살아 있다 */
    return null;
  }
}

/** 아이디·비밀번호가 이미 만들어져 있나 (값은 안 돌려준다) */
export async function adminPwState(): Promise<{ ready: boolean; id: string | null; at: string | null }> {
  const v = await read();
  return { ready: !!v, id: v?.id ?? null, at: v?.at ?? null };
}

/**
 * 맞는지 본다. 🔴 **아이디가 틀렸는지 비밀번호가 틀렸는지 알려 주지 않는다** —
 * 그 차이를 알려 주면 아이디를 하나씩 맞혀 볼 수 있다.
 */
export async function verifyAdminPw(id: string, password: string): Promise<boolean> {
  const v = await read();
  if (!v) return false;
  /* 아이디가 틀려도 **해시 계산을 그대로 한다** — 안 그러면 응답 시간으로 아이디를 알아낼 수 있다 */
  const want = Buffer.from(v.hash, "hex");
  const got = await scryptAsync(password, v.salt, want.length);
  const okPw = want.length === got.length && timingSafeEqual(want, got);
  const idBuf = Buffer.from(id.trim().toLowerCase());
  const idWant = Buffer.from(v.id.toLowerCase());
  const okId = idBuf.length === idWant.length && timingSafeEqual(idBuf, idWant);
  return okId && okPw;
}

/** 새로 정한다(만들기·바꾸기 같은 길). 부르는 쪽이 **운영자인지 먼저 확인**한다 */
export async function setAdminPw(id: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const cleanId = id.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(cleanId)) {
    return { ok: false, error: "아이디는 영문·숫자로 3~40자로 지어 주세요 (한글·띄어쓰기는 안 됩니다)" };
  }
  if (password.length < ADMIN_PW_MIN) {
    return { ok: false, error: `비밀번호는 ${ADMIN_PW_MIN}자 이상으로 지어 주세요` };
  }
  /* ⚠ 열쇠(ADMIN_KEY)와 «같은 값»을 비밀번호로 쓰지 못하게 막는다 — 그러면 둘이 한 몸이 된다 */
  if (process.env.ADMIN_KEY && password === process.env.ADMIN_KEY) {
    return { ok: false, error: "지금 쓰시는 열쇠와 다른 비밀번호로 지어 주세요" };
  }
  /* 🔴 심사용 비밀번호와 같은 값도 막는다 — 그 값은 «심사관에게 알려 주는» 값이다 */
  if (process.env.REVIEW_PASSWORD && password === process.env.REVIEW_PASSWORD) {
    return { ok: false, error: "심사용 계정과 같은 비밀번호는 쓸 수 없어요. 그 비밀번호는 심사관에게 알려 드리는 값입니다." };
  }

  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 32)).toString("hex");
  const body: Stored = { id: cleanId, salt, hash, at: new Date().toISOString() };
  try {
    const { error } = await sbAdmin()
      .from("admin_notes")
      .upsert({ id: ROW, body: JSON.stringify(body), updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) {
      const missing = /admin_notes|42P01|could not find the table/i.test(error.message);
      return { ok: false, error: missing ? "설정 표가 아직 없어요. 운영에서는 있습니다." : error.message.slice(0, 160) };
    }
    /* ⚠ 비밀번호를 기록에 남기지 않는다. 「누가 언제 바꿨다」만 남긴다 */
    console.log(JSON.stringify({ evt: "admin_pw_set", id: cleanId, at: body.at }));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 160) };
  }
}
