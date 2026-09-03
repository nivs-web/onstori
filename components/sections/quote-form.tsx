"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SectionT } from "@/lib/schema";

/**
 * 견적 문의 폼 — docs/specs/inquiry.md 5장.
 *
 * 손님이 30초 안에 사진 몇 장과 연락처를 남기는 게 목표라 필수는 연락처·동의 둘뿐이다.
 * 스팸 방어는 서버가 하되(레이트리밋·10분 중복), 여기서도 허니팟(`website`)과
 * 폼 마운트 시각(`t0`)을 함께 보낸다 — 서버가 3초 미만 제출을 봇으로 본다.
 *
 * 사진은 업로드 전에 canvas 로 1600px·JPEG 0.8 까지 줄인다. 새 라이브러리를 넣지 않고
 * 현장 사진(수 MB)이 그대로 올라가는 걸 막기 위해서다.
 */

type Props = { s: Extract<SectionT, { type: "quoteForm" }>; slug: string };

const MAX_PHOTOS = 3;
const COPY = {
  sub: "사진 몇 장과 연락처만 남겨주세요. 사장님이 직접 연락드려요.",
  phoneError: "연락받을 번호를 다시 확인해 주세요",
  consent: "견적 안내를 위해 이름·연락처·사진을 수집하며 1년 뒤 삭제합니다. 동의합니다.",
  submit: "견적 요청 보내기",
  sending: "보내는 중…",
  done: "접수됐어요 — 사장님이 곧 연락드려요",
  fail: "지금은 보내지 못했어요. 아래 전화로 바로 연락 주세요.",
  preview: "미리보기에서는 보내지지 않아요",
};

