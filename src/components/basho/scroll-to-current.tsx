"use client";

import { useEffect, useRef } from "react";

/**
 * A <nav> that scrolls itself (never the page) so its `aria-current` child is centred: e.g. the day picker opens
 * on today's live day instead of Day 1. Runs on first render and whenever `currentKey` changes.
 */
export function ScrollToCurrent({ currentKey, className, label, children }: { currentKey: string | number; className?: string; label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({
      // Only the axis that actually overflows moves (a row on mobile, a column on desktop).
      left: box.scrollLeft + (r.left - b.left) - (box.clientWidth - r.width) / 2,
      top: box.scrollTop + (r.top - b.top) - (box.clientHeight - r.height) / 2,
      behavior: first.current || reduce ? "auto" : "smooth",
    });
    first.current = false;
  }, [currentKey]);

  return (
    <nav ref={ref} aria-label={label} className={className}>
      {children}
    </nav>
  );
}
