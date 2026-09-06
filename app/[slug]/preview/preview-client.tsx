"use client";

import { useEffect, useState } from "react";
import type { SiteDocT, StoryEntryT } from "@/lib/schema";
import { PALETTES, RenderSection, onColor } from "@/components/sections";
import { SiteChrome } from "@/components/sections/site-chrome";
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
      <main className="flex min-h-svh items-center justify-center px-5 text-center text-[15px] text-[var(--text-soft)]">
        미리보기를 준비하고 있어요
      </main>
    );
  }

  const p = PALETTES[doc.theme.palette];
  const accent = doc.theme.accent ?? p.accent;
  const firstIsHero = doc.sections[0]?.type === "hero";
  const vars = {
    "--s-bg": p.bg, "--s-ink": p.ink, "--s-muted": p.muted, "--s-line": p.line,
    "--s-accent": accent, "--s-soft": p.soft,
    // 팔레트 값이 아니라 **고른 강조색에서** 계산한다 (components/sections/index.tsx onColor)
    "--s-on-accent": onColor(accent),
  } as React.CSSProperties;

  return (
    <div style={vars}>
      <main
        className="min-h-svh"
        style={{
          background: "var(--s-bg)",
          /* 고정 상단 바는 히어로 **위에 겹친다** — 히어로는 화면 맨 위(0)부터 시작해야
             폰에서 100svh 를 온전히 채운다. 그래서 첫 섹션이 히어로면 위를 비우지 않는다.
             띠 같은 다른 섹션이 먼저 오면 그때만 바 높이만큼 비운다.
             아래 여백은 하단 고정 바 자리다(폰 전용) — 스페이서 <div> 로 넣으면
             그게 문서 앞쪽에 끼어 히어로를 밀어낸다. */
          paddingTop: firstIsHero ? 0 : "var(--bar-h)",
          paddingBottom: "var(--dock-pad)",
          fontFamily: "var(--font-body)",
        }}
      >
        <SiteChrome doc={doc} businessName={doc.businessName} />
        {doc.sections.map((s, i) => (
          <div key={i} id={`sec-${i}`}>
            <RenderSection s={s} index={i} ctx={{ doc, stories, slug }} />
          </div>
        ))}
        <footer className="t-caption text-center" style={{ paddingInline: "var(--gutter)", paddingBlock: "var(--s-7)", color: "var(--s-muted)" }}>
          © {new Date().getFullYear()} {doc.businessName} ·{" "}
          <a href="https://onstori.com" className="tap-row underline underline-offset-2" style={{ display: "inline-flex" }}>Made with 온스토리</a>
        </footer>
      </main>
    </div>
  );
}
