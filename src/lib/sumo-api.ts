// Raw, uncached client for the Sumo API — see docs/API.md.
// Pages should use the cached wrappers in ./sumo-data.ts instead of calling this directly.
import "server-only";

const BASE_URL = process.env.SUMO_API_BASE_URL ?? "https://www.sumo-api.com";

export const DIVISIONS = ["Makuuchi", "Juryo", "Makushita", "Sandanme", "Jonidan", "Jonokuchi"] as const;
export type Division = (typeof DIVISIONS)[number];

type Query = Record<string, string | number | boolean | undefined>;

async function get<T>(path: string, query: Query = {}): Promise<T> {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  // Caching is handled by `use cache` in sumo-data.ts; never let fetch cache large payloads itself.
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sumo API ${res.status} for ${url.pathname}${url.search}`);
  return res.json() as Promise<T>;
}

// ---------- Response shapes (verified against live payloads, Nov 2026) ----------

export type Paged<T> = { limit: number; skip: number; total: number; records: T[] | null };

export type RankChange = { id: string; bashoId: string; rikishiId: number; rankValue: number; rank: string };
export type MeasurementChange = { id: string; bashoId: string; rikishiId: number; height: number; weight: number };
export type ShikonaChange = { id: string; bashoId: string; rikishiId: number; shikonaEn: string; shikonaJp?: string };

export type Rikishi = {
  id: number;
  sumodbId?: number;
  nskId?: number;
  shikonaEn: string;
  shikonaJp?: string;
  currentRank?: string;
  heya?: string;
  birthDate?: string;
  shusshin?: string;
  height?: number;
  weight?: number;
  debut?: string;
  intai?: string;
  updatedAt?: string;
  rankHistory?: RankChange[];
  measurementHistory?: MeasurementChange[];
  shikonaHistory?: ShikonaChange[];
};

export type RikishiStats = {
  basho: number;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalAbsences: number;
  yusho: number;
  sansho: Record<string, number>;
  bashoByDivision: Record<string, number>;
  winsByDivision: Record<string, number>;
  lossByDivision: Record<string, number>;
  absenceByDivision: Record<string, number>;
  totalByDivision: Record<string, number>;
  yushoByDivision: Record<string, number>;
};

export type Match = {
  id?: string;
  bashoId: string;
  division: Division;
  day: number;
  matchNo: number;
  eastId: number;
  eastShikona: string;
  eastRank: string;
  westId: number;
  westShikona: string;
  westRank: string;
  kimarite: string;
  /** 0 when the bout has not been decided yet */
  winnerId: number;
  winnerEn: string;
  winnerJp: string;
};

export type HeadToHead = {
  total: number;
  rikishiWins: number;
  opponentWins: number;
  kimariteWins: Record<string, number>;
  kimariteLosses: Record<string, number>;
  matches: Match[] | null;
};

export type Award = { type: string; rikishiId: number; shikonaEn: string; shikonaJp?: string };

export type Basho = {
  date: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  yusho?: Award[];
  specialPrizes?: Award[];
};

export type BanzukeBout = {
  result: "win" | "loss" | "absent" | "fusen loss" | "fusen win" | "";
  opponentShikonaEn: string;
  opponentShikonaJp?: string;
  opponentID: number;
  kimarite: string;
};

export type BanzukeEntry = {
  side: "East" | "West";
  rikishiID: number;
  shikonaEn: string;
  shikonaJp?: string;
  rankValue: number;
  rank: string;
  record?: BanzukeBout[];
  wins: number;
  losses: number;
  absences: number;
};

export type Banzuke = { bashoId: string; division: Division; east: BanzukeEntry[] | null; west: BanzukeEntry[] | null };

export type Torikumi = Basho & { torikumi?: Match[] | null };

export type KimariteStat = { kimarite: string; count: number; lastUsage: string };

// ---------- Endpoints ----------
// NOTE: with ranks/measurements/shikonas=true, /api/rikishis caps pages at 100 and ignores `skip`
// (verified Nov 2026), so bulk listing must be done without those flags.

export type RikishiQuery = {
  shikonaEn?: string;
  heya?: string;
  sumodbId?: number;
  nskId?: number;
  intai?: boolean;
  measurements?: boolean;
  ranks?: boolean;
  shikonas?: boolean;
  sortOrder?: "asc" | "desc";
  limit?: number;
  skip?: number;
};

export type HistoryFlags = Pick<RikishiQuery, "measurements" | "ranks" | "shikonas" | "sortOrder">;

export const sumoApi = {
  rikishis: (q: RikishiQuery = {}) => get<Paged<Rikishi>>("/api/rikishis", q),
  rikishi: (id: number, q: HistoryFlags = {}) => get<Rikishi>(`/api/rikishi/${id}`, q),
  rikishiStats: (id: number) => get<RikishiStats>(`/api/rikishi/${id}/stats`),
  rikishiMatches: (id: number, bashoId?: string) => get<Paged<Match>>(`/api/rikishi/${id}/matches`, { bashoId }),
  headToHead: (id: number, opponentId: number, bashoId?: string) =>
    get<HeadToHead>(`/api/rikishi/${id}/matches/${opponentId}`, { bashoId }),

  basho: (bashoId: string) => get<Basho>(`/api/basho/${bashoId}`),
  banzuke: (bashoId: string, division: Division) => get<Banzuke>(`/api/basho/${bashoId}/banzuke/${division}`),
  torikumi: (bashoId: string, division: Division, day: number) =>
    get<Torikumi>(`/api/basho/${bashoId}/torikumi/${division}/${day}`),

  /** Ranks recorded for one basho, sorted by rank. NOTE: the API returns at most 100 rows per call. */
  ranksForBasho: (bashoId: string, skip = 0) => get<RankChange[] | null>("/api/ranks", { bashoId, skip }),

  kimarite: (q: { sortField?: "count" | "kimarite" | "lastUsage"; sortOrder?: "asc" | "desc"; limit?: number; skip?: number } = {}) =>
    get<Paged<KimariteStat>>("/api/kimarite", q),

  // NOTE: POST /api/rikishis/matches (bulk head-to-head) returned empty results for known pairs when
  // tested in Nov 2026, so the app uses the per-pair headToHead endpoint instead.
};
