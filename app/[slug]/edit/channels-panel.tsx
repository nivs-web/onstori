"use client";

import { OWNER_CHANNELS, isUsableChannelUrl } from "@/config/owner-channels";

/**
 * 「이미 운영 중인 채널」 — 편집화면의 «연결» 탭 (2026-09-16, 반장 지시 [7]).
 *
 * ★★ **약속을 지키는 화면이다.** 가입 4단계(`app/new/wizard.tsx` step 3)가
 *   「생성 후에도 «수정하기»에서 언제든 자유롭게 변경할 수 있습니다」라고 이미 말해 놓고
 *   그 화면이 없었다. 이 컴포넌트가 그 화면이다.
 *
 * ⚠ **저장 위치를 바꾸지 않는다.** `sites.settings.channels[id]` 그대로다 — `config/owner-channels.ts`
 *   의 머리말과 `lib/jsonld.ts`(구조화 데이터 sameAs)가 그 자리를 읽는다. 이름을 바꾸면
 *   네이버 검색 노출이 끊긴다.
 * ★ 목록·설명·placeholder·마크·색은 전부 `config/owner-channels.ts`(단일 출처)에서 온다.
 *   여기서 새 채널을 추가하려면 그 파일 하나만 고치면 된다 — 이 파일은 목록을 그릴 뿐이다.
 * ★ UI는 가입 화면(wizard.tsx step 3)과 같은 짜임(동그란 마크 + 입력칸)을 쓴다 —
 *   같은 값을 두 군데서 다르게 보여주면 사장님이 다른 기능으로 착각한다.
 */
const inp = "w-full rounded-xl border border-n-200 px-3.5 py-2.5 t-body outline-none focus:border-green-700";

export function ChannelsPanel({ value, onChange }: {
  /** `sites.settings.channels` — 저장된 값 그대로(정제 전). 지우면 빈 문자열 */
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  return (
    // ⚠ data-tour 앵커를 새로 짓지 않는다(CLAUDE.md 규칙 3) — config/tours.ts·completeness.ts
    // 어느 목록에도 이 화면을 가리키는 이름이 없다. 필요해지면 그쪽에 먼저 추가한다.
    <section className="rounded-2xl border border-n-200 p-4">
      <h2 className="t-small font-bold">이미 운영 중인 채널</h2>
      <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">
        네이버 플레이스·인스타그램 같은 기존 채널 주소를 넣으면 홈페이지에 연결 버튼이 뜨고,
        검색에서 같은 가게로 묶여 노출에도 도움이 돼요. 전부 선택이에요 — 비워도 괜찮아요.
      </p>

      <div className="mt-3 space-y-3">
        {OWNER_CHANNELS.map((c) => {
          const v = value[c.id] ?? "";
          /* ⚠ 「비었다」와 「틀렸다」를 가른다. 안 쓰신 칸을 빨갛게 칠하면 겁을 드린다 */
          const bad = v.trim().length > 0 && !isUsableChannelUrl(v);
          return (
            <label key={c.id} className="block">
              <span className="mb-1 flex items-center gap-2 t-caption font-semibold text-[var(--text-soft)]">
                {/* 위젯에 뜰 모양을 미리 보여 준다 — 무엇이 생기는지 알고 넣으시게(가입 화면과 같은 장치) */}
                <span
                  aria-hidden
                  className="flex shrink-0 items-center justify-center font-bold text-white"
                  style={{
                    width: 22, height: 22, borderRadius: "50%", background: c.color,
                    fontSize: c.mark.length > 2 ? 8 : 10,
                    opacity: isUsableChannelUrl(v) ? 1 : 0.35,
                  }}
                >
                  {c.mark}
                </span>
                {c.label}
              </span>
              <input
                className={inp}
                style={{ borderColor: bad ? "var(--danger)" : undefined }}
                value={v}
                maxLength={300}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={c.placeholder}
                aria-invalid={bad}
                onChange={(e) => onChange({ ...value, [c.id]: e.target.value })}
              />
              <span className={`mt-1 block t-caption leading-relaxed ${bad ? "text-danger" : "text-[var(--text-soft)]"}`}>
                {bad ? "https:// 로 시작하는 주소를 붙여 주세요" : c.hint}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
