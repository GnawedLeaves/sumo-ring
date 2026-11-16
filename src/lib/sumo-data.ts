// Cached accessors over the Sumo API. Everything here is wrapped in `use cache` so repeated
// page views hit the in-memory cache (persistent on a long-lived Render server) instead of the API.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sumoApi, SumoApiError, type Award, type BanzukeEntry, type Division, type Match, type RankChange, type Rikishi } from "./sumo-api";
import { latestStartedBashoId, previousBashoIds } from "./basho";
import { rankTier, rankValue, type RankTier } from "./rank";

type Freshness = "live" | "settled";
type Profile = Freshness | "hours";

/*
 * Error handling. A cached function never throws (with Cache Components, an error inside `use cache`
 * during the build's prerender fails the whole build). Instead it returns a Result:
 *  - success, or a genuine 404 (data: null): cached for the normal lifetime;
 *  - any other failure (timeout, 5xx, network): cached for only ~2 minutes, so it is retried soon
 *    instead of sticking for hours/days.
 * Derived cached functions check their inputs' Results and drop to the short lifetime if any failed,
 * because an outer cache with an explicit cacheLife ignores its inner caches' lifetimes.
 * The exported get* functions unwrap a Result into data or an empty fallback.
 */
type Result<T> = { ok: true; data: T } | { ok: false; data: null; error: string };

const FAILED_LIFE = { stale: 30, revalidate: 60, expire: 120 };

/** Exactly one cacheLife call per invocation (a Next.js requirement). */
function setLife(ok: boolean, profile: Profile) {
  if (!ok) cacheLife(FAILED_LIFE);
  else if (profile === "live") cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  else if (profile === "hours") cacheLife("hours");
  else cacheLife("days"); // finished basho data never changes
}