/** 010-1234-5678 꼴로 자동 정리 — 서버 정규식(숫자·+·하이픈 9~20자)과 맞춘다 */
function formatPhone(v: string): string {
  const d = v.replace(/[^0-9]/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/** 업로드 전 축소 — 긴 변 1600px, JPEG 0.8 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.8));
}

export default function QuoteForm({ s, slug }: Props) {
  const [phone, setPhone] = useState("");
  const [photos, setPhotos] = useState<{ file: Blob; url: string }[]>([]);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [phoneError, setPhoneError] = useState(false);
  const t0 = useRef(0);

  /** 에디터 미리보기(iframe) 안에서는 실제 접수를 막는다. 서버 렌더에선 항상 false. */
  const inPreview = useSyncExternalStore(
    () => () => {},
    () => window.parent !== window,
    () => false,
  );

  useEffect(() => {
    // 폼 마운트 시각 — 서버가 3초 미만 제출을 봇으로 본다. 렌더 중 Date.now() 를 부르지 않는다.
    t0.current = Date.now();
    try {
      const mark = sessionStorage.getItem(`onstori:inq:${slug}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage 는 마운트 후에만 읽을 수 있다(SSR 불일치 방지)
      if (mark && Date.now() - Number(mark) < 30 * 60 * 1000) setState("done");
    } catch {
      // 사파리 프라이빗 등 — 무시하고 폼을 그대로 보여준다
    }
  }, [slug]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const next: { file: Blob; url: string }[] = [];
    for (const f of Array.from(files).slice(0, room)) {
      const blob = await shrink(f).catch(() => f as Blob);
      next.push({ file: blob, url: URL.createObjectURL(blob) });
    }
    setPhotos((p) => [...p, ...next]);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 9) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);
    setState("sending");

    const fd = new FormData(e.currentTarget);
    fd.set("slug", slug);
    fd.set("t0", String(t0.current));
    fd.delete("photos");
    photos.forEach((p, i) => fd.append("photos", p.file, `photo-${i}.jpg`));

    const r = await fetch("/api/inquiry", { method: "POST", body: fd }).catch(() => null);
    if (r?.ok) {
      setState("done");
      try {
        sessionStorage.setItem(`onstori:inq:${slug}`, String(Date.now()));
      } catch {
        // 저장 못 해도 접수는 끝났다
      }
    } else {
      setState("error");
    }
  }

  const tel = s.phone.replace(/[^0-9+]/g, "");
  const field = "w-full rounded-xl border px-4 py-3 text-[15px] outline-none";
  const fieldStyle = { borderColor: "var(--s-line)", background: "var(--s-bg)", color: "var(--s-ink)" };

  return (
    <div className="mx-auto max-w-xl">
      <div className="text-center">
        <h2 className="text-xl font-bold sm:text-2xl" style={{ color: "var(--s-ink)" }}>{s.title}</h2>
        <p className="mt-2 text-[14.5px]" style={{ color: "var(--s-muted)" }}>{s.sub ?? COPY.sub}</p>
      </div>

      {state === "done" ? (
        <p
          className="mt-6 rounded-xl border px-5 py-8 text-center text-[15px] font-semibold"
          style={{ background: "var(--s-bg)", color: "var(--s-ink)", borderColor: "var(--s-line)" }}
        >
          {COPY.done}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input name="name" placeholder="성함 (선택)" maxLength={40} className={field} style={fieldStyle} />

          <div>
            <input
              name="phone"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              inputMode="tel"
              placeholder="연락처"
              required
              className={field}
              style={fieldStyle}
            />
            {phoneError && (
              <p className="mt-1 text-[13px]" style={{ color: "var(--s-accent)" }}>{COPY.phoneError}</p>
            )}
          </div>

          <textarea
            name="message"
            placeholder="어떤 작업이 필요하세요? (선택)"
            maxLength={500}
            rows={3}
            className={field}
            style={fieldStyle}
          />

          {s.allowPhotos && (
            <div>
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    <button
                      type="button"
                      aria-label="사진 삭제"
                      onClick={() => setPhotos((ps) => ps.filter((_, k) => k !== i))}
                      className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full text-[13px] leading-none text-white"
                      style={{ background: "var(--s-ink)" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label
                    className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border text-[13px]"
                    style={{ borderColor: "var(--s-line)", color: "var(--s-muted)" }}
                  >
                    + 사진
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        void addPhotos(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              <p className="mt-1.5 text-[13px]" style={{ color: "var(--s-muted)" }}>
                현장 사진 최대 {MAX_PHOTOS}장
              </p>
            </div>
          )}

          <label className="flex items-start gap-2 text-[13.5px]" style={{ color: "var(--s-muted)" }}>
            <input
              type="checkbox"
              name="consent"
              value="1"
              checked={consent}
              required
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>{COPY.consent}</span>
          </label>

          {/* 허니팟 — 사람 눈에 보이지 않는다. 채워져 오면 서버가 400 */}
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0" />

          <button
            type="submit"
            disabled={state === "sending" || inPreview}
            className="w-full rounded-full px-7 py-3.5 text-[15px] font-semibold shadow disabled:opacity-60"
            style={{ background: "var(--s-accent)", color: "var(--s-on-accent)" }}
          >
            {state === "sending" ? COPY.sending : COPY.submit}
          </button>

          {inPreview && (
            <p className="text-center text-[13px]" style={{ color: "var(--s-muted)" }}>{COPY.preview}</p>
          )}
          {state === "error" && (
            <p className="text-center text-[13.5px]" style={{ color: "var(--s-accent)" }}>{COPY.fail}</p>
          )}
        </form>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <a
          href={`tel:${tel}`}
          className="rounded-full px-7 py-3.5 text-[15px] font-semibold shadow"
          style={{ background: "var(--s-accent)", color: "var(--s-on-accent)" }}
        >
          📞 {s.phone}
        </a>
        {s.kakaoUrl && (
          <a
            href={s.kakaoUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border px-7 py-3.5 text-[15px] font-semibold"
            style={{ borderColor: "var(--s-accent)", color: "var(--s-accent)" }}
          >
            카카오톡 문의
          </a>
        )}
      </div>
    </div>
  );
}
