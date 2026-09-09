import { COLORS, type DesignSetting } from "@/config/design";
import { brandRamp } from "@/lib/design-tokens";

/**
 * 고른 값이 **실제로 어떻게 보이는지** 확인하는 미리보기.
 *
 * ★ 시안(design-v6-admin.html)의 미리보기 섹션을 옮긴 것이다.
 *   지금 옮긴 것: 01 색 · 02 글자 · 03 간격/모양 · 06 버튼 · 07 폼 · 08 배지.
 *   남은 것(아이콘·로고·모션·게시판·갤러리·블로그·영상·편집기·업로드·어드민)은 다음 배치다.
 *
 * ★ **자바스크립트를 쓰지 않는다.** 시안은 `getComputedStyle` 로 CSS 값을 되읽어 그렸지만,
 *   우리는 서버가 값을 이미 알고 있다(`config/design.ts`·`lib/design-tokens.ts`).
 *   그래서 화면이 무거워지지 않는다.
 *
 * ⚠ 색·글자 상자는 부모가 심어 준 값(`--brand-*` 등)을 그대로 쓴다.
 *   여기서 색을 새로 계산하지 않는다 — 두 곳에서 계산하면 언젠가 갈린다.
 *   램프 숫자를 **글자로** 보여줄 때만 계산값을 쓴다.
 */

const RAMP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function DesignPreview({ setting }: { setting: DesignSetting }) {
  const ramp = brandRamp(setting.color);
  const named = COLORS.find((c) => c.hex.toUpperCase() === setting.color.toUpperCase());

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      {/* ── 01 색 ── */}
      <Section n="01" title="색" note={`${named ? named.name : "직접 고른 색"} 에서 10단계를 계산합니다. 7번이 버튼 면입니다.`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 2, borderRadius: "var(--r-md)", overflow: "hidden" }}>
          {RAMP.map((i) => (
            <div
              key={i}
              style={{
                background: `var(--brand-${i})`, height: 52, display: "flex", alignItems: "flex-end",
                justifyContent: "center", paddingBottom: 4,
                border: i === 0 ? "1px solid var(--border)" : undefined,
              }}
            >
              <span style={{ fontSize: "var(--t-micro)", color: i < 5 ? "var(--brand-9)" : "var(--on-solid)", fontWeight: "var(--w-semi)" }}>
                {i === 7 ? "7 버튼" : i}
              </span>
            </div>
          ))}
        </div>
        <Row>
          <Chip label="주 버튼 면" bg="var(--brand-solid)" fg="var(--on-solid)" />
          <Chip label="브랜드 글자" bg="var(--surface-2)" fg="var(--brand-ink)" />
          <Chip label="연한 띠" bg="var(--brand-tint)" fg="var(--brand-tint-ink)" />
        </Row>
        <p className="t-micro" style={{ color: "var(--text)" }}>
          계산된 버튼 면 {ramp["--brand-7"]} · 브랜드 글자 {ramp["--brand-text"]}
        </p>
      </Section>

      {/* ── 02 글자 ── */}
      <Section n="02" title="글자" note="제목 굵기와 자간이 분위기에 따라 달라집니다. 본문 크기·행간은 어떤 분위기에서도 고정입니다.">
        <p style={{ fontSize: "var(--t-h1)", lineHeight: "var(--lh-h1)", letterSpacing: "var(--ls-h1)", fontWeight: "var(--w-title)", color: "var(--text-strong)", margin: 0 }}>
          홈페이지는 빈 집입니다
        </p>
        <p style={{ fontSize: "var(--t-h3)", lineHeight: "var(--lh-h2)", letterSpacing: "var(--ls-h3)", fontWeight: "var(--w-sub)", color: "var(--text-strong)", margin: 0 }}>
          스토리에는 진짜 사람이 있습니다
        </p>
        <p style={{ fontSize: "var(--t-body)", lineHeight: "var(--lh-body)", letterSpacing: "var(--ls-body)", color: "var(--text)", margin: 0 }}>
          사장님이 들려주시는 이야기가 홈페이지가 됩니다. 본문은 17px · 행간 1.68로 고정입니다.
        </p>
        <p style={{ fontSize: "var(--t-caption)", letterSpacing: "var(--ls-eyebrow)", color: "var(--text)", textTransform: "uppercase", margin: 0 }}>
          작은 안내 글씨
        </p>
      </Section>

      {/* ── 03 간격 · 모양 ── */}
      <Section n="03" title="간격 · 모양" note="분위기를 바꾸면 여백과 모서리가 함께 달라집니다.">
        <Row>
          {(["--s-2", "--s-4", "--s-6", "--s-8"] as const).map((t) => (
            <div key={t} style={{ textAlign: "center" }}>
              <div style={{ width: `var(${t})`, height: 20, background: "var(--brand-4)", borderRadius: 2 }} />
              <span className="t-micro" style={{ color: "var(--text)" }}>{t.replace("--s-", "")}</span>
            </div>
          ))}
        </Row>
        <Row>
          {(["--r-xs", "--r-sm", "--r-md", "--r-lg"] as const).map((t) => (
            <div key={t} style={{ textAlign: "center" }}>
              <div style={{ width: 44, height: 32, background: "var(--surface-2)", border: "var(--bw) solid var(--border-2)", borderRadius: `var(${t})` }} />
              <span className="t-micro" style={{ color: "var(--text)" }}>{t.replace("--r-", "")}</span>
            </div>
          ))}
        </Row>
      </Section>

      {/* ── 06 버튼 ── */}
      <Section n="06" title="버튼" note="주 버튼(색이 찬 것)은 한 화면에 하나만 둡니다.">
        <Row>
          <Btn bg="var(--brand-solid)" fg="var(--on-solid)">사이트 반영</Btn>
          <Btn bg="var(--surface-2)" fg="var(--text-strong)">저장</Btn>
          <Btn bg="transparent" fg="var(--brand-ink)">더 보기</Btn>
          <Btn bg="var(--surface-2)" fg="var(--text)" disabled>비활성</Btn>
        </Row>
      </Section>

      {/* ── 07 입력 · 폼 ── */}
      <Section n="07" title="입력 · 폼" note="테두리·모서리·글자색이 분위기와 밝기를 따릅니다.">
        <div style={{ display: "grid", gap: "var(--s-3)", maxWidth: 420 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="t-caption" style={{ color: "var(--text-strong)", fontWeight: "var(--w-label)" }}>가게 이름</span>
            <span style={{ display: "block", height: 40, borderRadius: "var(--r-md)", border: "var(--bw) solid var(--border-2)", background: "var(--surface)", color: "var(--text)", padding: "0 12px", lineHeight: "40px", fontSize: "var(--t-small)" }}>
              온스토리 다산점
            </span>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="t-caption" style={{ color: "var(--text-strong)", fontWeight: "var(--w-label)" }}>안내 문구</span>
            <span style={{ display: "block", height: 40, borderRadius: "var(--r-md)", border: "var(--bw) solid var(--brand-ring)", background: "var(--surface)", color: "var(--placeholder)", padding: "0 12px", lineHeight: "40px", fontSize: "var(--t-small)" }}>
              여기에 적어 주세요 (선택된 칸)
            </span>
          </label>
        </div>
      </Section>

      {/* ── 08 배지 · 알림 ── */}
      <Section n="08" title="배지 · 알림" note="상태를 알리는 작은 표시입니다.">
        <Row>
          <Chip label="공개 중" bg="var(--brand-tint)" fg="var(--brand-tint-ink)" />
          <Chip label="준비 중" bg="var(--surface-2)" fg="var(--text)" />
          <Chip label="확인 필요" bg="var(--accent-soft)" fg="var(--accent-ink)" />
          <Chip label="문제 있음" bg="var(--danger-soft)" fg="var(--danger)" />
        </Row>
      </Section>
    </div>
  );
}

