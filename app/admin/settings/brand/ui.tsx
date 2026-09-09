"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COLORS, MODES, STYLES, TARGETS, colorName, type DesignSetting } from "@/config/design";
import { themeAttrs, themeVarsFull } from "@/lib/design-tokens";
import { DesignPreview } from "./preview";

/**
 * 디자인 설정 화면 — 탭 셋(온스토리 홈 · 운영자 콘솔 · 사장님 편집화면).
 *
 * ★ 고르면 **이 페이지 안 미리보기만** 바뀐다. [적용하기] 를 눌러야 저장되고 모두에게 반영된다.
 *   바꾼 게 없으면 [적용하기]·[되돌리기] 둘 다 눌리지 않는다.
 *
 * ⚠ `lib/design-settings.ts` 를 여기서 import 하면 **서비스 롤 키가 손님 번들에 실린다.**
 *   값은 서버(page.tsx)가 prop 으로 내려준다.
 *
 * ⚠ 서체 항목을 만들지 않는다. 이 셋은 Pretendard 고정이다(규칙 11).
 *
 * ⚠ `.t-caption`·`.t-micro` 는 클래스에 색이 박혀 있다(--text-soft).
 *   어두운 화면에서 흐려 보이지 않게 **색을 같이 지정**한다.
 */

type StoredTarget = "site" | "admin" | "editor";
type All = Record<StoredTarget, DesignSetting>;

const TAB_ORDER: StoredTarget[] = ["site", "admin", "editor"];
const same = (a: DesignSetting, b: DesignSetting) =>
  a.style === b.style && a.mode === b.mode && a.color.toUpperCase() === b.color.toUpperCase();

const soft = { color: "var(--text)" } as const;

