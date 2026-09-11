"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 「SNS 연결」 화면 — 영상 메뉴 안. (2026-09-11)
 *
 * ★★ 이 화면 하나가 **네 심사(유튜브·인스타·틱톡·페이스북)를 동시에 연다.**
 *   네 곳 모두 「먼저 만들고, 한 번 성공시키고, 그 화면을 증빙으로 내야」 심사가 시작된다.
 *
 * ⚠ **토큰은 여기 오지 않는다.** 서버가 주는 `connection` 에 토큰 칸이 아예 없다
 *   (lib/sns/types.ts 에서 타입으로 막아 뒀다).
 * ⚠ 조용히 실패하지 않는다 — 못 쓰는 SNS 는 **왜 못 쓰는지**를 그 자리에 쓴다.
 */

type Conn = {
  provider: string; accountId: string | null; accountName: string | null;
  status: "active" | "expired" | "revoked"; disclaimerAgreedAt: string | null; connectedAt: string;
};
type Item = {
  provider: string; name: string;
  available: { ok: true } | { ok: false; why: string };
  connection: Conn | null;
  quota: { remaining: number; limit: number; windowSec: number };
};

/** 연결이 실제로 «쓸 수 있는» 상태인가 — 붙어 있고, 살아 있고, 동의까지 받았나 */
const usable = (it: Item) =>
  it.available.ok && !!it.connection && it.connection.status === "active" && !!it.connection.disclaimerAgreedAt;

