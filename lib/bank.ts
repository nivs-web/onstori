import { sbAdmin } from "./db-admin";
import { placeholderFor } from "@/config/placeholder-images";

/**
 * 이미지 뱅크 매칭 — 승인(quality_ok) 이미지 중 점수 높고 덜 쓰인 것 우선.
 * 후보 상위권에서 랜덤(사이트 판박이 방지) + used_count 증가. 뱅크가 비면 플레이스홀더 폴백.
 */
export async function pickImage(industry: string, mood: string, role: "hero" | "gallery" | "about" | "process"): Promise<string> {
  try {
    const sb = sbAdmin();
    const { data } = await sb
      .from("image_bank")
      .select("id, url")
      .eq("industry", industry)
      .eq("mood", mood)
      .eq("role", role)
      .eq("quality_ok", true)
      .eq("deleted", false)
      .order("quality_score", { ascending: false })
      .order("used_count", { ascending: true })
      .limit(5);
    if (data && data.length > 0) {
      const chosen = data[Math.floor(Math.random() * data.length)];
      await sb.rpc("bump_bank_used", { bank_id: chosen.id }).then(
        () => {},
        () => {}, // 카운터는 best-effort — 실패해도 이미지 선택은 진행
      );
      return chosen.url;
    }
  } catch { /* 폴백으로 */ }
  const ph = placeholderFor(industry);
  return role === "hero" ? ph.hero : ph.gallery[0] ?? ph.hero;
}
