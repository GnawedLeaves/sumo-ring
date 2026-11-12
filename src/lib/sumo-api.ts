// Typed client for the Sumo API — see docs/API.md
const BASE_URL = process.env.SUMO_API_BASE_URL ?? "https://sumo-api.com";

export const DIVISIONS = ["Makuuchi", "Juryo", "Makushita", "Sandanme", "Jonidan", "Jonokuchi"] as const;
export type Division = (typeof DIVISIONS)[number];

type Query = Record<string, string | number | boolean | undefined>;

async function get<T>(path: string, query: Query = {}, revalidate = 300): Promise<T> {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`Sumo API ${res.status} for ${url.pathname}`);
  return res.json() as Promise<T>;
}

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

// Response shapes are left loose until we inspect real payloads.
export type Rikishi = { id: number; shikonaEn: string; shikonaJp?: string; currentRank?: string; heya?: string } & Record<string, unknown>;
export type Match = Record<string, unknown>;

export const sumoApi = {
  rikishis: (q: RikishiQuery = {}) => get<{ records: Rikishi[]; total?: number }>("/api/rikishis", q),
  rikishi: (id: number, q: HistoryFlags = {}) => get<Rikishi>(`/api/rikishi/${id}`, q),
  rikishiStats: (id: number) => get<Record<string, unknown>>(`/api/rikishi/${id}/stats`),
  rikishiMatches: (id: number, bashoId?: string) => get<{ records: Match[] }>(`/api/rikishi/${id}/matches`, { bashoId }),
  headToHead: (id: number, opponentId: number, bashoId?: string) =>
    get<Record<string, unknown>>(`/api/rikishi/${id}/matches/${opponentId}`, { bashoId }),

  basho: (bashoId: string) => get<Record<string, unknown>>(`/api/basho/${bashoId}`),
  banzuke: (bashoId: string, division: Division) => get<Record<string, unknown>>(`/api/basho/${bashoId}/banzuke/${division}`),
  // Live torikumi changes during the day, so keep the cache short.
  torikumi: (bashoId: string, division: Division, day: number) =>
    get<Record<string, unknown>>(`/api/basho/${bashoId}/torikumi/${division}/${day}`, {}, 30),

  kimarite: (q: { sortField?: "count" | "kimarite" | "lastUsage"; sortOrder?: "asc" | "desc"; limit?: number; skip?: number } = {}) =>
    get<Record<string, unknown>>("/api/kimarite", q),
  kimariteMatches: (kimarite: string, q: { sortOrder?: "asc" | "desc"; limit?: number; skip?: number } = {}) =>
    get<Record<string, unknown>>(`/api/kimarite/${encodeURIComponent(kimarite)}`, q),

  bulkHeadToHead: async (pairs: { key: string; ids: [number, number]; limit?: number; skip?: number; sortOrder?: "asc" | "desc" }[]) => {
    const res = await fetch(new URL("/api/rikishis/matches", BASE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pairs),
    });
    if (!res.ok) throw new Error(`Sumo API ${res.status} for bulk head-to-head`);
    return res.json() as Promise<Record<string, unknown>>;
  },
};