export function SnsPanel({ slug, selected, onSelected }: {
  slug: string;
  /** 올릴 곳으로 고른 SNS — 올리기(④)가 이 값을 쓴다 */
  selected: string[];
  onSelected: (v: string[]) => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ p: string; msg: string } | null>(null);
  const [note, setNote] = useState("");
  const [howTo, setHowTo] = useState(false);

  const anon = () => { try { return localStorage.getItem("onstori:anonId") ?? ""; } catch { return ""; } };

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const r = await fetch("/api/sns/status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId: anon() }),
      });
      const d = (await r.json().catch(() => ({}))) as { items?: Item[]; needsLogin?: boolean; error?: string };
      if (!r.ok) { setLoadErr(d.error ?? "연결 현황을 불러오지 못했어요."); setItems([]); return; }
      setItems(d.items ?? []);
      setNeedsLogin(!!d.needsLogin);
    } catch {
      setLoadErr("연결이 끊겼어요. 잠시 후 다시 시도해 주세요.");
      setItems([]);
    }
  }, [slug]);

  /* ⚠ 이펙트 본문에서 곧바로 setState 하면 렌더가 연쇄로 돈다(load 첫 줄이 setLoadErr 다) */
  useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

  /* ★ OAuth 에서 돌아온 결과를 읽어 한 줄로 알려 준다. 주소는 곧바로 정리한다 —
       새로고침할 때마다 같은 말이 또 뜨면 사장님이 헷갈린다. */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("sns");
    if (!s) return;
    const p = q.get("p") ?? "";
    /* ⚠ 이펙트 «본문»에서 곧바로 setState 하면 렌더가 연쇄로 돈다. 한 틱 뒤에 넣는다
       (이 저장소의 기존 방식 — videos-panel·theme-toggle 과 같다). */
    const t = window.setTimeout(() => setNote(
      s === "ok" ? "연결됐어요. 아래에서 [올려도 좋아요]를 눌러 주세요."
      : s === "denied" ? "연결을 취소하셨어요. 다시 하시려면 [연결하기]를 눌러 주세요."
      : s === "login" ? "SNS 연결은 로그인이 필요해요. 로그인한 뒤 다시 눌러 주세요."
      : s === "fail" ? `연결하지 못했어요${q.get("k") ? ` (${q.get("k")})` : ""}. 아래 안내를 봐 주세요.`
      : "연결 정보를 확인하지 못했어요.",
    ), 0);
    void p;
    q.delete("sns"); q.delete("p"); q.delete("k");
    const rest = q.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    return () => window.clearTimeout(t);
  }, []);

  async function call(path: string, provider: string, okMsg: string) {
    setBusy(provider); setErr(null); setNote("");
    try {
      const r = await fetch(path, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId: anon(), provider }),
      });
      const d = (await r.json().catch(() => ({}))) as { authUrl?: string; error?: string };
      if (d.authUrl) { window.location.href = d.authUrl; return; }   // 그쪽 로그인으로 이동
      if (!r.ok) {
        setErr({ p: provider, msg: r.status === 403 ? "로그인이 풀렸어요 — 다시 로그인해 주세요" : (d.error ?? `실패했어요 (${r.status})`) });
        return;
      }
      setNote(okMsg);
      await load();
    } catch {
      setErr({ p: provider, msg: "연결이 끊겼어요. 잠시 후 다시 시도해 주세요." });
    } finally { setBusy(null); }
  }

  function toggle(p: string, on: boolean) {
    onSelected(on ? [...new Set([...selected, p])] : selected.filter((x) => x !== p));
  }

  if (items === null) return <p className="mt-6 text-center t-small text-[var(--text-soft)]">연결 현황을 불러오는 중…</p>;

  const connected = items.filter((i) => i.connection && i.connection.status !== "revoked");
  const rest = items.filter((i) => !connected.includes(i));

  return (
    <div className="space-y-4">
      {loadErr && <p className="rounded-xl bg-danger-soft p-3 t-caption font-semibold text-danger">{loadErr}</p>}
      {note && <p className="rounded-xl border border-n-200 p-3 t-caption leading-relaxed">{note}</p>}

      {/* ★ 눌렀다가 막히는 것보다 **미리** 말해 주는 편이 낫다 */}
      {needsLogin && (
        <p className="rounded-xl bg-danger-soft p-3 t-caption font-semibold leading-relaxed text-danger">
          SNS 연결은 <b>로그인이 필요해요.</b> 지금은 이 브라우저에만 홈페이지가 묶여 있어서,
          SNS 에서 돌아올 때 누구의 홈페이지인지 확인할 수 없어요.
        </p>
      )}

      <p className="t-caption leading-relaxed text-[var(--text-soft)]">
        연결하면 찍으신 영상을 그 계정에 <b>온스토리가 대신 올려 드려요.</b> 언제든 [연결 끊기]로 되돌릴 수 있고,
        끊으면 저장된 열쇠를 <b>바로 지웁니다.</b>
      </p>

      {connected.length > 0 && (
        <section>
          <p className="t-small font-bold">연결됨</p>
          <div className="mt-2 space-y-3">
            {connected.map((it) => (
              <Row key={it.provider} it={it} busy={busy} err={err} selected={selected}
                onToggle={toggle} onCall={call} onHowTo={() => setHowTo(true)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="t-small font-bold">아직 연결 안 됨</p>
        <div className="mt-2 space-y-3">
          {rest.map((it) => (
            <Row key={it.provider} it={it} busy={busy} err={err} selected={selected}
              onToggle={toggle} onCall={call} onHowTo={() => setHowTo(true)} />
          ))}
        </div>
      </section>

      {/* 인스타 프로페셔널 계정 바꾸는 법 — 눌렀을 때만 편다 */}
      {howTo && (
        <section className="rounded-2xl border border-n-200 p-4">
          <p className="t-small font-bold">인스타그램을 «프로페셔널 계정»으로 바꾸는 법</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 t-caption leading-relaxed text-[var(--text-soft)]">
            <li>인스타그램 앱 → 오른쪽 아래 내 사진 → 오른쪽 위 ☰ → <b>설정</b></li>
            <li><b>계정 유형 및 도구</b> → <b>프로페셔널 계정으로 전환</b></li>
            <li>업종을 고르고 <b>비즈니스</b> 또는 <b>크리에이터</b>를 선택합니다</li>
          </ol>
          {/* ★ 2026-09-12 — 「페이스북 페이지와 연결」 단계를 **지웠다.**
              인스타 로그인 길로 바꿔서 **페이스북 페이지가 더 이상 필요 없다**(회장님 지시 4).
              동네 사장님 대부분은 페이지가 없고, 그게 가입 이탈 1위였다. */}
          <p className="mt-2 t-caption text-[var(--text-soft)]">
            <b>페이스북 페이지는 없어도 됩니다.</b> 개인 계정으로는 외부에서 올리는 것이 막혀 있어요 — 인스타그램 정책입니다.
          </p>
          <button type="button" onClick={() => setHowTo(false)} className="mt-3 rounded-full border border-n-300 px-4 py-2 t-caption font-semibold">닫기</button>
        </section>
      )}
    </div>
  );
}

function Row({ it, busy, err, selected, onToggle, onCall, onHowTo }: {
  it: Item; busy: string | null; err: { p: string; msg: string } | null; selected: string[];
  onToggle: (p: string, on: boolean) => void;
  onCall: (path: string, provider: string, okMsg: string) => void;
  onHowTo: () => void;
}) {
  const on = usable(it);
  const c = it.connection;
  const expired = c?.status === "expired";
  const needAgree = !!c && c.status === "active" && !c.disclaimerAgreedAt;

  return (
    <section className={`rounded-2xl border p-4 ${on ? "border-green-700" : "border-n-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex min-w-0 flex-1 items-start gap-3">
          {/* ★ 못 쓰는 것은 **체크가 아예 안 눌린다**(회장님 지시). 눌리는데 아무 일이 안 나는 것이 최악이다 */}
          <input
            type="checkbox" disabled={!on} checked={selected.includes(it.provider)}
            onChange={(e) => onToggle(it.provider, e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 disabled:opacity-30"
          />
          <span className="min-w-0">
            <span className="block t-small font-bold">{it.name}</span>
            {c?.accountName && <span className="block t-caption text-[var(--text-soft)]">{c.accountName}</span>}
            {on && (
              <span className="block t-caption text-[var(--text-soft)]">
                오늘 {it.quota.remaining}개 더 올릴 수 있어요 (하루 {it.quota.limit}개)
              </span>
            )}
          </span>
        </label>

        <div className="flex shrink-0 flex-wrap gap-2">
          {c ? (
            <button type="button" disabled={busy === it.provider}
              onClick={() => onCall("/api/sns/disconnect", it.provider, "연결을 끊고 저장된 열쇠를 지웠어요.")}
              className="rounded-full border border-n-300 px-4 py-2 t-caption font-semibold disabled:opacity-40">
              {busy === it.provider ? "…" : "연결 끊기"}
            </button>
          ) : (
            <button type="button" disabled={!it.available.ok || busy === it.provider}
              onClick={() => onCall("/api/sns/connect", it.provider, "")}
              className="rounded-full bg-green-700 px-4 py-2 t-caption font-semibold text-white disabled:opacity-40">
              {busy === it.provider ? "…" : "연결하기"}
            </button>
          )}
        </div>
      </div>

      {/* ★ 못 쓰는 이유를 **그 자리에** 쓴다 */}
      {!it.available.ok && (
        <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">{it.available.why}</p>
      )}
      {/* ★ X 는 글에 링크가 들어가면 요금이 13배라 서버가 주소를 지운다.
          사장님이 모르고 넘어가지 않게 **미리** 알린다 — 조용히 바꾸지 않는다. */}
      {it.provider === "x" && (
        <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
          X 에 올릴 때는 글 속 <b>인터넷 주소가 빠집니다.</b> (X 정책상 링크가 있으면 비용이 크게 올라요)
        </p>
      )}
      {expired && (
        <p className="mt-2 t-caption font-semibold text-danger">연결이 풀렸어요. [연결 끊기] 뒤 다시 연결해 주세요.</p>
      )}

      {/* 면책 동의 — 누르기 전에는 올리기를 시작하지 않는다 */}
      {needAgree && (
        <div className="mt-3 rounded-xl border border-n-200 p-3">
          <p className="t-caption leading-relaxed">
            온스토리가 <b>사장님 계정에 영상을 올립니다.</b> 올린 글의 내용에 대한 책임은 사장님께 있어요.
          </p>
          <button type="button" disabled={busy === it.provider}
            onClick={() => onCall("/api/sns/agree", it.provider, "이제 이 계정에 올릴 수 있어요.")}
            className="mt-2 rounded-full bg-green-700 px-4 py-2 t-caption font-semibold text-white disabled:opacity-40">
            올려도 좋아요
          </button>
        </div>
      )}

      {it.provider === "instagram" && !c && (
        <button type="button" onClick={onHowTo} className="mt-2 t-caption underline text-[var(--text-soft)]">
          프로페셔널 계정으로 바꾸는 방법 보기
        </button>
      )}

      {err?.p === it.provider && (
        <p className="mt-2 rounded-lg bg-danger-soft p-2.5 t-caption font-semibold text-danger">{err.msg}</p>
      )}
    </section>
  );
}
