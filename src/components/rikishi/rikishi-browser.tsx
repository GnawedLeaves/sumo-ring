"use client";

import { History } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RikishiName } from "@/components/rikishi-name";
import { RANK_JP } from "@/lib/rank";
import { useInfiniteScroll } from "@/lib/use-infinite-scroll";
import { clearHistory, historySnapshot, pushHistory, serverHistorySnapshot, subscribeHistory } from "@/lib/search-history";
import type { RikishiIndexEntry } from "@/lib/sumo-data";
import { Romaji } from "@/components/jp";
import { Portrait } from "@/components/portrait";

/** List rows carry the Hygraph portrait URL when one exists. */
type Row = RikishiIndexEntry & { portrait?: string };

type Status = "active" | "inactive";
const PAGE = 40;
const DEBOUNCE_MS = 300;

export function RikishiBrowser() {
  const [status, setStatus] = useState<Status>("active");
  const [query, setQuery] = useState("");
  /** Query applied to the list (set on submit / suggestion pick), separate from what's being typed. */
  const [filter, setFilter] = useState("");

  return (
    <div className="flex flex-col gap-8">
      <SearchBox
        query={query}
        setQuery={setQuery}
        onSubmit={(q) => {
          setFilter(q);
          if (q) pushHistory({ q });
        }}
      />
      <div className="flex items-center justify-between gap-4 border-b border-line">
        <div className="flex">
          {(["active", "inactive"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={`-mb-px border px-5 py-3 text-body-sm font-bold capitalize ${
                status === s ? "border-line border-b-canvas text-brand" : "border-transparent text-ink-soft"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {filter && (
          <button
            type="button"
            className="link-accent border-crimson-spotlight text-body-sm"
            onClick={() => {
              setFilter("");
              setQuery("");
            }}
          >
            Clear “{filter}”
          </button>
        )}
      </div>
      {/* key resets the list (and its scroll position) whenever the tab or filter changes */}
      <RikishiList key={`${status}:${filter}`} status={status} filter={filter} />
    </div>
  );
}

function SearchBox({ query, setQuery, onSubmit }: { query: string; setQuery: (q: string) => void; onSubmit: (q: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<RikishiIndexEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const history = useSyncExternalStore(subscribeHistory, historySnapshot, serverHistorySnapshot);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete: wait until typing pauses, then query; abort stale requests.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/rikishi/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { records: RikishiIndexEntry[] };
        setResults(data.records);
      } catch {
        /* aborted or offline */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (r: RikishiIndexEntry) => {
    pushHistory({ q: query || r.en, id: r.id, en: r.en, jp: r.jp });
    setOpen(false);
    router.push(`/rikishi/${r.id}`);
  };

  const showHistory = query.trim().length < 2;
  const visible = showHistory ? [] : results;

  return (
    <div ref={boxRef} className="relative">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          onSubmit(query.trim());
        }}
      >
        <label htmlFor="rikishi-search" className="sr-only">
          Search rikishi
        </label>
        <input
          id="rikishi-search"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by shikona (English or 日本語), heya or rank…"
          className="w-full border-2 border-line bg-surface px-5 py-4 text-body outline-none focus:border-brand"
        />
      </form>

      {open && (showHistory ? history.length > 0 : true) && (
        <div className="absolute inset-x-0 top-full z-20 border-2 border-t-0 border-line bg-surface">
          {showHistory ? (
            <>
              <div className="flex items-center justify-between px-5 pt-3 text-caption uppercase text-ink-soft">
                Recent searches
                <button type="button" onClick={clearHistory} className="underline">
                  Clear
                </button>
              </div>
              <ul>
                {history.map((h) => (
                  <li key={`${h.id ?? ""}${h.q}`}>
                    <button
                      type="button"
                      className="w-full px-5 py-2 text-left text-body-sm hover:bg-hover"
                      onClick={() => {
                        setOpen(false);
                        if (h.id) router.push(`/rikishi/${h.id}`);
                        else {
                          setQuery(h.q);
                          onSubmit(h.q);
                        }
                      }}
                    >
                      <History aria-hidden className="mr-1.5 inline h-3.5 w-3.5 align-[-2px] text-ink-soft" />
                      {h.en ? <RikishiName en={h.en} jp={h.jp} /> : h.q}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : loading && visible.length === 0 ? (
            <p className="px-5 py-3 text-body-sm text-ink-soft">Searching…</p>
          ) : visible.length === 0 ? (
            <p className="px-5 py-3 text-body-sm text-ink-soft">No matches. Press Enter to filter the list.</p>
          ) : (
            <ul>
              {visible.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => pick(r)} className="flex w-full items-center justify-between gap-4 px-5 py-2 text-left hover:bg-hover">
                    <span>
                      <strong>{r.en}</strong> <span className="font-jp text-body-sm">{r.jp.split(" ")[0]}</span>
                    </span>
                    <span className="text-caption text-ink-soft">
                      {r.rank ? <Romaji text={r.rank} kind="rank" /> : "—"} · {r.heya ? <Romaji text={r.heya} kind="heya" /> : "—"}{" "}
                      {r.active ? "" : "· retired"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function RikishiList({ status, filter }: { status: Status; filter: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);

  const done = total !== null && rows.length >= total;

  const loadMore = useCallback(async () => {
    if (busy.current || done) return;
    busy.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, skip: String(rows.length), limit: String(PAGE) });
      if (filter) params.set("q", filter);
      const res = await fetch(`/api/rikishi/list?${params}`);
      if (!res.ok) throw new Error(`Rikishi list request failed (${res.status})`);
      const data = (await res.json()) as { total: number; records: Row[] };
      setRows((r) => [...r, ...data.records]);
      setTotal(data.total);
      setError(false);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [status, filter, rows.length, done]);

  // Load the next page only when the bottom of the list scrolls into view.
  const sentinel = useInfiniteScroll(loadMore, !done && !error && !loading);

  // Group consecutive rows by rank tier (rows arrive already sorted by rank).
  const groups: { tier: string; rows: Row[] }[] = [];
  for (const r of rows) {
    const last = groups.at(-1);
    const label = r.tier === "Unranked" ? "Lower divisions" : r.tier;
    if (!filter && last?.tier === label) last.rows.push(r);
    else if (!filter || !last) groups.push({ tier: filter ? "Results" : label, rows: [r] });
    else last.rows.push(r);
  }

  return (
    <div className="flex flex-col gap-12">
      {total === 0 && <p className="text-body-sm">No rikishi match “{filter}”.</p>}
      {groups.map((g, i) => (
        <section key={`${g.tier}-${i}`} className="flex flex-col gap-5">
          <h2 className="flex items-baseline gap-3 font-display text-heading text-brand">
            {g.tier}
            <span className="font-jp text-body text-ink-soft">{RANK_JP[g.tier] ?? (g.tier === "Lower divisions" ? "幕下以下" : "")}</span>
          </h2>
          {/* Gallery cards: square portrait edge-to-edge, big English shikona, smaller Japanese below */}
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {g.rows.map((r) => (
              <li key={r.id} className="min-w-0">
                <Link href={`/rikishi/${r.id}`} className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface hover:bg-hover">
                  <Portrait id={r.id} en={r.en} jp={r.jp} src={r.portrait} size="fill" />
                  <span className="flex flex-1 flex-col gap-1 border-t border-line p-3 sm:p-4">
                    <span className="break-words font-display text-subheading font-bold leading-none tracking-tight text-brand group-hover:underline sm:text-heading">
                      {r.en}
                    </span>
                    {r.jp && (
                      <span lang="ja" className="font-jp text-body-sm text-ink-soft">
                        {r.jp.split(" ")[0]}
                      </span>
                    )}
                    <span className="mt-2 text-caption sm:text-body-sm">
                      {r.rank ? <Romaji text={r.rank} kind="rank" /> : "Unranked"}
                    </span>
                    <span className="text-caption text-ink-soft">
                      {r.heya ? <Romaji text={r.heya} kind="heya" /> : "—"}
                      {!r.active && r.intai ? ` · retired ${r.intai.slice(0, 4)}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div ref={sentinel} aria-hidden className="h-1" />
      {loading && <p className="text-center text-body-sm text-ink-soft">{status === "inactive" && rows.length === 0 ? "Loading the full roster — first load can take a few seconds…" : "Loading…"}</p>}
      {error && (
        <button type="button" onClick={() => { setError(false); loadMore(); }} className="btn-pill self-center bg-cobalt-stage">
          Retry
        </button>
      )}
      {done && rows.length > 0 && <p className="text-center text-caption text-ink-soft">{total} rikishi</p>}
    </div>
  );
}
