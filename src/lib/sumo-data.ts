// Cached accessors over the Sumo API. Everything here is wrapped in `use cache` so repeated
// page views hit the in-memory cache (persistent on a long-lived Render server) instead of the API.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sumoApi, type BanzukeEntry, type Division, type RankChange, type Rikishi } from "./sumo-api";
import { latestStartedBashoId, previousBashoIds } from "./basho";
import { rankTier, rankValue, type RankTier } from "./rank";

type Freshness = "live" | "settled";

function life(freshness: Freshness) {
  if (freshness === "live") cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  else cacheLife("days"); // finished basho data never changes
}

export async function getBasho(id: string, freshness: Freshness = "settled") {
  "use cache";
  life(freshness);
  cacheTag(`basho-${id}`);
  return sumoApi.basho(id).catch(() => null);
}

export async function getBanzuke(id: string, division: Division = "Makuuchi", freshness: Freshness = "settled") {
  "use cache";
  life(freshness);
  cacheTag(`basho-${id}`);
  const b = await sumoApi.banzuke(id, division).catch(() => null);
  if (!b) return null;
  return [...(b.east ?? []), ...(b.west ?? [])].sort((a, c) => a.rankValue - c.rankValue || (a.side === "East" ? -1 : 1));
}

export async function getTorikumi(id: string, day: number, division: Division = "Makuuchi", freshness: Freshness = "settled") {
  "use cache";
  life(freshness);
  cacheTag(`basho-${id}`);
  const t = await sumoApi.torikumi(id, division, day).catch(() => null);
  return (t?.torikumi ?? []).sort((a, b) => a.matchNo - b.matchNo);
}

export async function getRikishi(id: number) {
  "use cache";
  cacheLife("hours");
  return sumoApi.rikishi(id, { ranks: true, measurements: true, shikonas: true }).catch(() => null);
}

export async function getRikishiStats(id: number) {
  "use cache";
  cacheLife("hours");
  return sumoApi.rikishiStats(id).catch(() => null);
}

/** A rikishi's bouts in one basho (pass bashoId — the unfiltered list can be 1000+ records). */
export async function getRikishiMatches(id: number, bashoId: string, freshness: Freshness = "settled") {
  "use cache";
  life(freshness);
  const res = await sumoApi.rikishiMatches(id, bashoId).catch(() => null);
  return res?.records ?? [];
}

export async function getHeadToHead(a: number, b: number) {
  "use cache";
  cacheLife("hours");
  const h = await sumoApi.headToHead(a, b).catch(() => null);
  return h ? { ...h, matches: (h.matches ?? []).filter((m) => m.winnerId) } : null;
}

// ---------- Derived data ----------

export type BashoSummary = {
  id: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  winner?: BanzukeEntry;
  runnersUp: BanzukeEntry[];
  yusho: NonNullable<Awaited<ReturnType<typeof getBasho>>>["yusho"];
  specialPrizes: NonNullable<Awaited<ReturnType<typeof getBasho>>>["specialPrizes"];
};

/** Makuuchi winner + the next three best records. The API has no "runner-up" concept, so we derive it. */
export async function getBashoSummary(id: string, freshness: Freshness = "settled"): Promise<BashoSummary | null> {
  "use cache";
  life(freshness);
  cacheTag(`basho-${id}`);
  const [basho, banzuke, names] = await Promise.all([sumoApi.basho(id).catch(() => null), getBanzuke(id, "Makuuchi", freshness), getJpNames()]);
  if (!basho) return null;
  const winnerId = basho.yusho?.find((y) => y.type === "Makuuchi")?.rikishiId;
  // Older banzuke have no Japanese names; fill from the roster.
  const ranked = (banzuke ?? [])
    .map((e) => (e.shikonaJp ? e : { ...e, shikonaJp: names[e.rikishiID] }))
    .sort((a, b) => b.wins - a.wins || a.rankValue - b.rankValue);
  const winner = ranked.find((r) => r.rikishiID === winnerId);
  return {
    id,
    location: basho.location,
    startDate: basho.startDate,
    endDate: basho.endDate,
    winner,
    runnersUp: ranked.filter((r) => r.rikishiID !== winnerId).slice(0, 3),
    yusho: (basho.yusho ?? []).map((y) => ({ ...y, shikonaJp: y.shikonaJp || names[y.rikishiId] })),
    specialPrizes: (basho.specialPrizes ?? []).map((p) => ({ ...p, shikonaJp: p.shikonaJp || names[p.rikishiId] })),
  };
}

/**
 * rikishi id -> Japanese shikona for everyone in the database. Older banzuke and some torikumi rows
 * have no Japanese names, so this fills the gaps. ~10 list calls (no history flags), cached a day.
 */
export async function getJpNames(): Promise<Record<number, string>> {
  "use cache";
  cacheLife("days");
  cacheTag("rikishi-index");
  const PAGE = 1000;
  const first = await sumoApi.rikishis({ intai: true, limit: PAGE, skip: 0 });
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, Math.ceil(first.total / PAGE) - 1) }, (_, i) => sumoApi.rikishis({ intai: true, limit: PAGE, skip: (i + 1) * PAGE })),
  );
  const out: Record<number, string> = {};
  for (const r of [first, ...rest].flatMap((p) => p.records ?? [])) if (r.shikonaJp) out[r.id] = r.shikonaJp;
  return out;
}

export type BashoRecord ={ wins: number; losses: number; absences: number; rank: string; jp?: string };

/**
 * Index of a basho's Makuuchi + Juryo entries keyed by rikishi id: records ("6-2") plus the Japanese
 * shikona, which torikumi rows don't include.
 */
export async function getBashoRecords(id: string, freshness: Freshness = "settled"): Promise<Record<number, BashoRecord>> {
  "use cache";
  life(freshness);
  cacheTag(`basho-${id}`);
  const [mk, j, names] = await Promise.all([getBanzuke(id, "Makuuchi", freshness), getBanzuke(id, "Juryo", freshness), getJpNames()]);
  const out: Record<number, BashoRecord> = {};
  for (const e of [...(mk ?? []), ...(j ?? [])]) {
    out[e.rikishiID] = { wins: e.wins, losses: e.losses, absences: e.absences, rank: e.rank, jp: e.shikonaJp || names[e.rikishiID] };
  }
  return out;
}

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
    const batch = await Promise.all(ids.slice(i, i + CONCURRENCY).map((id) => sumoApi.ranksForBasho(id).catch(() => null)));
    for (const r of batch.flatMap((b) => b ?? [])) {
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
export async function getRikishiProfile(id: number): Promise<RikishiProfile> {
  "use cache";
  cacheLife("hours");
  const res = await sumoApi.rikishiMatches(id).catch(() => null);
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
  const top = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1]);
  return {
    kimariteWins: top(wins),
    kimariteLosses: top(losses),
    bashoResults: [...basho.values()].sort((a, b) => b.bashoId.localeCompare(a.bashoId)),
  };
}