async function attempt<T>(p: Promise<T>): Promise<Result<T | null>> {
  try {
    return { ok: true, data: await p };
  } catch (e) {
    if (e instanceof SumoApiError && e.status === 404) return { ok: true, data: null };
    return { ok: false, data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function unwrap<A extends unknown[], T, F>(fn: (...args: A) => Promise<Result<T>>, fallback: F) {
  return async (...args: A): Promise<NonNullable<T> | F> => {
    const r = await fn(...args);
    if (!r.ok) console.error(`[sumo-data] ${fn.name}: ${r.error}`);
    return r.data ?? fallback;
  };
}

const sortBanzuke = (b: { east: BanzukeEntry[] | null; west: BanzukeEntry[] | null }) =>
  [...(b.east ?? []), ...(b.west ?? [])].sort((a, c) => a.rankValue - c.rankValue || (a.side === "East" ? -1 : 1));

async function cachedBasho(id: string, freshness: Freshness = "settled") {
  "use cache";
  cacheTag(`basho-${id}`);
  const r = await attempt(sumoApi.basho(id));
  setLife(r.ok, freshness);
  return r;
}

async function cachedBanzuke(id: string, division: Division = "Makuuchi", freshness: Freshness = "settled"): Promise<Result<BanzukeEntry[] | null>> {
  "use cache";
  cacheTag(`basho-${id}`);
  const r = await attempt(sumoApi.banzuke(id, division));
  setLife(r.ok, freshness);
  return r.ok ? { ok: true, data: r.data ? sortBanzuke(r.data) : null } : r;
}

async function cachedTorikumi(id: string, day: number, division: Division = "Makuuchi", freshness: Freshness = "settled"): Promise<Result<Match[]>> {
  "use cache";
  cacheTag(`basho-${id}`);
  const r = await attempt(sumoApi.torikumi(id, division, day));
  setLife(r.ok, freshness);
  return r.ok ? { ok: true, data: (r.data?.torikumi ?? []).sort((a, b) => a.matchNo - b.matchNo) } : r;
}

async function cachedRikishi(id: number) {
  "use cache";
  const r = await attempt(sumoApi.rikishi(id, { ranks: true, measurements: true, shikonas: true }));
  setLife(r.ok, "hours");
  return r;
}

async function cachedRikishiStats(id: number) {
  "use cache";
  const r = await attempt(sumoApi.rikishiStats(id));
  setLife(r.ok, "hours");
  return r;
}

async function cachedRikishiMatches(id: number, bashoId: string, freshness: Freshness = "settled"): Promise<Result<Match[]>> {
  "use cache";
  const r = await attempt(sumoApi.rikishiMatches(id, bashoId));
  setLife(r.ok, freshness);
  return r.ok ? { ok: true, data: r.data?.records ?? [] } : r;
}

async function cachedHeadToHead(a: number, b: number) {
  "use cache";
  const r = await attempt(sumoApi.headToHead(a, b));
  setLife(r.ok, "hours");
  return r.ok && r.data ? { ok: true as const, data: { ...r.data, matches: (r.data.matches ?? []).filter((m) => m.winnerId) } } : r;
}

export const getBasho = unwrap(cachedBasho, null);
export const getBanzuke = unwrap(cachedBanzuke, null);
export const getTorikumi = unwrap(cachedTorikumi, [] as Match[]);
export const getRikishi = unwrap(cachedRikishi, null);
export const getRikishiStats = unwrap(cachedRikishiStats, null);
/** A rikishi's bouts in one basho (pass bashoId — the unfiltered list can be 1000+ records). */
export const getRikishiMatches = unwrap(cachedRikishiMatches, [] as Match[]);
export const getHeadToHead = unwrap(cachedHeadToHead, null);

// ---------- Derived data ----------

export type BashoSummary = {
  id: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  winner?: BanzukeEntry;
  runnersUp: BanzukeEntry[];
  yusho: Award[];
  specialPrizes: Award[];
};

/** Makuuchi winner + the next three best records. The API has no "runner-up" concept, so we derive it. */
async function cachedBashoSummary(id: string, freshness: Freshness = "settled"): Promise<Result<BashoSummary | null>> {
  "use cache";
  cacheTag(`basho-${id}`);
  const [basho, banzuke, names] = await Promise.all([cachedBasho(id, freshness), cachedBanzuke(id, "Makuuchi", freshness), cachedJpNames()]);
  // If any input failed, keep this (possibly partial) summary only briefly.
  setLife(basho.ok && banzuke.ok && names.ok, freshness);
  if (!basho.ok) return basho;
  if (!basho.data) return { ok: true, data: null };
  const b = basho.data;
  const jp = names.data ?? {};
  const winnerId = b.yusho?.find((y) => y.type === "Makuuchi")?.rikishiId;
  // Older banzuke have no Japanese names; fill from the roster.
  const ranked = (banzuke.data ?? [])
    .map((e) => (e.shikonaJp ? e : { ...e, shikonaJp: jp[e.rikishiID] }))
    .sort((x, y) => y.wins - x.wins || x.rankValue - y.rankValue);
  return {
    ok: true,
    data: {
      id,
      location: b.location,
      startDate: b.startDate,
      endDate: b.endDate,
      winner: ranked.find((r) => r.rikishiID === winnerId),
      runnersUp: ranked.filter((r) => r.rikishiID !== winnerId).slice(0, 3),
      yusho: (b.yusho ?? []).map((y) => ({ ...y, shikonaJp: y.shikonaJp || jp[y.rikishiId] })),
      specialPrizes: (b.specialPrizes ?? []).map((p) => ({ ...p, shikonaJp: p.shikonaJp || jp[p.rikishiId] })),
    },
  };
}

/**
 * rikishi id -> Japanese shikona for everyone in the database. Older banzuke and some torikumi rows
 * have no Japanese names, so this fills the gaps. ~10 list calls (no history flags), cached a day.
 */
async function cachedJpNames(): Promise<Result<Record<number, string>>> {
  "use cache";
  cacheTag("rikishi-index");
  const PAGE = 1000;
  const r = await attempt(
    (async () => {
      const first = await sumoApi.rikishis({ intai: true, limit: PAGE, skip: 0 });
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, Math.ceil(first.total / PAGE) - 1) }, (_, i) =>
          sumoApi.rikishis({ intai: true, limit: PAGE, skip: (i + 1) * PAGE }),
        ),
      );
      const out: Record<number, string> = {};
      for (const x of [first, ...rest].flatMap((p) => p.records ?? [])) if (x.shikonaJp) out[x.id] = x.shikonaJp;
      return out;
    })(),
  );
  setLife(r.ok, "settled");
  return r.ok ? { ok: true, data: r.data ?? {} } : r;
}

export type BashoRecord = { wins: number; losses: number; absences: number; rank: string; jp?: string };

/**
 * Index of a basho's Makuuchi + Juryo entries keyed by rikishi id: records ("6-2") plus the Japanese
 * shikona, which torikumi rows don't include.
 */
