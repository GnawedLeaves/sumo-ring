"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { RikishiName } from "@/components/rikishi-name";
import { clearHistory, historySnapshot, serverHistorySnapshot, subscribeHistory } from "@/lib/search-history";

/** Rikishi searches saved in this browser's localStorage. */
export function SearchHistoryList() {
  const history = useSyncExternalStore(subscribeHistory, historySnapshot, serverHistorySnapshot);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-subheading text-brand">Recent rikishi searches</h2>
        {history.length > 0 && (
          <button type="button" onClick={clearHistory} className="text-body-sm underline">
            Clear
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <p className="text-body-sm text-ink-soft">Nothing yet. Searches are stored only in this browser.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line text-body-sm">
          {history.map((h) => (
            <li key={`${h.id ?? ""}${h.q}`} className="py-2">
              {h.id ? (
                <Link href={`/rikishi/${h.id}`} className="font-bold hover:underline">
                  <RikishiName en={h.en ?? h.q} jp={h.jp} />
                </Link>
              ) : (
                <span>“{h.q}”</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
