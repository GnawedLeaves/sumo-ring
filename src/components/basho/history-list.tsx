"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Podium } from "@/components/basho/podium";
import type { HistoryItem } from "@/lib/basho-history";
import { useInfiniteScroll } from "@/lib/use-infinite-scroll";

type Page = { items: HistoryItem[]; portraits: Record<number, string>; total: number; nextSkip: number };

/** Past basho with infinite scroll: the first page is server-rendered, later pages load near the bottom. */
export function HistoryList({ initial }: { initial: Page }) {
  const [items, setItems] = useState(initial.items);
  const [portraits, setPortraits] = useState(initial.portraits);
  const [nextSkip, setNextSkip] = useState(initial.nextSkip);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const done = nextSkip >= initial.total;

  const loadMore = useCallback(async () => {
    if (busy.current || done) return;
    busy.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/basho/history?skip=${nextSkip}`);
      if (!res.ok) throw new Error(`History request failed (${res.status})`);
      const page = (await res.json()) as Page;
      setItems((cur) => [...cur, ...page.items]);
      setPortraits((cur) => ({ ...cur, ...page.portraits }));
      setNextSkip(page.nextSkip);
      setError(false);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [nextSkip, done]);

  const sentinel = useInfiniteScroll(loadMore, !done && !error && !loading);

  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-col gap-8">
        {items.map((it) => (
          <li key={it.id} className="rounded-card border border-line bg-surface p-6">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
              <Link href={`/basho/${it.id}`} className="font-display text-heading text-brand hover:underline">
                {it.name} <span className="font-jp text-subheading">{it.jp}</span>
              </Link>
              <span className="text-body-sm text-ink-soft">
                {it.dates} · {it.location}
              </span>
            </div>
            {it.summary ? <Podium summary={it.summary} portraits={portraits} size="md" /> : <p className="text-body-sm">Results unavailable.</p>}
            <Link href={`/basho/${it.id}`} className="link-accent mt-6 inline-block border-tangerine-pop text-body-sm">
              Day-by-day results
            </Link>
          </li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden className="h-1" />
      {loading && <p className="text-center text-body-sm text-ink-soft">Loading older basho…</p>}
      {error && (
        <button
          type="button"
          onClick={() => {
            setError(false);
            void loadMore();
          }}
          className="btn-pill self-center bg-cobalt-stage"
        >
          Retry
        </button>
      )}
      {done && <p className="text-center text-caption text-ink-soft">That&apos;s every basho since 1958.</p>}
    </div>
  );
}
