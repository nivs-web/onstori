import { cache } from "react";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import {
  DEFAULTS, FONTS, MODES, STYLES, canPickFont,
  type DesignSetting, type FontId, type ModeId, type StyleId,
} from "@/config/design";
import { sbAdmin } from "@/lib/db-admin";

/**
 * 디자인 설정 3벌을 **읽고 쓴다** (2026-09-09, S2).
 *
 * ★★ **서버 전용 파일이다.** `sbAdmin()` 을 부르므로 서비스 롤 키를 만진다.
 *     `"use client"` 파일에서 import 하면 **키가 손님 브라우저 번들에 실린다.**
 *     이 저장소에는 `server-only` 패키지가 없어서 컴파일러가 못 막는다 — 사람이 지켜야 한다.
 *     화면(클라이언트)에는 값을 **prop 으로 내려라.**
 *
 * ★ 계약 하나: **읽기 함수는 절대 던지지 않는다.**
 *   표가 없든·네트워크가 끊기든·키가 없든·저장된 값이 깨졌든 `DEFAULTS` 로 떨어진다.
 *   기본값 = 지금 화면이고 `themeVars()` 가 0바이트를 내므로 화면이 글자 하나 달라지지 않는다.
 *   ⚠ 루트 레이아웃에서 던지면 **사이트 전체가 500** 이다.
 *
 * ⚠ `lib/schema.ts` 에 넣지 않았다. 그 파일은 「섹션 스키마」이고 건드리면
 *   불변 규칙 2(한 커밋에서 4곳 동시 수정)에 걸린다. 디자인 설정은 섹션 스키마가 아니다.
 */

export type StoredTarget = "site" | "admin" | "editor";

/** app_settings 의 key. 화면 이름과 1:1 */
export const KEY: Record<StoredTarget, string> = {
  site: "design:site",
  admin: "design:admin",
  editor: "design:editor",
};

const STORED: StoredTarget[] = ["site", "admin", "editor"];
export const isStoredTarget = (v: unknown): v is StoredTarget =>
  typeof v === "string" && (STORED as string[]).includes(v);

/* ─────────────────────────── 검증 ─────────────────────────── */

/**
 * 들어오는 값의 형태. **목록은 `config/design.ts` 에서 끌어온다** —
 * 스타일을 15개로 늘려도 여기를 고칠 일이 없다.
 * ⚠ `.default()` 를 쓰지 않는다. 저장은 세 값을 다 명시받는다. 기본값은 읽기 쪽 몫이다.
 */
export const DesignSettingIn = z.object({
  style: z.enum(STYLES.map((s) => s.id) as [StyleId, ...StyleId[]]),
  mode: z.enum(MODES.map((m) => m.id) as [ModeId, ...ModeId[]]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "색은 #RRGGBB 여야 해요"),
  font: z.enum(FONTS.map((f) => f.id) as [FontId, ...FontId[]]).optional(),
});

/**
 * 서체를 고를 수 없는 화면이 서체를 보내면 **버린다** (불변 규칙 4 — 클라이언트를 믿지 않는다).
 *
 * ⚠ 400 으로 거절하지 않는다. 화면이 실수로 보내도 저장은 성공해야 하고,
 *   값을 안 쓰는 것으로 충분하다. 거절하면 사장님 화면만 저장이 안 되는 사고가 난다.
 */
export function sanitize(target: StoredTarget, v: z.infer<typeof DesignSettingIn>): DesignSetting {
  const { style, mode, color, font } = v;
  return canPickFont(target) && font ? { style, mode, color, font } : { style, mode, color };
}

/* ─────────────────────────── 읽기 ─────────────────────────── */

type All = Record<StoredTarget, DesignSetting>;
const fallback = (): All => ({ site: DEFAULTS.site, admin: DEFAULTS.admin, editor: DEFAULTS.editor });

/** ⚠ 여기서는 **던진다.** 실패가 캐시에 굳으면 안 되기 때문이다(아래 주석 참고). */
async function fetchAll(): Promise<All> {
  const { data, error } = await sbAdmin()
    .from("app_settings")
    .select("key, value")
    .in("key", Object.values(KEY));
  if (error) throw new Error(error.message);

  const out = fallback();
  for (const row of data ?? []) {
    const t = STORED.find((k) => KEY[k] === row.key);
    if (!t) continue;
    const p = DesignSettingIn.safeParse(row.value);
    // 저장된 옛 줄에 font 가 남아 있어도 여기서 다시 버린다
    if (p.success) out[t] = sanitize(t, p.data);
  }
  return out;
}

/**
 * ⚠ `cache()` 는 **한 번 그리는 동안**만 중복을 없앤다(루트 레이아웃과 화면이 같이 부를 때).
 *   요청과 요청 사이에 값을 남기는 것은 `unstable_cache` 뿐이다. 그래서 둘 다 쓴다.
 *   Supabase 요청은 인증 헤더를 달고 나가서 Next 의 기본 fetch 캐시에는 애초에 안 담긴다.
 *
 * ⚠ try/catch 가 `unstable_cache` **바깥**인 것이 중요하다.
 *   안에서 삼키면 DB 가 잠깐 흔들렸을 때 기본값이 한 시간 동안 굳는다.
 */
const cachedAll = unstable_cache(fetchAll, ["design-settings-v1"], { revalidate: 3600, tags: ["design"] });

export const readDesignAll = cache(async (): Promise<All> => {
  try {
    return await cachedAll();
  } catch (e) {
    /* 표가 아직 없을 수 있다(db push 전). 그건 사고가 아니라 예정된 상태다.
       빌드 로그에 한 줄만 남기고 기본값으로 간다 — 조용히 넘어가면 나중에 원인을 못 찾는다. */
    if (process.env.NODE_ENV !== "production") {
      console.warn("[design] 설정을 못 읽어 기본값으로 갑니다:", e instanceof Error ? e.message.slice(0, 120) : e);
    }
    return fallback();
  }
});

export async function readDesign(target: StoredTarget): Promise<DesignSetting> {
  return (await readDesignAll())[target];
}