/* ─────────────────────────── 조각들 ─────────────────────────── */

function Section({ n, title, note, children }: { n: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "grid", gap: "var(--s-3)" }}>
      <div>
        <span style={{ fontSize: "var(--t-micro)", letterSpacing: "var(--ls-eyebrow)", color: "var(--brand-ink)", fontWeight: "var(--w-semi)" }}>{n}</span>
        <h2 style={{ fontSize: "var(--t-h3)", fontWeight: "var(--w-sub)", color: "var(--text-strong)", margin: "2px 0 0" }}>{title}</h2>
        <p style={{ fontSize: "var(--t-caption)", color: "var(--text)", margin: "2px 0 0" }}>{note}</p>
      </div>
      {children}
    </section>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "center", flexWrap: "wrap" }}>{children}</div>
);

const Chip = ({ label, bg, fg }: { label: string; bg: string; fg: string }) => (
  <span style={{ background: bg, color: fg, borderRadius: "var(--r-full)", padding: "4px 12px", fontSize: "var(--t-caption)", fontWeight: "var(--w-label)" }}>{label}</span>
);

const Btn = ({ children, bg, fg, disabled }: { children: React.ReactNode; bg: string; fg: string; disabled?: boolean }) => (
  <span
    style={{
      background: bg, color: fg, borderRadius: "var(--r-md)", padding: "10px 20px",
      fontSize: "var(--t-small)", fontWeight: "var(--w-label)", opacity: disabled ? 0.5 : 1,
      border: bg === "transparent" ? "var(--bw) solid var(--brand-ring)" : "none",
      display: "inline-block",
    }}
  >{children}</span>
);
