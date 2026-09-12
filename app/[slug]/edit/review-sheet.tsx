"use client";

import { useCallback, useEffect, useState } from "react";
import { TextMeter } from "./text-meter";
import { composeCaption, normalizeTag, normalizeTags } from "@/lib/hashtags";
import { strictest } from "@/lib/sns/limits";
import { SNS_EDIT_NOTICE, SNS_EDIT_SCOPE } from "@/lib/sns/copy";
import type { SnsProvider } from "@/lib/sns/types";

/**
 * 「다듬어서 등록」 검토 화면. (2026-09-12 회장님 지시 C2·C3)
 *
 * ★★ **왜 이 화면이 필요한가 — 진짜 이유 하나.**
 *   지금까지 인스타 글에는 **질문 문장이 그대로** 올라갔다.
 *   「오늘 가장 기억에 남는 일은 무엇이었나요?」가 가게 홍보 글로 올라간 것이다.
 *   사장님은 **올라간 뒤에야** 그것을 봤다. 이 화면은 **올라가기 전에 보여 준다.**
 *
 * ★ 이번에 만드는 것은 셋뿐이다(회장님 지시): **글 · 해시태그 · 올릴 곳.**
 *   ⚠ **자막은 이번에 안 만든다.** 자막을 영상에 태우는 장치(워커)가 저장소에 없어서,
 *     버튼을 두면 «눌러도 아무 일이 안 나는 버튼»이 된다 — 그것이 가장 나쁘다.
 *
 * ⚠ 이 화면은 아무것도 SNS 로 보내지 않는다. 보내는 것은 부모(videos-panel)의 publish 다.
 */

type Ready = { provider: SnsProvider; name: string; ok: boolean; why: string };

