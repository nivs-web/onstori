import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { readGateValue, canUpload } from "@/lib/sns/youtube-gate";

export const dynamic = "force-dynamic";

/**
 * 유튜브 문 — 운영자만 돌리는 손잡이. (2026-09-11 · **2026-09-12 상무님 지적으로 다시 씀**)
 *
 * ★★★ **이 손잡이는 되돌릴 수 없는 일을 연다.**
 *   감사(audit) 통과 «전»에 올린 영상은 유튜브가 비공개로 잠그고,
 *   **그 잠김은 항소할 수 없다.** 나중에 감사를 통과해도 이미 잠긴 것은 안 풀린다.
 *   그래서 여기서 하는 일은 「켜고 끄기」가 아니라 **「사장님 영상을 죽일 권한을 주는 것」**이다.
 *
 * ★ 표를 새로 만들지 않는다 — `app_settings` 의 key='sns:youtube' 한 줄이다.
 *   **줄이 없으면 닫힘**으로 읽는다(lib/sns/youtube-gate.ts 의 readGateValue).
 *
 * | mode     | 누가 올리나 | 어떻게 올라가나 |
 * |---|---|---|
 * | `off`    | 아무도 | — |
 * | `review` | **허용 목록(allowSites)에 있는 사이트만** | 비공개 |
 * | `on`     | 모두 — 단 **감사 통과 표시(auditPassed)가 있어야** | 공개 |
 *
 * ⚠ `on` 인데 `auditPassed` 가 꺼져 있으면 **아무도 못 올린다.** 조용히 공개로 밀지 않는다 —
 *   그렇게 밀면 그날 올라간 영상이 전부 죽는다.
 */
const Input = z.object({
  mode: z.enum(["off", "review", "on"]),
  /** 준비 기간에 올릴 수 있는 사이트들. 사이트 주소(slug)로 적고 서버가 id 로 바꾼다 */
  allowSlugs: z.array(z.string().max(40)).max(20).optional(),
  /** ★ 구글에서 «통과» 통보를 받은 뒤에만 켠다 */
  auditPassed: z.boolean().optional(),
});

async function loadGate() {
  const { data } = await sbAdmin().from("app_settings").select("value").eq("key", "sns:youtube").maybeSingle();
  return readGateValue((data as { value?: unknown } | null)?.value);
}

/** 허용 목록은 **id 로 저장**한다(slug 는 바뀔 수 있다). 화면에는 slug 로 보여 준다 */
async function slugsOf(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await sbAdmin().from("sites").select("id, slug").in("id", ids);
  return Object.fromEntries(((data ?? []) as { id: string; slug: string }[]).map((s) => [s.id, s.slug]));
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  const gate = await loadGate();
  const names = await slugsOf(gate.allowSites);
  /* ★ 「지금 이 설정이면 실제로 어떻게 되나」를 **서버가 계산해서** 함께 준다 —
     화면이 다시 판정하면 두 벌이 생기고, 언젠가 한쪽만 고쳐진다. */
  const sample = gate.allowSites[0] ?? "";
  return NextResponse.json({
    mode: gate.mode,
    auditPassed: gate.auditPassed,
    allowSlugs: gate.allowSites.map((id) => names[id] ?? id),
    /** 허용 목록에 든 사이트가 지금 올릴 수 있나 */
    effectAllowed: sample ? canUpload(gate, sample) : null,
    /** 그 밖의 사장님이 지금 올릴 수 있나 */
    effectOthers: canUpload(gate, "다른-사이트"),
  });
}

export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "값이 이상해요" }, { status: 400 });
  const v = parsed.data;

  const before = await loadGate();

  /* slug → id. 없는 주소는 **조용히 버리지 않고** 무엇이 없었는지 알려 준다 */
  let allowSites = before.allowSites;
  let unknown: string[] = [];
  if (v.allowSlugs) {
    const slugs = v.allowSlugs.map((s) => s.trim().toLowerCase()).filter(Boolean);
    const { data } = await sbAdmin().from("sites").select("id, slug").in("slug", slugs);
    const found = (data ?? []) as { id: string; slug: string }[];
    allowSites = found.map((s) => s.id);
    unknown = slugs.filter((s) => !found.some((f) => f.slug === s));
  }

  const next = {
    mode: v.mode,
    allowSites,
    auditPassed: v.auditPassed ?? before.auditPassed,
  };

  const { error } = await sbAdmin().from("app_settings").upsert({
    key: "sns:youtube", value: next, updated_at: new Date().toISOString(),
  }, { onConflict: "key" });

  if (error) {
    /* app_settings 표가 아직 없을 수 있다 — db push 전. 무엇을 해야 하는지 말한다 */
    const missing = /relation .*app_settings.* does not exist|42P01|could not find the table/i.test(error.message);
    return NextResponse.json({
      error: missing
        ? "app_settings 표가 아직 없어요. `npx supabase db push` 를 한 번 돌려야 저장됩니다."
        : "저장하지 못했어요.",
    }, { status: 500 });
  }

  /* ★ 되돌릴 수 없는 문을 여는 일이라 **무엇이 바뀌었는지 통째로** 남긴다 */
  console.log(JSON.stringify({
    evt: "sns_youtube_gate",
    from: { mode: before.mode, audit: before.auditPassed, allow: before.allowSites.length },
    to: { mode: next.mode, audit: next.auditPassed, allow: next.allowSites.length },
  }));

  const gate = readGateValue(next);
  const names = await slugsOf(gate.allowSites);
  return NextResponse.json({
    mode: gate.mode,
    auditPassed: gate.auditPassed,
    allowSlugs: gate.allowSites.map((id) => names[id] ?? id),
    unknown,
    effectAllowed: gate.allowSites[0] ? canUpload(gate, gate.allowSites[0]) : null,
    effectOthers: canUpload(gate, "다른-사이트"),
  });
}
