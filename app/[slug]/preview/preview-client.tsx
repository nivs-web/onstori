"use client";

import { useEffect, useState } from "react";
import type { SiteDocT, StoryEntryT } from "@/lib/schema";
import { PALETTES, RenderSection } from "@/components/sections";
import { PREVIEW_MSG, type PreviewMessage } from "@/lib/editor/preview-protocol";

type Props = { slug: string; initialDoc: SiteDocT | null; stories: StoryEntryT[] };

/**
 * PALETTES 로 --s-* 변수를 만드는 부분을 서버가 아니라 여기 둔다. 사장님이 분위기(팔레트)를
 * 바꾸면 색도 실시간으로 바뀌어야 하는데, 서버 페이지에서 변수를 고정하면 내용만 바뀌고
 * 색은 그대로 남는다 — doc 이 postMessage 로 교체될 때마다 vars 도 같이 다시 계산돼야 한다.
 */
export function PreviewClient({ slug, initialDoc, stories }: Props) {
  const [doc, setDoc] = useState(initialDoc);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== location.origin) return;
      const data = e.data as PreviewMessage | undefined;
      if (data?.ch !== PREVIEW_MSG) return;
      if (data.type === "doc") setDoc(data.doc);
      else if (data.type === "focus") {
        document.getElementById(`sec-${data.index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    // 에디터 밖에서 직접 열었으면(=iframe 아님) 보낼 곳이 없다. 발행본만 보이는 채로 둔다.
    if (window.parent !== window) {
      window.parent.postMessage({ ch: PREVIEW_MSG, type: "ready" }, location.origin);
    }
  }, []);

  if (!doc) {
    return (
      <main className="flex min-h-svh items-center justify-center px-5 text-center text-[15px] text-neutral-400">
        미리보기를 준비하고 있어요
      </main>
    );
  }

  const p = PALETTES[doc.theme.palette];
  const accent = doc.theme.accent ?? p.accent;
  const vars = {
    "--s-bg": p.bg, "--s-ink": p.ink, "--s-muted": p.muted, "--s-line": p.line,
    "--s-accent": accent, "--s-soft": p.soft, "--s-on-accent": p.onAccent,
  } as React.CSSProperties;

  return (
    <div style={vars}>
      <main
        className="min-h-svh"
        style={{
          background: "var(--s-bg)",
          fontFamily: `"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`,
        }}
      >
        {doc.sections.map((s, i) => (
          <div key={i} id={`sec-${i}`}>
            <RenderSection s={s} ctx={{ doc, stories, slug }} />
          </div>
        ))}
        <footer className="px-5 py-10 text-center text-[12.5px]" style={{ color: "var(--s-muted)" }}>
          © {new Date().getFullYear()} {doc.businessName} ·{" "}
          <a href="https://onstori.com" className="underline underline-offset-2">Made with 온스토리</a>
        </footer>
      </main>
    </div>
  );
}
