import { NextResponse } from "next/server";
import { z } from "zod";
import { geminiJson } from "@/lib/gemini";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

/**
 * ★★★ **「하는 일 한 줄」 예시 두 개.** (2026-09-15 대표님 지시로 신설)
 *
 * ★ 대표님 말씀: 「나는 그냥 평범한 커피숍인데 **이거 입력이 너무 불편**할 수 있잖아?
 *   … **단, 네이버 플레이스로 업종이 눌려져서 들어온 업종에 한해서**, 그 업종은 어떤 일을 하는
 *   업종인지 **예시를 1, 2개 뽑아서 선택하게** 만들고 그 하단에 필수라고 써 있다면,
 *   뽑혀진 선택 항목을 누르기 때문에 더 좋을 거 같다.」
 *
 * 🔴 **왜 «플레이스로 업종이 잡힌 분»에게만 주나.**
 *   업종을 손으로 적으신 분께 예시를 주면 **우리가 모르는 가게를 지어내는 셈**이 된다.
 *   플레이스에서 온 업종은 **네이버가 확인해 준 사실**이라 그 범위 안에서만 말할 수 있다.
 *
 * ⚠ **사실을 지어내지 않는다.** 경력·수상·가격·지역을 넣지 않는다 —
 *   우리는 그 가게에 대해 «업종»밖에 모른다. 그 이상을 쓰면 표시광고법 문제가 된다.
 * ⚠ **고르지 않아도 된다.** 예시는 «시작점»이고, 사장님이 그 자리에서 고쳐 쓰신다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Out = z.object({
  examples: z.array(z.string().min(4).max(60)).min(1).max(2),
});

export async function POST(req: Request) {
  const { industryLabel, businessName } = await req.json().catch(() => ({}));
  const label = String(industryLabel ?? "").trim().slice(0, 40);
  const name = String(businessName ?? "").trim().slice(0, 40);

  /* 🔴 업종이 없으면 아무것도 안 한다 — 「손으로 적은 분」이 여기 오는 경우다 */
  if (!label) return NextResponse.json({ examples: [] });

  /* 돈이 드는 호출이다. 한 사람이 눌러 대면 그대로 비용이 된다 */
  const limit = await checkRateLimit("oneliner", clientIp(req), [
    { window: 60, max: 6, label: "1m" },
    { window: 60 * 60, max: 40, label: "1h" },
  ]);
  if (!limit.ok) return NextResponse.json({ examples: [], limited: true });

  try {
    const { data } = await geminiJson(
      `너는 한국 소상공인 홈페이지 문구를 돕는 사람이다.
아래 업종의 가게가 "무슨 일을 하는지"를 **사장님이 직접 말하듯** 한 문장으로 두 가지 써라.

업종: ${label}
${name ? `상호: ${name}` : ""}

규칙 (반드시 지켜라):
- 각 문장은 **35자 이내**. 담백하게. 과장·유행어 금지.
- 🔴 **경력·연차·수상·자격증·가격·지역을 절대 넣지 마라.** 우리는 이 가게에 대해 «업종»밖에 모른다.
  지어내면 거짓이 된다.
- "최고", "전문가", "노하우", "믿을 수 있는" 같은 자화자찬을 쓰지 마라.
- 상호를 문장에 넣지 마라. 이미 화면에 따로 있다.
- 두 문장은 서로 달라야 한다 — 하나는 «무엇을 하는지», 하나는 «어떻게 하는지».

좋은 예(카페): ["직접 볶은 원두로 커피를 내립니다", "매일 아침 빵을 구워 냅니다"]
좋은 예(전기공사): ["가정·상가 전기 공사를 합니다", "작은 수리도 직접 와서 봐 드립니다"]

JSON으로만 답하라: {"examples":["...","..."]}`,
      Out,
      { retries: 0 },
    );
    return NextResponse.json({ examples: data.examples });
  } catch (e) {
    /* ⚠ 실패해도 **가입을 막지 않는다.** 예시는 «있으면 좋은 것»이지 없으면 안 되는 것이 아니다 */
    console.warn(JSON.stringify({ evt: "oneliner_fail", label, err: String(e).slice(0, 160) }));
    return NextResponse.json({ examples: [] });
  }
}