async function cachedBashoRecords(id: string, freshness: Freshness = "settled"): Promise<Result<Record<number, BashoRecord>>> {
  "use cache";
  cacheTag(`basho-${id}`);
  const [mk, j, names] = await Promise.all([cachedBanzuke(id, "Makuuchi", freshness), cachedBanzuke(id, "Juryo", freshness), cachedJpNames()]);
  setLife(mk.ok && j.ok && names.ok, freshness);
  if (!mk.ok && !j.ok) return mk;
  const jp = names.data ?? {};
  const out: Record<number, BashoRecord> = {};
  for (const e of [...(mk.data ?? []), ...(j.data ?? [])]) {
    out[e.rikishiID] = { wins: e.wins, losses: e.losses, absences: e.absences, rank: e.rank, jp: e.shikonaJp || jp[e.rikishiID] };
  }
  return { ok: true, data: out };
}

export const getBashoSummary = unwrap(cachedBashoSummary, null);
export const getJpNames = unwrap(cachedJpNames, {} as Record<number, string>);
export const getBashoRecords = unwrap(cachedBashoRecords, {} as Record<number, BashoRecord>);

// ---------- Full roster index (search + rank-sorted lists) ----------

export type RikishiIndexEntry = {
  id: number;
  en: string;
  jp: string;
  heya: string;
  /** Current rank when active, highest rank achieved when retired. */
  rank: string;
  rankValue: number;
  tier: RankTier;
  active: boolean;
  intai?: string;
  debut?: string;
};

function toIndexEntry(r: Rikishi): RikishiIndexEntry {
  const active = !r.intai;
  let rank = r.currentRank ?? "";
  if (!active || !rank) {
    const best = (r.rankHistory ?? []).reduce<RankChange | undefined>(
      (acc, cur) => (!acc || cur.rankValue < acc.rankValue ? cur : acc),
      undefined,
    );
    rank = best?.rank ?? rank;
  }
  return {
    id: r.id,
    en: r.shikonaEn ?? "",
    jp: (r.shikonaJp ?? "").replace(/\s+/g, " ").trim(),
    heya: r.heya ?? "",
    rank,
    rankValue: rankValue(rank),
    tier: rankTier(rank),
    active,
    intai: r.intai,
    debut: r.debut,
  };
}

const byRank = (a: RikishiIndexEntry, b: RikishiIndexEntry) => a.rankValue - b.rankValue || a.en.localeCompare(b.en);

/** Active rikishi sorted by current rank. One API call, refreshed hourly (banzuke changes between basho). */
export async function getActiveIndex(): Promise<RikishiIndexEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("rikishi-index");
  const res = await sumoApi.rikishis({ limit: 1000 });
  return (res.records ?? []).map(toIndexEntry).sort(byRank);
}

/**
 * Highest rank reached by every rikishi who ever made the top 100 of a banzuke (all Makuuchi + Juryo
 * plus upper Makushita). Built from /api/ranks?bashoId= for every basho since 1958 — ~400 small calls,
 * cached for a week. (Per-rikishi rank history can't be bulk-listed; see sumo-api.ts.)
 */
export async function getHighestRanks(): Promise<Record<number, { rank: string; rankValue: number }>> {
  "use cache";
  cacheLife("weeks");
  cacheTag("rikishi-index");
  const latest = latestStartedBashoId(new Date());
  const ids = [latest, ...previousBashoIds(latest, 500)].filter((id) => id >= "195801");
  const best: Record<number, { rank: string; rankValue: number }> = {};
  const CONCURRENCY = 6;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = await Promise.all(ids.slice(i, i + CONCURRENCY).map((id) => attempt(sumoApi.ranksForBasho(id))));
    // Only used by request-time route handlers (never prerendered), so throwing here is safe: the
    // index isn't cached and the client's Retry button asks again. (404 = cancelled basho, e.g. 2011 Haru.)
    const failed = batch.find((b) => !b.ok);
    if (failed && !failed.ok) throw new Error(`ranks: ${failed.error}`);
    for (const r of batch.flatMap((b) => b.data ?? [])) {
      if (!best[r.rikishiId] || r.rankValue < best[r.rikishiId].rankValue) best[r.rikishiId] = { rank: r.rank, rankValue: r.rankValue };
    }
  }
  return best;
}

/** Retired rikishi sorted by highest rank reached. The API's name filter is exact-match only, so search uses this index. */
export async function getRetiredIndex(): Promise<RikishiIndexEntry[]> {
  "use cache";
  cacheLife("days");
  cacheTag("rikishi-index");
  const PAGE = 1000;
  const [first, highest] = await Promise.all([sumoApi.rikishis({ intai: true, limit: PAGE, skip: 0 }), getHighestRanks()]);
  const pages = Math.ceil(first.total / PAGE);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => sumoApi.rikishis({ intai: true, limit: PAGE, skip: (i + 1) * PAGE })),
  );
  return [first, ...rest]
    .flatMap((p) => p.records ?? [])
    .filter((r) => r.intai)
    .map((r) => {
      const e = toIndexEntry(r);
      const h = highest[r.id];
      return h ? { ...e, rank: h.rank, rankValue: rankValue(h.rank), tier: rankTier(h.rank) } : e;
    })
    .sort(byRank);
}

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");