export function ReviewSheet({ slug, anonId, entryId, ready, busy, onCancel, onSubmit }: {
  slug: string;
  anonId: string;
  entryId: string;
  /** 올릴 수 있는 곳과 못 올리는 이유 — 부모가 /api/sns/status 로 이미 알고 있다 */
  ready: Ready[];
  busy: boolean;
  onCancel: () => void;
  /** 최종 글(해시태그가 이미 붙은 것)과 고른 곳을 부모에게 넘긴다 */
  onSubmit: (caption: string, providers: SnsProvider[]) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [body, setBody] = useState("");
  const [question, setQuestion] = useState("");
  const [fixed, setFixed] = useState<string[]>([]);
  const [auto, setAuto] = useState<string[]>([]);
  /**
   * ★★★ 자동 태그는 **기본 꺼짐**이다. (2026-09-13 점검에서 잡힌 것)
   *
   * ⚠ 전에는 기본이 켜짐이라, 사장님이 «끄지 않으면» 우리가 만든 태그가 그대로 올라갔다.
   *   설계서는 「자동으로 몰래 붙이지 마십시오 — 사장님 계정에 사장님이 안 쓴 말이 올라가는
   *   일입니다」라고 못박았고, 틱톡 심사 요건(올리기 전에 사장님이 고칠 수 있어야 한다)과도
   *   이어지는 대목이다. 그래서 **누르면 붙는 것**으로 바꿨다.
   */
  const [autoPicked, setAutoPicked] = useState<string[]>([]);
  const [mine, setMine] = useState<string[]>([]);
  const [typing, setTyping] = useState("");
  /**
   * 고른 곳. `null` = **아직 사장님이 손대지 않았다**는 뜻이다.
   * ⚠ 빈 배열로 두면 「하나도 안 골랐다」와 구분이 안 돼, 목록이 늦게 오면
   *   기본 선택이 영영 안 붙는다. 그래서 «미정»을 따로 둔다.
   */
  const [picked, setPicked] = useState<SnsProvider[] | null>(null);
  const [maxFixed, setMaxFixed] = useState(5);
  /** ⚠ 마이그레이션 전이면 «글 저장»만 안 된다. 올리기는 그대로 된다 — 사실대로 말한다 */
  const [cantSave, setCantSave] = useState(false);
  /**
   * ★ 영어 해시태그 (2026-09-13 회장님 결정 4) — **가게 설정**이고 **기본 꺼짐**이다.
   * ⚠ 영상마다 고르게 하면 아무도 안 쓴다. 한 번 켜면 유지된다.
   * ⚠ 우리가 번역해 주지 않는다 — 사장님이 적은 글자만 쓴다(없는 말을 지어내지 않는다).
   */
  const [enOn, setEnOn] = useState(false);
  const [enTags, setEnTags] = useState<string[]>([]);
  const [enDraft, setEnDraft] = useState("");
  const [editEn, setEditEn] = useState(false);
  const [editTags, setEditTags] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [saved, setSaved] = useState("");
  /** ⚠ 누른 «즉시» 잠근다 — 두 번 누르면 같은 영상이 두 번 올라간다(되돌릴 수 없다) */
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/story/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, entryId, read: true }),
      });
      const d = (await r.json().catch(() => ({}))) as {
        caption?: string; question?: string; fixed?: string[]; auto?: string[];
        enOn?: boolean; enTags?: string[];
        captionColumnMissing?: boolean; maxFixed?: number; error?: string;
      };
      if (!r.ok) { setErr(d.error ?? `불러오지 못했어요 (${r.status})`); return; }
      /* ★★ 첫 값은 **저장해 둔 글**, 없으면 **질문 문장**이다.
         질문 문장을 몰래 빼지 않는다 — 지금 실제로 올라가는 값이 그것이라,
         그것을 그대로 보여 줘야 사장님이 「이게 올라가는구나」를 알고 고친다. */
      setBody(d.caption || d.question || "");
      setQuestion(d.question ?? "");
      setFixed(d.fixed ?? []);
      setAuto(d.auto ?? []);
      setMaxFixed(d.maxFixed ?? 5);
      setEnOn(d.enOn === true);
      setEnTags(d.enTags ?? []);
      setCantSave(!!d.captionColumnMissing);
    } catch { setErr("연결이 끊겼어요. 잠시 후 다시 시도해 주세요."); }
    finally { setLoading(false); }
  }, [slug, anonId, entryId]);

  /* ⚠ 이펙트 «본문»에서 곧바로 setState 하면 렌더가 연쇄로 돈다(load 의 첫 줄이 setLoading 이다).
     한 틱 뒤에 부른다 — videos-panel 이 쓰는 것과 같은 방식이다. */
  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  /* 처음에는 «올릴 수 있는 곳»이 다 골라져 있다. 이펙트가 아니라 **계산**이라 연쇄 렌더가 없다 */
  const chosen: SnsProvider[] = picked ?? ready.filter((x) => x.ok).map((x) => x.provider);

  const autoOn = auto.filter((t) => autoPicked.includes(t));
  /* ★ 켜져 있을 때만 영어 태그가 붙는다. 꺼져 있으면 한 글자도 안 나간다 */
  const tags = normalizeTags([...fixed, ...autoOn, ...(enOn ? enTags : []), ...mine], 60);
  const limit = strictest(chosen.length ? chosen : (["instagram"] as SnsProvider[]));
  /* ★★ 이것이 **실제로 올라가는 글**이다. 미리보기가 곧 결과여야 한다 */
  const finalText = composeCaption(body, tags, limit?.hashtags ?? null);

  function addMine() {
    const t = normalizeTag(typing);
    if (!t) { setTyping(""); return; }
    setMine((m) => (m.some((x) => x.toLowerCase() === t.toLowerCase()) ? m : [...m, t]));
    setTyping("");
  }

  /** 영어 태그 저장 — 켬/끔과 글자를 함께 보낸다 */
  async function saveEn(nextOn: boolean, nextTags: string[]) {
    try {
      const r = await fetch("/api/story/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, enOn: nextOn, enTags: nextTags }),
      });
      const d = (await r.json().catch(() => ({}))) as { enOn?: boolean; enTags?: string[]; error?: string };
      if (!r.ok) { setErr(d.error ?? "저장하지 못했어요."); return; }
      setEnOn(d.enOn === true);
      setEnTags(d.enTags ?? nextTags);
      setEditEn(false);
      setSaved("영어 해시태그 설정을 저장했어요.");
    } catch { setErr("연결이 끊겼어요. 잠시 후 다시 시도해 주세요."); }
  }

  async function saveFixedTags() {
    const next = normalizeTags(tagDraft.split(/[\s,]+/).filter(Boolean), maxFixed);
    try {
      const r = await fetch("/api/story/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, fixedTags: next }),
      });
      const d = (await r.json().catch(() => ({}))) as { fixed?: string[]; error?: string };
      if (!r.ok) { setErr(d.error ?? "저장하지 못했어요."); return; }
      setFixed(d.fixed ?? next);
      setEditTags(false);
      setSaved("고정 해시태그를 저장했어요.");
    } catch { setErr("연결이 끊겼어요. 잠시 후 다시 시도해 주세요."); }
  }

  async function go() {
    if (sending) return;
    setSending(true);
    /* ★ 올리기 «전»에 글을 저장해 둔다. 실패해도 **막지 않는다** —
       글은 올릴 때 함께 보내므로 이번 등록은 그대로 된다. */
    try {
      await fetch("/api/story/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, entryId, caption: body }),
      });
    } catch { /* 저장 실패는 등록을 막지 않는다 */ }
    onSubmit(finalText, chosen);
  }

  return (
    <div className="mt-3 rounded-2xl border border-n-300 p-4 text-left">
      <p className="t-small font-bold">다듬어서 등록</p>

      {loading ? (
        <p className="mt-3 t-caption text-[var(--text-soft)]">불러오는 중…</p>
      ) : (
        <>
          {/* ── ① 글 ────────────────────────────── */}
          <div className="mt-4">
            <p className="t-caption font-semibold">글</p>
            {/* ★ 고치는 칸 «바로 위»에 범위를 적는다 — 일곱 자리 중 하나(lib/sns/copy.ts) */}
            <p className="mt-1 whitespace-pre-line rounded-lg bg-n-50 px-3 py-2 t-caption leading-relaxed text-[var(--text-soft)]">
              {SNS_EDIT_SCOPE}
            </p>
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)} rows={5}
              placeholder="손님에게 하고 싶은 말을 적어 주세요"
              className="mt-2 w-full rounded-lg border border-n-300 px-3 py-2 t-small leading-relaxed"
            />
            <TextMeter text={finalText} providers={chosen} className="mt-1" />
            {/* ★ 질문 문장이 그대로 들어 있는 동안에는 **그 사실을 말해 준다.**
                조용히 두면 사장님은 그것이 우리가 쓴 글인 줄 안다. */}
            {question && body.trim() === question.trim() && (
              <p className="mt-1 t-caption font-semibold text-danger">
                지금은 <b>녹화 때 받은 질문</b>이 그대로 글이 됩니다. 손님이 읽을 말로 고쳐 주세요.
                {" "}
                <button type="button" onClick={() => setBody("")} className="underline">지우고 새로 쓰기</button>
              </p>
            )}
            {cantSave && (
              <p className="mt-1 t-caption text-[var(--text-soft)]">
                (이번 글은 그대로 올라가지만, <b>다음에 열 때 기억되지는 않아요.</b> 준비가 끝나면 기억됩니다)
              </p>
            )}
          </div>

          {/* ── ② 해시태그 ──────────────────────── */}
          <div className="mt-5">
            <p className="t-caption font-semibold">해시태그</p>

            <p className="mt-2 t-caption text-[var(--text-soft)]">고정 (가게마다 늘 붙는 것 · 최대 {maxFixed}개)</p>
            {editTags ? (
              <div className="mt-1">
                <input
                  value={tagDraft} onChange={(e) => setTagDraft(e.target.value)}
                  placeholder="띄어쓰기로 여러 개 (# 없이 적으셔도 돼요)"
                  className="w-full rounded-lg border border-n-300 px-3 py-2 t-caption"
                />
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => void saveFixedTags()}
                    className="rounded-full bg-n-100 px-3 py-1.5 t-caption font-semibold">저장</button>
                  <button type="button" onClick={() => setEditTags(false)}
                    className="rounded-full border border-n-300 px-3 py-1.5 t-caption font-semibold">취소</button>
                </div>
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {fixed.length === 0 && <span className="t-caption text-[var(--text-soft)]">(아직 없어요)</span>}
                {fixed.map((t) => <Chip key={t} text={t} />)}
                <button type="button"
                  onClick={() => { setTagDraft(fixed.join(" ")); setEditTags(true); }}
                  className="rounded-full border border-n-300 px-3 py-1 t-caption font-semibold">고치기</button>
              </div>
            )}

            {auto.length > 0 && (
              <>
                <p className="mt-3 t-caption text-[var(--text-soft)]">
                  자동 (가게 주소·업종·상호에서 가져왔어요 — <b>누르면 붙습니다</b>)
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {auto.map((t) => {
                    const on = autoPicked.includes(t);
                    return (
                      <button key={t} type="button"
                        onClick={() => setAutoPicked((o) => (on ? o.filter((x) => x !== t) : [...o, t]))}
                        className={`rounded-full px-3 py-1 t-caption ${on ? "bg-n-100 font-semibold" : "border border-n-300 text-[var(--text-soft)]"}`}>
                        {on ? t : `+ ${t}`}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ★★ 영어 해시태그 — **가게 설정**이라 여기서 한 번 켜면 유지된다 (2026-09-13 결정 4).
                ⚠ 기본은 꺼짐이다. 켜지 않으면 한 글자도 안 나간다.
                ⚠ 우리가 번역하지 않는다 — 사장님이 적은 글자만 쓴다. 없는 말을 지어내지 않는다. */}
            <label className="mt-3 flex items-start gap-2">
              <input type="checkbox" checked={enOn}
                onChange={(e) => { const v = e.target.checked; setEnOn(v); void saveEn(v, enTags); }}
                className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <span className="t-caption font-semibold">영어 해시태그도 넣기</span>
                <span className="block t-caption leading-relaxed text-[var(--text-soft)]">
                  한 번 켜 두시면 계속 붙습니다. 영어 태그는 <b>사장님이 적으신 것만</b> 씁니다.
                </span>
              </span>
            </label>

            {enOn && (editEn ? (
              <div className="mt-2">
                <input
                  value={enDraft} onChange={(e) => setEnDraft(e.target.value)}
                  placeholder="띄어쓰기로 여러 개 (예: interior remodeling)"
                  className="w-full rounded-lg border border-n-300 px-3 py-2 t-caption"
                />
                <div className="mt-2 flex gap-2">
                  <button type="button"
                    onClick={() => void saveEn(true, enDraft.split(/[\s,]+/).filter(Boolean))}
                    className="rounded-full bg-n-100 px-3 py-1.5 t-caption font-semibold">저장</button>
                  <button type="button" onClick={() => setEditEn(false)}
                    className="rounded-full border border-n-300 px-3 py-1.5 t-caption font-semibold">취소</button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {enTags.length === 0 && <span className="t-caption text-[var(--text-soft)]">(아직 없어요)</span>}
                {enTags.map((t) => <Chip key={t} text={t} />)}
                <button type="button"
                  onClick={() => { setEnDraft(enTags.join(" ")); setEditEn(true); }}
                  className="rounded-full border border-n-300 px-3 py-1 t-caption font-semibold">고치기</button>
              </div>
            ))}

            <p className="mt-3 t-caption text-[var(--text-soft)]">직접 (이번 영상에만)</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {mine.map((t) => (
                <button key={t} type="button" onClick={() => setMine((m) => m.filter((x) => x !== t))}
                  className="rounded-full bg-n-100 px-3 py-1 t-caption font-semibold">{t} ✕</button>
              ))}
              <input
                value={typing} onChange={(e) => setTyping(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMine(); } }}
                onBlur={addMine}
                placeholder="적고 엔터"
                className="w-40 rounded-lg border border-n-300 px-3 py-1.5 t-caption"
              />
            </div>
          </div>

          {/* ── ③ 올릴 곳 ───────────────────────── */}
          <div className="mt-5">
            <p className="t-caption font-semibold">어디에 올릴까요</p>
            {/* ★★ 틱톡이 목록에 **없는 이유를 그 자리에 적는다.** (2026-09-12)
                조용히 빼면 사장님은 「틱톡이 고장났나」 하고 우리에게 전화한다.
                ⚠ 틱톡은 올릴 때마다 제목·공개범위를 직접 골라야 해서(심사 요건) 이 화면에 못 넣는다. */}
            <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">
              틱톡은 여기에 없습니다 — 올릴 때마다 제목·공개범위를 직접 고르셔야 해서예요.
              영상 카드의 <b>[틱톡에 올리기]</b>로 올려 주세요.
            </p>
            <div className="mt-1 space-y-1.5">
              {ready.map((x) => (
                <label key={x.provider} className="flex items-start gap-2">
                  {/* ★ 못 올리는 곳은 **체크가 아예 안 눌린다.** 눌리는데 아무 일이 안 나는 것이 최악이다 */}
                  <input
                    type="checkbox" disabled={!x.ok}
                    checked={chosen.includes(x.provider)}
                    onChange={(e) => setPicked(e.target.checked ? [...chosen, x.provider] : chosen.filter((q) => q !== x.provider))}
                    className="mt-0.5 h-5 w-5 shrink-0 disabled:opacity-30"
                  />
                  <span className="min-w-0">
                    <span className="t-caption font-semibold">{x.name}</span>
                    {/* ★ 못 쓰는 이유를 **그 자리에** 적는다. 회색으로 두고 이유를 안 쓰면 고장으로 보인다 */}
                    {!x.ok && x.why && (
                      <span className="block t-caption leading-relaxed text-[var(--text-soft)]">{x.why}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ── 이대로 올라갈 글 ──────────────────── */}
          <div className="mt-5">
            <p className="t-caption font-semibold">이대로 올라갑니다</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg border border-n-200 bg-n-50 px-3 py-2 t-caption leading-relaxed">
              {finalText || "(아직 아무것도 없어요)"}
            </p>
          </div>

          {/* ★ 일곱 자리 중 하나 — 검토 화면 맨 아래(작게) */}
          <p className="mt-4 t-caption text-[var(--text-soft)]">⚠ {SNS_EDIT_NOTICE}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button"
              disabled={busy || sending || chosen.length === 0 || !finalText.trim()}
              onClick={() => void go()}
              className="rounded-full bg-green-700 px-4 py-2 t-caption font-semibold text-white disabled:opacity-40">
              {busy || sending ? "올리는 중…" : `${chosen.length}곳에 올리기`}
            </button>
            <button type="button" onClick={onCancel}
              className="rounded-full border border-n-300 px-4 py-2 t-caption font-semibold">취소</button>
          </div>
          {chosen.length === 0 && (
            <p className="mt-2 t-caption text-[var(--text-soft)]">올릴 곳을 한 군데 이상 골라 주세요.</p>
          )}
          {/* ★ 빈 글로는 못 올린다. 전에는 올라갔고, 그때 서버가 «질문 문장»을 대신 채웠다 */}
          {chosen.length > 0 && !finalText.trim() && (
            <p className="mt-2 t-caption font-semibold text-danger">올릴 글이 없어요. 손님에게 하고 싶은 말을 적어 주세요.</p>
          )}
          {saved && <p className="mt-2 t-caption font-semibold text-green-700">{saved}</p>}
          {err && <p className="mt-2 t-caption font-semibold text-danger">{err}</p>}
        </>
      )}
    </div>
  );
}

function Chip({ text }: { text: string }) {
  return <span className="rounded-full bg-n-100 px-3 py-1 t-caption font-semibold">{text}</span>;
}
