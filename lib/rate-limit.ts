import { sbAdmin } from "./db-admin";

/**
 * IP 기반 요청 제한 — LLM 비용이 드는 라우트 보호 (P9 예정이었으나 공개 홍보 전 필요).
 *
 * 카운터는 Postgres에 둔다. Vercel 서버리스는 요청마다 다른 인스턴스일 수 있어
 * 인메모리로는 막히지 않는다. 증가와 판정은 `rate_limit_hit` 함수가 원자적으로 한다.
 *
 * 판정 실패(DB 오류 등) 시에는 **통과시킨다.** 카운터가 죽었다고 정상 사장님의
 * 사이트 생성을 막는 편이 손해가 크다 — 비용 방어보다 가용성이 우선인 자리다.
 */

/** 프록시 뒤에서 진짜 클라이언트 IP. Vercel은 x-forwarded-for 첫 항목이 클라이언트다. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export type LimitRule = { window: number; max: number; label: string };

/**
 * 규칙 여러 개를 모두 통과해야 허용. 하나라도 걸리면 그 규칙을 돌려준다.
 * 앞 규칙이 통과하고 뒤 규칙에서 막히면 앞 규칙의 카운트는 이미 올라간 상태인데,
 * 창이 짧은 쪽부터 검사하므로 실사용에서 어긋남은 무시할 수준이다.
 */
export async function checkRateLimit(
  scope: string,
  ip: string,
  rules: LimitRule[],
): Promise<{ ok: true } | { ok: false; rule: LimitRule }> {
  const sb = sbAdmin();
  for (const rule of rules) {
    try {
      const { data, error } = await sb.rpc("rate_limit_hit", {
        p_key: `${scope}:${rule.label}:${ip}`,
        p_window: rule.window,
        p_max: rule.max,
      });
      if (error) {
        console.warn(JSON.stringify({ evt: "rate_limit_error", scope, rule: rule.label, err: error.message }));
        continue; // 열어준다 — 위 주석의 판단
      }
      if (data === false) return { ok: false, rule };
    } catch (e) {
      console.warn(JSON.stringify({ evt: "rate_limit_error", scope, rule: rule.label, err: String(e).slice(0, 200) }));
    }
  }
  return { ok: true };
}

/**
 * 사이트 생성 한도. 정상 사장님은 1~2개를 만들고 끝이므로 넉넉하고,
 * 그럼에도 한 IP의 하루 비용 상한을 20건(약 $0.4)으로 묶는다.
 * 한국 이동통신은 CGNAT로 IP를 공유하는 경우가 많아 너무 조이면 정상 사용자가 막힌다.
 */
export const GENERATE_LIMITS: LimitRule[] = [
  { window: 3600, max: 5, label: "1h" },
  { window: 86400, max: 20, label: "24h" },
];
