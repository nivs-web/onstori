"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FONTS, LOGO_DEFAULT, SHAPES, SYMBOLS, makeLogoSvg,
  type FontId, type ShapeId,
} from "@/lib/logo-maker";
import { romanize } from "@/lib/slug";

/**
 * **로고 만들기 — 가입 3단계.** (2026-09-16 대표님 지시 [5])
 *
 * 화면 순서(대표님이 정하신 그대로):
 * ```
 * ① 회사 로고가 있으시면 첨부해주세요        ← 파일을 올리면 아래가 «접힌다»
 * ─── 글자 로고 만들기 ───
 * ② 로고에 넣을 이름      (상호명이 미리 채워져 있음)
 * ③ [한글] [영문]         (기본 한글 · 영문은 romanize())
 * ④ 모양 5개             (기본 = 최대 굵은 워드)
 * ⑤ 글꼴 5개             (④가 무엇이든 항상 보인다)
 * ⑥ 심볼 15개 / 엠블럼 이니셜  (④에 따라 하나만)
 * ```
 *
 * 🔴 **지킨 것 — 대표님이 못 박으신 다섯**
 * 1. **아무것도 안 골라도 된다.** 기본값이 이미 골라져 있고 그대로 [다음]을 누르면 된다
 * 2. **그러려면 기본값이 예뻐야 한다.** 「최대 굵은 워드 + 기본 글꼴」에 가장 공을 들였다
 * 3. **드롭다운을 쓰지 않는다.** 전부 «미리보기가 박힌 버튼»이다
 * 4. **크기·자간 조절기를 주지 않는다.** `lib/logo-maker.ts` 가 자동으로 정한다
 * 5. **글꼴 카드에는 그 글꼴이 적용돼 있다.** 이름만 적힌 버튼이 아니다
 *
 * ★★ **미리보기를 `<img>` 가 아니라 «인라인 SVG»로 넣는다.**
 *   `<img src="data:image/svg+xml">` 로 넣으면 **우리 웹폰트를 못 부른다** — Pretendard 가 안 먹고
 *   「맑은 고딕」으로 그려진다. 인라인이면 페이지의 글꼴이 그대로 먹는다.
 *   저장할 때는 글꼴을 심는다(`lib/logo-embed.ts`).
 */

export type LogoChoice = {
  /** 직접 올린 파일 — 있으면 글자 로고는 안 쓴다 */
  file: File | null;
  /** 만든 글자 로고 SVG. 파일이 있으면 빈 값 */
  svg: string;
  /** 저장할 때 글꼴을 심으려면 어떤 글자를 썼는지 알아야 한다 */
  usedText: string;
};

