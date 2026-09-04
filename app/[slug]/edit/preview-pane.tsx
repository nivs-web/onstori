"use client";

import { useEffect, useRef } from "react";
import type { SiteDocT } from "@/lib/schema";
import { PREVIEW_MSG, type PreviewMessage } from "@/lib/editor/preview-protocol";

type Props = { slug: string; doc: SiteDocT; focusIndex: number | null };

/**
 * 에디터 쪽 미리보기 창 — content/plandept/docs/editor-preview-2026-09-05.md 4장(세션 B).
 * `/{slug}/preview` iframe 을 열고 postMessage 로 doc·focus 를 밀어 넣는다.
 *
 * doc·focusIndex 를 ref 로도 들고 있는 이유: "ready" 는 iframe 이 준비된 그 순간 딱 한 번
 * 온다. 그때 항상 최신 doc(·focusIndex)을 보내야 하는데, 메시지 리스너를 doc 이 바뀔 때마다
 * 다시 구독하면 재구독 찰나에 ready 가 끼어들 여지가 생긴다. 리스너는 마운트 시 한 번만 붙이고,
 * 값은 매 렌더마다 ref 에 최신으로 적어 둔다.
 */
export function PreviewPane({ slug, doc, focusIndex }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const docRef = useRef(doc);
  const focusIndexRef = useRef(focusIndex);
  // ref 쓰기는 렌더 중이 아니라 커밋 후에 — "ready" 핸들러가 항상 최신 값을 보게 한다
  useEffect(() => { docRef.current = doc; }, [doc]);
  useEffect(() => { focusIndexRef.current = focusIndex; }, [focusIndex]);

  function post(msg: PreviewMessage) {
    iframeRef.current?.contentWindow?.postMessage(msg, location.origin);
  }

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== location.origin) return;
      const data = e.data as PreviewMessage | undefined;
      if (data?.ch !== PREVIEW_MSG) return;
      if (data.type !== "ready") return;
      readyRef.current = true;
      post({ ch: PREVIEW_MSG, type: "doc", doc: docRef.current });
      // 시트를 열었을 때 방금 고치던 섹션이 바로 보이게 — 이미 있던 focusIndex 도 같이 보낸다
      if (focusIndexRef.current !== null) {
        post({ ch: PREVIEW_MSG, type: "focus", index: focusIndexRef.current });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // doc 갱신 — 글자 하나마다 보내지 않도록 150ms 디바운스. ready 전이면 보낼 곳이 없다.
  useEffect(() => {
    if (!readyRef.current) return;
    const t = setTimeout(() => post({ ch: PREVIEW_MSG, type: "doc", doc }), 150);
    return () => clearTimeout(t);
  }, [doc]);

  // 스크롤 위치는 즉시 따라간다 — 디바운스하면 편집 중 시선이 늦게 따라와 어색하다
  useEffect(() => {
    if (!readyRef.current || focusIndex === null) return;
    post({ ch: PREVIEW_MSG, type: "focus", index: focusIndex });
  }, [focusIndex]);

  return (
    <div className="flex h-full flex-col">
      {/* iframe 바깥의 띠 — 손님 화면(iframe 안)에는 절대 섞이지 않는다 */}
      <p className="shrink-0 bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-800">
        미리보기 — 손님에게는 [사이트 반영]을 눌러야 보여요
      </p>
      <iframe ref={iframeRef} src={`/${slug}/preview`} title="미리보기" className="w-full flex-1 border-0" />
    </div>
  );
}
