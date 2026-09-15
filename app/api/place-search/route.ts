import { NextResponse } from "next/server";
import { guessSubIndustry } from "@/config/industry-picker";

/**
 * 온보딩 1단계 — "네이버 플레이스에서 불러오기" (기획1 /mainplan #onboarding).
 * 네이버 지역검색(NAVER API HUB) + 카카오 로컬 API(keyword) 로 후보를 찾아 이름·업종·주소·전화를 프리필한다.
 * 영업시간·사진·소개는 두 API 어디에도 없다 → 사장님 입력. m.place.naver.com 크롤링은 하지 않는다(법적 위험 중~고).
 * 키가 없는 채널은 건너뛰고, 둘 다 없으면 available:false — 위저드는 버튼을 숨긴다.
 *
 * ⚠ 검색 API는 2026-07-30 개발자센터 신규 신청이 닫히고 NAVER API HUB(네이버클라우드)로 이관됐다.
 *   구 openapi.naver.com 은 유예 사용자 전용이라 HUB 키로 부르면 401(errorCode 024)만 돌아온다.
 *   응답 JSON 스키마는 구·신이 같아 아래 파싱은 그대로 쓴다 (2026-09-05 실호출 200 확인).
 *
 * env: NAVER_CLIENT_ID / NAVER_CLIENT_SECRET (네이버 클라우드 플랫폼 → NAVER API HUB) · KAKAO_REST_API_KEY(카카오 로그인과 같은 키)
 */

export type PlaceCandidate = {
  source: "naver" | "kakao";
  name: string;
  category: string;
  address: string;
  roadAddress: string;
  phone: string;
  subIndustry?: string;
  link?: string;
};

const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();

async function naver(q: string): Promise<PlaceCandidate[]> {
  const id = process.env.NAVER_CLIENT_ID?.trim();
  const secret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (!id || !secret) return [];
  const r = await fetch(`https://naverapihub.apigw.ntruss.com/search/v1/local?query=${encodeURIComponent(q)}&display=5&sort=random`, {
    headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": secret },
    cache: "no-store",
  });
  if (!r.ok) return [];
  const d = (await r.json()) as { items?: { title: string; category: string; address: string; roadAddress: string; telephone: string; link: string }[] };
  return (d.items ?? []).map((it) => ({
    source: "naver" as const,
    name: strip(it.title),
    category: it.category ?? "",
    address: it.address ?? "",
    roadAddress: it.roadAddress ?? "",
    phone: it.telephone ?? "",
    link: it.link || undefined,
    subIndustry: guessSubIndustry(it.category ?? "")?.label,
  }));
}

async function kakao(q: string): Promise<PlaceCandidate[]> {
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (!key) return [];
  const r = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=5`, {
    headers: { Authorization: `KakaoAK ${key}` },
    cache: "no-store",
  });
  if (!r.ok) return [];
  const d = (await r.json()) as { documents?: { place_name: string; category_name: string; address_name: string; road_address_name: string; phone: string; place_url: string }[] };
  return (d.documents ?? []).map((it) => ({
    source: "kakao" as const,
    name: it.place_name,
    category: it.category_name ?? "",
    address: it.address_name ?? "",
    roadAddress: it.road_address_name ?? "",
    phone: it.phone ?? "",
    link: it.place_url || undefined,
    subIndustry: guessSubIndustry(it.category_name ?? "")?.label,
  }));
}

function placeSearchAvailable(): boolean {
  return !!((process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) || process.env.KAKAO_REST_API_KEY);
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 60) ?? "";
  if (!placeSearchAvailable()) return NextResponse.json({ available: false, items: [] });
  if (q.length < 2) return NextResponse.json({ available: true, items: [] });
  try {
    const [n, k] = await Promise.all([naver(q).catch(() => []), kakao(q).catch(() => [])]);
    // 같은 이름+주소는 하나로 — 네이버가 먼저, 전화는 있는 쪽을 취한다
    const seen = new Map<string, PlaceCandidate>();
    for (const c of [...n, ...k]) {
      const key = (c.name + "|" + (c.roadAddress || c.address)).replace(/\s/g, "");
      const prev = seen.get(key);
      if (!prev) seen.set(key, c);
      else {
        /* ★ 2026-09-15 — **없는 칸만 채워 넣는다.** 전에는 전화만 합쳤다.
           네이버는 전화가 비는 일이 잦고(실제로 「바른전기」가 그랬다) 카카오는 대개 갖고 있다.
           주소·홈페이지도 한쪽에만 있는 일이 있어 같은 방식으로 메운다.
           ⚠ **덮어쓰지 않는다.** 네이버 값이 있으면 그것을 남긴다 — 먼저 온 쪽이 더 정확했다. */
        if (!prev.phone && c.phone) prev.phone = c.phone;
        if (!prev.roadAddress && c.roadAddress) prev.roadAddress = c.roadAddress;
        if (!prev.address && c.address) prev.address = c.address;
        if (!prev.link && c.link) prev.link = c.link;
        if (!prev.subIndustry && c.subIndustry) prev.subIndustry = c.subIndustry;
      }
    }
    return NextResponse.json({ available: true, items: [...seen.values()].slice(0, 6) });
  } catch (e) {
    console.error(JSON.stringify({ evt: "place_search_fail", err: String(e).slice(0, 200) }));
    return NextResponse.json({ available: true, items: [] });
  }
}
