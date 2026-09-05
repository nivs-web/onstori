"use client";

import { useState } from "react";
import type { SiteDocT, WidgetT } from "@/lib/schema";
import { contactOf } from "@/components/sections";

/**
 * 플로팅 연결 버튼 설정 (2026-09-05).
 * 위젯은 값을 갖지 않는다 — 전화번호는 문의 받기 섹션에서 파생하고, 카톡 주소는
 * 여기서 입력하되 quoteForm.kakaoUrl 에 쓴다(문의 섹션의 카톡 버튼과 같은 값).
 * 저장 배선은 없다: setDoc 이 ui.tsx 에서 setDirty 로 감싸져 있고 디바운스·탭전환·
 * visibilitychange 가 draft 통째를 보낸다.
 */

const inp = "w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-teal-600";
const KIND_LABEL: Record<WidgetT["kind"], string> = { call: "전화", kakao: "카카오톡" };

/** ui.tsx 의 goToAnchor 와 같은 동작 — 이 패널은 props 2개만 받으므로 여기서 직접 한다. */
function scrollToAnchor(anchor: string) {
  const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  const ring = ["ring-2", "ring-teal-500", "ring-offset-2", "rounded-xl"];
  el.classList.add(...ring);
  window.setTimeout(() => el.classList.remove(...ring), 1800);
}

/** 스킴이 없으면 https 를 붙여 본다. 주소가 아니면 null — 저장되는 값은 항상 zod .url() 을 통과한다. */
function normalizeUrl(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try { new URL(withScheme); return withScheme; } catch { return null; }
}

function Toggle({ on, disabled, onChange, name }: { on: boolean; disabled: boolean; onChange: (v: boolean) => void; name: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={`${name} 버튼 ${on ? "끄기" : "켜기"}`}
      disabled={disabled} onClick={() => onChange(!on)}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${
        on ? "bg-teal-700 text-white" : "border border-neutral-300"
      }`}
    >
      {on ? "켜짐" : "꺼짐"}
    </button>
  );
}

export function WidgetsPanel({ doc, setDoc }: { doc: SiteDocT; setDoc: (d: SiteDocT) => void }) {
  const widgets = doc.widgets ?? [];
  const hasQuoteForm = doc.sections.some((s) => s.type === "quoteForm");
  const { tel, kakaoUrl } = contactOf(doc);
  const [kakaoDraft, setKakaoDraft] = useState(kakaoUrl);

  const enabled = new Map<WidgetT["kind"], string>(widgets.map((w) => [w.kind, w.label]));
  const isOn = (k: WidgetT["kind"]) => enabled.has(k);
  const labelOf = (k: WidgetT["kind"]) => enabled.get(k) ?? KIND_LABEL[k];

  /** 항상 [전화, 카카오톡] 순서로 정규화해 저장한다 — 껐다 켜도 버튼 순서가 흔들리지 않는다. */
  function commit(m: Map<WidgetT["kind"], string>) {
    const list: WidgetT[] = [];
    if (m.has("call")) list.push({ kind: "call", label: m.get("call") as string });
    if (m.has("kakao")) list.push({ kind: "kakao", label: m.get("kakao") as string });
    // 0개면 키 자체를 없앤다 — 위젯을 쓰지 않는 사이트에 "widgets":[] 를 남기지 않는다
    setDoc({ ...doc, widgets: list.length ? list : undefined });
  }
  function toggle(k: WidgetT["kind"], next: boolean) {
    const m = new Map(enabled);
    if (next) m.set(k, labelOf(k)); else m.delete(k);
    commit(m);
  }
  function rename(k: WidgetT["kind"], label: string) {
    if (!enabled.has(k)) return;
    const m = new Map(enabled);
    m.set(k, label);
    commit(m);
  }
  /** 카톡 주소는 위젯이 아니라 문의 받기 섹션에 쓴다 — 문의 섹션의 카톡 버튼도 같이 켜진다. */
  function writeKakaoUrl(v: string) {
    setKakaoDraft(v);
    const url = normalizeUrl(v);
    setDoc({
      ...doc,
      sections: doc.sections.map((s) => (s.type === "quoteForm" ? { ...s, kakaoUrl: url ?? undefined } : s)),
    });
  }

  const callBlocked = !hasQuoteForm || !tel;

  return (
    <section data-tour="panel-widgets" className="rounded-2xl border border-neutral-200 p-4">
      <h2 className="text-sm font-bold">연결 버튼</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">
        손님이 어디를 보고 있든 화면 아래에 떠 있는 버튼이에요. 스크롤을 되돌리지 않아도 바로 연락할 수 있어요.
      </p>

      {!hasQuoteForm && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[12.5px] leading-relaxed text-amber-900">
          문의 받기 섹션이 없어서 연결 버튼을 켤 수 없어요. 아래 &lsquo;섹션 추가&rsquo;에서 먼저 넣어주세요.
        </p>
      )}

      <div className="mt-3 space-y-3">
        {/* 전화 */}
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-semibold">전화</span>
            <Toggle name="전화" on={isOn("call") && !callBlocked} disabled={callBlocked} onChange={(v) => toggle("call", v)} />
          </div>
          {callBlocked ? (
            <button
              type="button" onClick={() => scrollToAnchor("sec-form")}
              className="mt-2 block w-full rounded-lg bg-amber-50 p-2.5 text-left text-[12.5px] leading-relaxed text-amber-900 hover:underline"
            >
              문의 받기 섹션에 전화번호를 넣어주세요 — 그 번호로 전화 버튼이 걸립니다.
            </button>
          ) : (
            isOn("call") && (
              <label className="mt-2 block">
                <span className="mb-1 block text-[12px] text-neutral-500">버튼 이름 (최대 8자)</span>
                <input className={inp} value={labelOf("call")} maxLength={8} onChange={(e) => rename("call", e.target.value)} />
              </label>
            )
          )}
        </div>

        {/* 카카오톡 */}
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-semibold">카카오톡</span>
            <Toggle name="카카오톡" on={isOn("kakao")} disabled={!hasQuoteForm} onChange={(v) => toggle("kakao", v)} />
          </div>
          {hasQuoteForm && (
            <>
              <label className="mt-2 block">
                <span className="mb-1 block text-[12px] text-neutral-500">카카오톡 채널 · 오픈채팅 주소</span>
                <input
                  className={inp} value={kakaoDraft} maxLength={200} inputMode="url"
                  placeholder="예: pf.kakao.com/_xxxxx"
                  onChange={(e) => writeKakaoUrl(e.target.value)}
                />
              </label>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">
                문의 받기 섹션의 카카오톡 버튼도 이 주소를 씁니다.
              </p>
              {isOn("kakao") && !kakaoUrl && (
                <p className="mt-1 text-[12px] text-amber-700">주소를 넣어야 버튼이 화면에 보여요.</p>
              )}
              {isOn("kakao") && (
                <label className="mt-2 block">
                  <span className="mb-1 block text-[12px] text-neutral-500">버튼 이름 (최대 8자)</span>
                  <input className={inp} value={labelOf("kakao")} maxLength={8} onChange={(e) => rename("kakao", e.target.value)} />
                </label>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