/** Ranked search over English/Japanese shikona, heya and rank. */
export function searchIndex(index: RikishiIndexEntry[], query: string): RikishiIndexEntry[] {
  const q = fold(query);
  if (!q) return index;
  const scored: { e: RikishiIndexEntry; score: number }[] = [];
  for (const e of index) {
    const en = fold(e.en);
    const jp = fold(e.jp);
    let score = 0;
    if (en.startsWith(q) || jp.startsWith(q)) score = 4;
    else if (en.includes(q) || jp.includes(q)) score = 3;
    else if (fold(e.heya).includes(q)) score = 2;
    else if (fold(e.rank).startsWith(q) || fold(e.tier).startsWith(q)) score = 1;
    if (score) scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score || byRank(a.e, b.e)).map((s) => s.e);
}

export type RikishiProfile = {
  kimariteWins: [string, number][];
  kimariteLosses: [string, number][];
  bashoResults: { bashoId: string; division: string; rank: string; wins: number; losses: number }[];
};

/** Kimarite breakdown and per-basho results, derived from the full match list (cached; only the summary is kept). */
async function cachedRikishiProfile(id: number): Promise<Result<RikishiProfile>> {
  "use cache";
  const r = await attempt(sumoApi.rikishiMatches(id));
  setLife(r.ok, "hours");
  if (!r.ok) return r;
  const res = r.data;
  const wins: Record<string, number> = {};
  const losses: Record<string, number> = {};
  const basho = new Map<string, RikishiProfile["bashoResults"][number]>();
  for (const m of res?.records ?? []) {
    if (!m.winnerId) continue;
    const won = m.winnerId === id;
    if (m.kimarite && m.kimarite !== "fusen") {
      const bucket = won ? wins : losses;
      bucket[m.kimarite] = (bucket[m.kimarite] ?? 0) + 1;
    }
    const row = basho.get(m.bashoId) ?? {
      bashoId: m.bashoId,
      division: m.division,
      rank: m.eastId === id ? m.eastRank : m.westRank,
      wins: 0,
      losses: 0,
    };
    if (won) row.wins++;
    else row.losses++;
    basho.set(m.bashoId, row);
  }
  const top = (counts: Record<string, number>) => Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return {
    ok: true,
    data: {
      kimariteWins: top(wins),
      kimariteLosses: top(losses),
      bashoResults: [...basho.values()].sort((a, b) => b.bashoId.localeCompare(a.bashoId)),
    },
  };
}

export const getRikishiProfile = unwrap(cachedRikishiProfile, { kimariteWins: [], kimariteLosses: [], bashoResults: [] } as RikishiProfile);

// ---------- Kimarite ----------

/** All-time usage of every kimarite: name -> { count, lastUsage ("YYYYMM-day") }. One call, cached a day. */
async function cachedKimariteStats(): Promise<Result<Record<string, { count: number; lastUsage: string }>>> {
  "use cache";
  cacheTag("kimarite");
  const r = await attempt(sumoApi.kimarite({ sortField: "count", sortOrder: "desc", limit: 200 }));
  setLife(r.ok, "settled");
  if (!r.ok) return r;
  return { ok: true, data: Object.fromEntries((r.data?.records ?? []).map((k) => [k.kimarite, { count: k.count, lastUsage: k.lastUsage }])) };
}

/**
 * Most recent sekitori (Makuuchi/Juryo) bouts won with a kimarite. The endpoint covers every division and
 * can't filter by one, so we read the latest 400 and keep the top two divisions.
 */
async function cachedKimariteBouts(name: string): Promise<Result<Match[]>> {
  "use cache";
  cacheTag("kimarite");
  const r = await attempt(sumoApi.kimariteMatches(name, { sortOrder: "desc", limit: 400 }));
  setLife(r.ok, "hours");
  if (!r.ok) return r;
  const top = (r.data?.records ?? []).filter((m) => m.division === "Makuuchi" || m.division === "Juryo");
  return { ok: true, data: top.slice(0, 30) };
}

export const getKimariteStats = unwrap(cachedKimariteStats, {} as Record<string, { count: number; lastUsage: string }>);
export const getKimariteBouts = unwrap(cachedKimariteBouts, [] as Match[]);
