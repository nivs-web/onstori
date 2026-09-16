import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { pickImages, heroStock, HERO_STOCK_MIN } from "@/lib/bank";
import { buildPrompt } from "@/config/bank-prompts";
import { sendEmailRaw } from "@/lib/notify";
import { BIZ } from "@/config/company";

/**
 * [반장 지시 6] 첫 화면(히어로) 사진 «자동 교체» — 이미지뱅크에서 3장을 고르는 것뿐,
 * AI 로 새로 만들지 않는다(우리 비용 0 이 핵심). DB(image_bank)에는 손대지 않고
 * 프롬프트는 config/bank-prompts.ts 로 이번 요청에서 그 자리에서 조합한다.
 *
 * 소유자만: loadOwnedSite 로 확인(다른 /api/site/* 와 같은 패턴).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug ?? "");
  const anonId = body.anonId ? String(body.anonId) : undefined;
  // 「다시 고르기」 누적 — 이미 보여준 사진은 최대한 다시 안 보여준다 (lib/bank.ts pickImages 참고)
  const exclude: string[] = Array.isArray(body.exclude) ? body.exclude.filter((x: unknown) => typeof x === "string") : [];

  const r = await loadOwnedSite(slug, anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  // loadOwnedSite 의 select 에는 industry·mood 가 없어 따로 읽는다(그 함수는 여러 라우트가 같이 쓴다 — 이 라우트만 쓰는 칸을 더하지 않는다)
  const { data: row } = await sbAdmin().from("sites").select("industry, mood").eq("id", r.site.id).maybeSingle();
  const industry = String(row?.industry ?? "interior");
  const mood = String(row?.mood ?? "clean");

  const urls = await pickImages(industry, mood, "hero", 3, { exclude });

  // 화면에 보여줄 영어 프롬프트 — 사진과 1:1로 대응하지 않는다(뱅크에 프롬프트 칸이 없다·DB 불변).
  // 「이 업종·분위기라면 대략 이런 사진」을 보여주는 예시라 매번 새로 조합해도 괜찮다.
  // buildPrompt 는 industryId % 씬 개수 / role % 변주 개수로 알아서 순환하므로 넉넉한 난수면 충분하다
  const prompt = buildPrompt(industry, mood, "hero", Math.floor(Math.random() * 10), Math.floor(Math.random() * 10));

  // 재고 확인 — 지금 이 (업종,분위기)에 남은 hero 사진이 적으면 사장님껜 그대로 보여주되(막지 않는다),
  // 우리에게만 조용히 메일로 알린다. 재고를 채우는 건 이 작업 범위가 아니다(대표님 지시 — 조사 금지).
  try {
    const stocks = await heroStock();
    const mine = stocks.find((s) => s.industry === industry && s.mood === mood);
    const low = !mine || mine.free < HERO_STOCK_MIN || urls.length < 3;
    if (low) {
      await sendEmailRaw(
        BIZ.email,
        "[히어로 재고 부족] 이미지뱅크 보충 필요",
        [
          `업종: ${industry} / 분위기: ${mood}`,
          `사이트: ${r.site.business_name} (/${slug})`,
          `이번에 고른 사진: ${urls.length}장 (요청 3장)`,
          `남은 재고: ${mine?.free ?? 0}장 (기준 ${HERO_STOCK_MIN}장)`,
          "사장님이 「첫 화면 사진 자동 교체」를 눌렀을 때 새 사진이 부족해 같은 사진이 반복될 수 있습니다.",
        ].join("\n"),
      );
    }
  } catch (e) {
    // 재고 알림은 부가 기능이다 — 실패해도 사진 고르기 자체는 막지 않는다
    console.error(JSON.stringify({ evt: "hero_bank_stock_check_failed", err: String(e).slice(0, 200) }));
  }

  return NextResponse.json({ urls, prompt });
}