export function LogoPicker({
  businessName, accent, value, onChange,
}: {
  businessName: string;
  accent: string;
  value: LogoChoice;
  onChange: (v: LogoChoice) => void;
}) {
  /**
   * ② 이름 — 상호명이 기본값. 사장님이 고치면 그 값이 이긴다.
   *
   * ★ 사장님이 손대기 «전»에는 상호명을 그대로 따라간다. 그래서 값을 «저장»하지 않고
   *   `typed`(사장님이 친 것)가 비었으면 상호명을 쓰는 **파생 값**으로 둔다.
   * ⚠ 전에는 useEffect 로 setName 했는데, 그러면 렌더가 한 번 더 돌고 리액트가 경고한다.
   *   파생 값이면 그 문제 자체가 없어진다.
   */
  const [typed, setTyped] = useState<string | null>(null);
  const name = typed ?? businessName;
  /* ③ 한글/영문 */
  const [script, setScript] = useState<"ko" | "en">("ko");
  /* ④⑤⑥ */
  const [shape, setShape] = useState<ShapeId>(LOGO_DEFAULT.shape);
  const [font, setFont] = useState<FontId>(LOGO_DEFAULT.font);
  const [symbol, setSymbol] = useState(SYMBOLS[0].id);
  const [initials, setInitials] = useState("OS");

  const [preview, setPreview] = useState("");

  /** 실제로 로고에 박히는 글자 — 영문을 고르면 로마자로 */
  const shown = useMemo(() => {
    const base = (name || businessName || "온스토리").trim();
    if (script === "ko") return base;
    const r = romanize(base).replace(/\s+/g, " ").trim();
    /* 첫 글자만 대문자 — 전부 대문자는 읽기 어렵다 */
    return r.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }, [name, businessName, script]);

  /* 파일을 올렸으면 글자 로고는 만들지 않는다 */
  const svg = useMemo(
    () => (value.file ? "" : makeLogoSvg({ name: shown, shape, font, accent, symbol, initials })),
    [value.file, shown, shape, font, accent, symbol, initials],
  );

  /* 고른 값이 바뀔 때마다 부모에게 알린다 */
  useEffect(() => {
    onChange({ file: value.file, svg, usedText: shown + (shape === "emblem" ? initials : "") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg, value.file, shown, shape, initials]);

  function pickFile(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : "");
    onChange({ file: f, svg: "", usedText: "" });
  }

  const card = (on: boolean) =>
    `overflow-hidden rounded-xl border bg-white transition ${on ? "ring-2" : ""}`;
  const cardStyle = (on: boolean) => ({
    borderColor: on ? "var(--green)" : "var(--line)",
    boxShadow: on ? "0 0 0 2px var(--green)" : undefined,
  });

  return (
    <div className="space-y-4">
      {/* ─────────── ① 파일 첨부 ─────────── */}
      <div>
        <label
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-white p-3"
          style={{ borderColor: value.file ? "var(--green)" : "var(--line)" }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="올린 로고" className="h-14 w-14 rounded-lg object-contain" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-lg t-h2" style={{ background: "var(--n-50)" }}>＋</span>
          )}
          <span className="t-small">
            <b>회사 로고가 있으시면 첨부해주세요</b>
            <span className="mt-0.5 block t-caption" style={{ color: "var(--muted)" }}>
              명함, 간판, 카달로그, 서류에 사용하고 계신 로고가 있다면, 파일로 주시거나
              없다면, 카메라로 찍어서 올리셔도 됩니다
            </span>
          </span>
          <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        </label>
        {value.file && (
          <button type="button" onClick={() => pickFile(null)}
            className="mt-2 t-caption underline" style={{ color: "var(--muted)" }}>
            올린 로고를 빼고 글자 로고 만들기
          </button>
        )}
      </div>

      {/* ★ 파일을 올리면 아래는 접힌다 — 둘 다 쓰지 않는다 */}
      {!value.file && (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1" style={{ background: "var(--line)" }} />
            <span className="t-caption" style={{ color: "var(--muted)" }}>글자 로고 만들기</span>
            <span className="h-px flex-1" style={{ background: "var(--line)" }} />
          </div>

          {/* ─────────── 미리보기 — 항상 맨 위에 크게 ─────────── */}
          <div className="flex justify-center rounded-xl p-4" style={{ background: "var(--n-50)" }}>
            {/* ★ 인라인 SVG — `<img>` 로 넣으면 우리 웹폰트가 안 먹는다 */}
            <div className="h-40 w-40" aria-label="로고 미리보기"
              dangerouslySetInnerHTML={{ __html: svg }} />
          </div>

          {/* ─────────── ② 이름 ─────────── */}
          <div>
            <p className="t-small font-bold">로고에 넣을 이름</p>
            <input className="field mt-1.5" value={name} maxLength={30}
              onChange={(e) => setTyped(e.target.value)} />
            <p className="mt-1 t-caption" style={{ color: "var(--muted)" }}>
              홈페이지 로고명 이름의 수정도 가능합니다.
              글자 로고 만들기를 이용해서 간단하게 로고를 제작해보세요
            </p>
          </div>

          {/* ─────────── ③ 한글 / 영문 ─────────── */}
          <div className="flex gap-2">
            {([["ko", "한글"], ["en", "영문"]] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setScript(v)}
                className={`flex-1 rounded-xl border px-4 py-2.5 t-small font-semibold ${script === v ? "ring-2" : ""}`}
                style={cardStyle(script === v)}>
                {label}
                <span className="mt-0.5 block t-caption font-normal" style={{ color: "var(--muted)" }}>
                  {v === "ko" ? (name || businessName) : romanize(name || businessName).slice(0, 14)}
                </span>
              </button>
            ))}
          </div>

          {/* ─────────── ④ 모양 5개 ─────────── */}
          <div>
            <p className="t-small font-bold">모양</p>
            <div className="mt-1.5 grid grid-cols-5 gap-2">
              {SHAPES.map((s) => (
                <button key={s.id} type="button" onClick={() => setShape(s.id)}
                  className={card(shape === s.id)} style={cardStyle(shape === s.id)} title={s.hint}>
                  <div className="aspect-square p-1"
                    dangerouslySetInnerHTML={{ __html: makeLogoSvg({ name: shown, shape: s.id, font, accent, symbol, initials }) }} />
                  <span className="block pb-1 t-caption" style={{ color: "var(--muted)" }}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ─────────── ⑤ 글꼴 5개 — 그 글꼴이 «적용된» 카드 ─────────── */}
          <div>
            <p className="t-small font-bold">글꼴</p>
            <div className="mt-1.5 grid grid-cols-5 gap-2">
              {FONTS.map((f) => (
                <button key={f.id} type="button" onClick={() => setFont(f.id)}
                  className={`rounded-xl border bg-white px-1 py-2.5 ${font === f.id ? "ring-2" : ""}`}
                  style={cardStyle(font === f.id)}>
                  {/* ★ 이름만 적힌 버튼이 아니다 — 그 글꼴로 쓴 상호가 보인다 */}
                  <span className="block truncate px-1 t-small"
                    style={{ fontFamily: f.stack, fontWeight: f.weight, color: "var(--text-strong)" }}>
                    {shown.slice(0, 6) || f.sample}
                  </span>
                  <span className="mt-1 block t-caption" style={{ color: "var(--muted)" }}>{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ─────────── ⑥ 심볼 15개 (심볼 모양일 때만) ─────────── */}
          {shape === "symbol" && (
            <div>
              <p className="t-small font-bold">심볼</p>
              <div className="mt-1.5 grid grid-cols-8 gap-1.5">
                {SYMBOLS.map((s) => (
                  <button key={s.id} type="button" onClick={() => setSymbol(s.id)}
                    className={`aspect-square rounded-lg border bg-white p-1.5 ${symbol === s.id ? "ring-2" : ""}`}
                    style={cardStyle(symbol === s.id)} title={s.label}>
                    <svg viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.9"
                      strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
                      <path d={s.d} />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─────────── ⑥ 이니셜 (엠블럼일 때만) ─────────── */}
          {shape === "emblem" && (
            <div>
              <p className="t-small font-bold">가운데 글자</p>
              <input className="field mt-1.5" value={initials} maxLength={3}
                onChange={(e) => setInitials(e.target.value.toUpperCase())} placeholder="OS" />
              <p className="mt-1 t-caption" style={{ color: "var(--muted)" }}>
                두세 글자가 가장 보기 좋아요. 비워 두면 <b>OS</b> 가 들어갑니다.
              </p>
            </div>
          )}

          <p className="t-caption" style={{ color: "var(--muted)" }}>
            아무것도 안 고르셔도 됩니다 — 위 로고 그대로 만들어 드려요.
            로고는 나중에 관리자에서 바꾸실 수 있습니다.
          </p>
        </>
      )}
    </div>
  );
}
