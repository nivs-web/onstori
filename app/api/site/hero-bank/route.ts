import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { pickImages, heroStock, HERO_STOCK_MIN } from "@/lib/bank";
import { buildPrompt, hasScenesFor } from "@/config/bank-prompts";
import { sendEmailRaw } from "@/lib/notify";
import { BIZ } from "@/config/company";

/**
 * [반장 지시 6] 첫 화면(히어로) 사진 «자동 교체» — 이미지뱅크에서 3장을 고르는 것뿐,
 * AI 로 새로 만들지 않는다(우리 비용 0 이 핵심). DB(image_bank)에는 손대지 않고
 * 프롬프트는 config/bank-prompts.ts 로 이번 요청에서 그 자리에서 조합한다.
 *
 * 소유자만: loadOwnedSite 로 확인(다른 /api/site/* 와 같은 패턴).
 */

/**
 * ⚠ 재고 부족 메일 스팸 방지 (2026-09-16 리뷰 지적 E) — 「다시 고르기」를 열 번 누르면
 * 메일이 열 통 가던 문제. Do not touch(DB)를 지키려고 모듈 메모리에만 마지막 발송 시각을 쌓는다.
 * 서버 인스턴스가 새로 뜨면 초기화되지만, 그래도 메일 폭주보다는 훨씬 낫다.
 * 이 메일은 손님 문의 알림과 같은 Resend 키·쿼터를 쓴다(lib/notify.ts) — 우리가 막히면 안 된다.
 */
const lastLowStockMail = new Map<string, number>();
const LOW_STOCK_MAIL_INTERVAL_MS = 24 * 60 * 60 * 1000;

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

  /**
   * 화면에 보여줄 영어 프롬프트 — 사진과 1:1로 대응하지 않는다(뱅크에 프롬프트 칸이 없다·DB 불변).
   * 「이 업종·분위기라면 대략 이런 사진」을 보여주는 예시다.
   * ⚠ 2026-09-16 리뷰 지적 B — Math.random() 으로 뽑으면 «같은 3장을 보면서 새로고침만 해도
   *   프롬프트가 바뀌는» 거짓말이 된다. 지금 고른 사진 목록에서 결정되는 값(해시)으로 바꿔
   *   같은 사진이 떠 있는 한 프롬프트도 그대로다.
   * ⚠ 2026-09-16 리뷰 지적 D — 업종에 전용 씬이 없으면(학원·레슨·운동 등 3종) buildPrompt 가
   *   조용히 인테리어(한국 아파트) 씬으로 떨어진다. 그 상태로 보여주면 «학원인데 아파트 사진»
   *   사고가 난다. hasScenesFor 로 걸러 이 경우엔 프롬프트를 아예 비운다 — 화면(ui.tsx)이 빈
   *   프롬프트일 때 그 블록을 감춘다. 틀린 문장을 주느니 안 주는 편이 낫다.
   */
  let prompt = "";
  if (urls.length > 0 && hasScenesFor(industry)) {
    const seed = createHash("sha256").update(`${industry}|${mood}|${urls.join(",")}`).digest("hex");
    const sceneIdx = parseInt(seed.slice(0, 8), 16);
    const varIdx = parseInt(seed.slice(8, 16), 16);
    prompt = buildPrompt(industry, mood, "hero", sceneIdx, varIdx);
  }

  /**
   * 재고 확인 — 계약(반장 지시 [6])은 「같은 사진이 나오면 메일」이다.
   * ⚠ 2026-09-16 리뷰 지적 E — free 재고가 적다고 매번 보내면 「다시 고르기」를 열 번 눌러도
   *   새 사진 3장이 멀쩡히 나온 경우까지 메일이 간다. 그래서
   *   ①방금 보여줬던 사진(exclude)이 이번에도 다시 나왔거나 ②3장을 다 못 채웠을 때만 보내고,
   *   ③같은 (업종,분위기)는 하루 한 통으로 막는다(모듈 메모리 — DB 불변 유지).
   */
  try {
    const repeated = urls.filter((u) => exclude.includes(u));
    const low = repeated.length > 0 || urls.length < 3;
    if (low) {
      const key = `${industry}|${mood}`;
      const now = Date.now();
      const last = lastLowStockMail.get(key) ?? 0;
      if (now - last > LOW_STOCK_MAIL_INTERVAL_MS) {
        lastLowStockMail.set(key, now);
        const stocks = await heroStock();
        const mine = stocks.find((s) => s.industry === industry && s.mood === mood);
        await sendEmailRaw(
          BIZ.email,
          "[히어로 재고 부족] 이미지뱅크 보충 필요",
          [
            `업종: ${industry} / 분위기: ${mood}`,
            `사이트: ${r.site.business_name} (/${slug})`,
            `이번에 고른 사진: ${urls.length}장 (요청 3장) · 겹친 사진 ${repeated.length}장`,
            `남은 재고: ${mine?.free ?? 0}장 (기준 ${HERO_STOCK_MIN}장)`,
            "사장님이 「첫 화면 사진 자동 교체」를 눌렀을 때 새 사진이 부족해 같은 사진이 반복되고 있습니다.",
          ].join("\n"),
        );
      }
    }
  } catch (e) {
    // 재고 알림은 부가 기능이다 — 실패해도 사진 고르기 자체는 막지 않는다
    console.error(JSON.stringify({ evt: "hero_bank_stock_check_failed", err: String(e).slice(0, 200) }));
  }

  return NextResponse.json({ urls, prompt });
}
