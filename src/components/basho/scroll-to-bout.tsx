"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll container for the bout sidebar. Centres the bout marked `data-bout-id={targetId}` inside the list (the
 * page itself doesn't move) on first render, and again whenever the target changes — e.g. when auto-refresh moves
 * the live bout on. Scrolling around by hand isn't overridden while the target stays the same.
 */
export function ScrollToBout({ targetId, className, children }: { targetId?: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const box = ref.current;
    if (!box || !targetId) return;
    const el = box.querySelector<HTMLElement>(`[data-bout-id="${CSS.escape(targetId)}"]`);
    if (!el) return;
    const top = box.scrollTop + (el.getBoundingClientRect().top - box.getBoundingClientRect().top) - (box.clientHeight - el.offsetHeight) / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ top: Math.max(0, top), behavior: first.current || reduce ? "auto" : "smooth" });
    first.current = false;
  }, [targetId]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
