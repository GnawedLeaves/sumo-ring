"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { capitalise, findKimarite } from "@/lib/kimarite";

const TIP_WIDTH = 256;
const EDGE = 12;

/**
 * A kimarite name ("Yorikiri 寄り切り") with a hover/focus tooltip explaining it ("Frontal force out — …"),
 * linking to its page in /kimarite. Pass link={false} where it already sits inside another link
 * (e.g. a bout row), since links can't be nested.
 *
 * The tooltip is portalled to <body> with fixed positioning so scrolling sidebars can't clip it.
 */
export function KimariteTerm({ name, jp, link = true }: { name: string; jp?: string; link?: boolean }) {
  const k = findKimarite(name);
  const ref = useRef<HTMLElement>(null);
  const tipId = useId();
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);

  // Hide on scroll/resize rather than chase the anchor.
  useEffect(() => {
    if (!pos) return;
    const hide = () => setPos(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [pos]);

  const label = (
    <>
      {capitalise(name)}
      {(jp ?? k?.jp) && (
        <span lang="ja" className="ml-1 font-jp text-[0.8em] font-normal opacity-75">
          {jp ?? k?.jp}
        </span>
      )}
    </>
  );
  if (!k) return label;

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const above = r.top > 140;
    const half = TIP_WIDTH / 2;
    const left = Math.min(Math.max(r.left + r.width / 2, half + EDGE), window.innerWidth - half - EDGE);
    setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above });
  };
  const hide = () => setPos(null);
  const handlers = { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide };
  const describedBy = pos ? tipId : undefined;
  const cls = "cursor-help underline decoration-dotted decoration-1 underline-offset-[3px]";

  return (
    <>
      {link ? (
        <Link ref={ref as React.Ref<HTMLAnchorElement>} href={`/kimarite/${k.name}`} aria-describedby={describedBy} className={`${cls} hover:decoration-solid`} {...handlers}>
          {label}
        </Link>
      ) : (
        <span ref={ref} tabIndex={0} aria-describedby={describedBy} className={cls} {...handlers}>
          {label}
        </span>
      )}
      {pos &&
        createPortal(
          <span
            id={tipId}
            role="tooltip"
            style={{ left: pos.left, top: pos.top, width: TIP_WIDTH, transform: `translate(-50%, ${pos.above ? "-100%" : "0"})` }}
            className="pointer-events-none fixed z-50 flex flex-col gap-1 rounded-card border border-line bg-surface p-3 text-left text-caption font-normal normal-case tracking-normal text-ink shadow-none"
          >
            <span className="text-body-sm font-bold">
              {capitalise(k.name)} <span lang="ja" className="font-jp font-normal">{k.jp}</span>
            </span>
            <span className="font-bold text-brand">{k.en}</span>
            <span>{k.description}</span>
          </span>,
          document.body,
        )}
    </>
  );
}
