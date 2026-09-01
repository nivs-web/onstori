import { z } from "zod";
import { vertexGenerate, textOf } from "./vertex";

/**
 * Gemini 호출 헬퍼 — JSON 모드 + 모델 폴백 체인 + zod 검증.
 * 텍스트(카피·분류): gemini-3.5-flash → 2.5-flash 폴백 (flash-latest는 503 빈발로 미사용)
 * 전송은 Vertex AI(서비스 계정) — GCP 크레딧 사용 목적. 모델 폴백·zod 계약은 그대로.
 */

const TEXT_MODELS = (process.env.VERTEX_TEXT_MODELS || "gemini-3.5-flash,gemini-2.5-flash").split(",");

export async function geminiJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  opts?: { retries?: number },
): Promise<T> {
  const retries = opts?.retries ?? 1;

  let lastErr: unknown;
  for (const model of TEXT_MODELS) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const r = await vertexGenerate(model, {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
        });
        if (!r.ok) { lastErr = new Error(`${model} HTTP ${r.status} ${r.error.slice(0, 120)}`); continue; }
        const text = textOf(r.data);
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
