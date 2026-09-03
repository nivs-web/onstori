import { z } from "zod";
import { vertexGenerate, textOf } from "./vertex";

/**
 * Gemini 호출 헬퍼 — JSON 모드 + 모델 폴백 체인 + zod 검증.
 * 텍스트(카피·분류): gemini-3.5-flash → 2.5-flash 폴백 (flash-latest는 503 빈발로 미사용)
 * 전송은 Vertex AI(서비스 계정) — GCP 크레딧 사용 목적. 모델 폴백·zod 계약은 그대로.
 *
 * thinking 비활성화: 카피·분류는 정해진 JSON 스키마를 채우는 작업이라 내부 추론이 이득이 없는데
 * 응답당 1,400~1,600 thinking 토큰을 쓰며 지연을 키운다. 실측(2026-09-01) 11.7초 → 4.6초.
 * `/api/generate`가 Vercel 함수 한도를 넘겨 평문 에러를 뱉던 원인이기도 하다.
 */

const TEXT_MODELS = (process.env.VERTEX_TEXT_MODELS || "gemini-3.5-flash,gemini-2.5-flash").split(",");
const THINKING_BUDGET = 0;

export async function geminiJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  opts?: { retries?: number },
): Promise<{ data: T; model: string }> {
  const retries = opts?.retries ?? 1;

  let lastErr: unknown;
  for (const model of TEXT_MODELS) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const r = await vertexGenerate(model, {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
            thinkingConfig: { thinkingBudget: THINKING_BUDGET },
          },
        });
        if (!r.ok) { lastErr = new Error(`${model} HTTP ${r.status} ${r.error.slice(0, 120)}`); continue; }
        const text = textOf(r.data);
        if (!text) { lastErr = new Error(`${model} empty response`); continue; }
        const parsed = schema.safeParse(JSON.parse(text));
        if (!parsed.success) { lastErr = parsed.error; continue; } // 재시도로 교정 유도
        return { data: parsed.data, model };
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw new Error(`Gemini 생성 실패: ${String(lastErr).slice(0, 300)}`);
}