export function DesignSettingsUi({ initial }: { initial: All }) {
  const router = useRouter();
  const [tab, setTab] = useState<StoredTarget>("site");
  const [saved, setSaved] = useState<All>(initial);
  const [draft, setDraft] = useState<All>(initial);
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const cur = draft[tab];
  const dirty = !same(cur, saved[tab]);
  const spec = TARGETS.find((t) => t.id === tab)!;

  const set = (patch: Partial<DesignSetting>) => {
    setDraft((d) => ({ ...d, [tab]: { ...d[tab], ...patch } }));
    setMsg("");
    setErr("");
  };

  async function apply() {
    setState("saving"); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/admin/design", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: tab, setting: cur }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `저장 실패 (${r.status})`);
      setSaved((s) => ({ ...s, [tab]: cur }));
      setMsg("적용했습니다");
      /* ★ 루트 레이아웃은 화면 이동만으로 다시 그려지지 않는다.
         이게 없으면 **대표님 화면만** 옛 색으로 남는다. */
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setState("idle");
    }
  }

  const revert = () => { setDraft((d) => ({ ...d, [tab]: saved[tab] })); setMsg(""); setErr(""); };

  /* 미리보기 상자에 심을 값 — 여기는 **전체 값**을 심는다.
     바깥(어드민)이 어떤 설정을 쓰고 있는지와 무관하게 고른 그대로 보여야 하기 때문이다. */
  const previewVars = useMemo(() => themeVarsFull(cur), [cur]);

  return (
    <div style={{ padding: "var(--s-5)" }}>
      <h1 className="t-h2" style={{ marginBottom: "var(--s-2)" }}>디자인 설정</h1>
      <p className="t-caption" style={{ ...soft, marginBottom: "var(--s-5)" }}>
        화면마다 분위기·색·밝기를 따로 정합니다. 고르면 아래 미리보기만 바뀌고,
        <b> 적용하기</b>를 눌러야 실제 화면에 반영됩니다.
      </p>

      {/* ── 탭 셋 ── */}
      <div role="tablist" aria-label="화면 고르기" className="flex" style={{ gap: "var(--s-2)", marginBottom: "var(--s-5)", flexWrap: "wrap" }}>
        {TAB_ORDER.map((t) => {
          const on = t === tab;
          const s = TARGETS.find((x) => x.id === t)!;
          const changed = !same(draft[t], saved[t]);
          return (
            <button
              key={t} role="tab" aria-selected={on} type="button" onClick={() => setTab(t)}
              className="btn btn-xs t-caption"
              style={{
                background: on ? "var(--brand-tint)" : "var(--n-50)",
                color: on ? "var(--brand-tint-ink)" : "var(--text)",
                border: `1px solid ${on ? "var(--brand-ring)" : "var(--n-200)"}`,
                fontWeight: on ? "var(--w-semi)" : "var(--w-reg)",
              }}
            >
              {s.adminName}{changed ? " ·" : ""}
            </button>
          );
        })}
      </div>

      <p className="t-caption" style={{ ...soft, marginBottom: "var(--s-4)" }}>{spec.adminDesc}</p>

      <div className="grid items-start" style={{ gap: "var(--s-5)", gridTemplateColumns: "minmax(260px, 320px) 1fr" }}>
        {/* ── 왼쪽: 고르는 곳 ── */}
        <div className="rounded-2xl border border-n-200 bg-n-0" style={{ padding: "var(--s-4)" }}>
          <Field label="분위기">
            <div className="flex" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
              {STYLES.map((s) => (
                <button
                  key={s.id} type="button" onClick={() => set({ style: s.id })} title={s.adminDesc}
                  className="btn btn-xs t-caption"
                  style={{
                    background: cur.style === s.id ? "var(--brand-solid)" : "var(--n-50)",
                    color: cur.style === s.id ? "var(--on-solid)" : "var(--text)",
                    border: "1px solid var(--n-200)",
                  }}
                >{s.adminName}</button>
              ))}
            </div>
          </Field>

          <Field label="밝기">
            <div className="flex" style={{ gap: "var(--s-2)" }}>
              {MODES.map((m) => (
                <button
                  key={m.id} type="button" onClick={() => set({ mode: m.id })}
                  className="btn btn-xs t-caption"
                  style={{
                    background: cur.mode === m.id ? "var(--brand-solid)" : "var(--n-50)",
                    color: cur.mode === m.id ? "var(--on-solid)" : "var(--text)",
                    border: "1px solid var(--n-200)",
                  }}
                >{m.adminName}</button>
              ))}
            </div>
          </Field>

          <Field label="색" hint={colorName(cur.color)}>
            <div className="flex" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
              {COLORS.map((c) => {
                const on = c.hex.toUpperCase() === cur.color.toUpperCase();
                return (
                  <button
                    key={c.id} type="button" onClick={() => set({ color: c.hex })}
                    aria-label={c.name} title={c.name}
                    style={{
                      width: 26, height: 26, borderRadius: "var(--r-full)", background: c.hex,
                      border: on ? "2px solid var(--text-strong)" : "1px solid var(--n-300)",
                      outline: on ? "2px solid var(--n-0)" : "none", outlineOffset: -4,
                    }}
                  />
                );
              })}
            </div>
            <label className="flex items-center" style={{ gap: "var(--s-2)", marginTop: "var(--s-3)" }}>
              <span className="t-caption" style={soft}>직접</span>
              <input
                value={cur.color}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) set({ color: v.length === 7 ? v : cur.color });
                }}
                placeholder="#RRGGBB" spellCheck={false} aria-label="색상코드 직접 입력"
                className="t-caption rounded-lg border border-n-300 bg-n-0"
                style={{ width: 110, height: "var(--memo-ctl-h)", paddingInline: "var(--s-2)", color: "var(--text)" }}
              />
            </label>
          </Field>

          <div className="flex items-center" style={{ gap: "var(--s-2)", marginTop: "var(--s-5)" }}>
            <button type="button" onClick={apply} disabled={!dirty || state === "saving"} className="btn btn-primary btn-xs t-caption">
              {state === "saving" ? "적용 중…" : "적용하기"}
            </button>
            <button type="button" onClick={revert} disabled={!dirty} className="btn btn-secondary btn-xs t-caption">되돌리기</button>
            <span className="t-caption" style={soft}>{msg}</span>
          </div>
          {err && <p className="t-caption" style={{ color: "var(--danger)", marginTop: "var(--s-2)" }}>{err}</p>}
        </div>

        {/* ── 오른쪽: 미리보기 ── */}
        <div
          {...themeAttrs(cur, tab)}
          style={{ ...previewVars, background: "var(--canvas)", borderRadius: "var(--r-lg)", border: "1px solid var(--border)", padding: "var(--s-5)", color: "var(--text)" } as React.CSSProperties}
        >
          <DesignPreview setting={cur} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--s-4)" }}>
      <div className="flex items-baseline justify-between" style={{ gap: "var(--s-2)", marginBottom: "var(--s-2)" }}>
        <span className="t-caption" style={{ color: "var(--text-strong)", fontWeight: "var(--w-semi)" }}>{label}</span>
        {hint && <span className="t-micro" style={soft}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
