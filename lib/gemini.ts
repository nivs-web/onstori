import { z } from "zod";

/**
 * Gemini 호출 헬퍼 — JSON 모드 + 모델 폴백 체인 + zod 검증.
 * 텍스트(카피·분류): gemini-3.5-flash → 2.5-flash 폴백 (flash-latest는 503 빈발로 미사용)
 */

const TEXT_MODELS = ["gemini-3.5-flash", "gemini-2.5-flash"];

export async function geminiJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  opts?: { retries?: number },
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const retries = opts?.retries ?? 1;

  let lastErr: unknown;
  for (const model of TEXT_MODELS) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
            }),
          },
        );
        if (!res.ok) { lastErr = new Error(`${model} HTTP ${res.status}`); continue; }
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) { lastErr = new Error(`${model} empty response`); continue; }
        const parsed = schema.safeParse(JSON.parse(text));
        if (!parsed.success) { lastErr = parsed.error; continue; } // 재시도로 교정 유도
        return parsed.data;
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw new Error(`Gemini 생성 실패: ${String(lastErr).slice(0, 300)}`);
}
