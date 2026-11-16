// Rank helpers. The API exposes rank strings like "Maegashira 1 East" and, in rank history, a
// numeric rankValue where lower is higher (101 = Yokozuna 1 East, 501 = M1E, 604 = J4W...).

export const RANK_TIERS = [
  "Yokozuna",
  "Ozeki",
  "Sekiwake",
  "Komusubi",
  "Maegashira",
  "Juryo",
  "Makushita",
  "Sandanme",
  "Jonidan",
  "Jonokuchi",
  "Mae-zumo",
] as const;
export type RankTier = (typeof RANK_TIERS)[number] | "Unranked";

export const RANK_JP: Record<string, string> = {
  Yokozuna: "横綱",
  Ozeki: "大関",
  Sekiwake: "関脇",
  Komusubi: "小結",
  Maegashira: "前頭",
  Juryo: "十両",
  Makushita: "幕下",
  Sandanme: "三段目",
  Jonidan: "序二段",
  Jonokuchi: "序ノ口",
  "Mae-zumo": "前相撲",
};

export function rankTier(rank?: string): RankTier {
  if (!rank) return "Unranked";
  const word = rank.split(" ")[0];
  const tier = RANK_TIERS.find((t) => t.toLowerCase() === word.toLowerCase());
  return tier ?? "Unranked";
}

/** Sortable value for a rank string; lower is higher. Mirrors the API's rankValue scheme. */
export function rankValue(rank?: string): number {
  if (!rank) return 99_999;
  const tier = rankTier(rank);
  if (tier === "Unranked") return 99_999;
  const tierIndex = RANK_TIERS.indexOf(tier) + 1;
  const num = Number(rank.match(/\d+/)?.[0] ?? 1);
  const west = /west/i.test(rank) ? 0.5 : 0;
  return tierIndex * 100 + num + west;
}

/** "Maegashira 1 East" -> "M1e" style short label used in dense lists. */
export function shortRank(rank?: string): string {
  if (!rank) return "—";
  const tier = rankTier(rank);
  const num = rank.match(/\d+/)?.[0] ?? "";
  const side = /east/i.test(rank) ? "e" : /west/i.test(rank) ? "w" : "";
  const abbr: Record<string, string> = {
    Yokozuna: "Y",
    Ozeki: "O",
    Sekiwake: "S",
    Komusubi: "K",
    Maegashira: "M",
    Juryo: "J",
    Makushita: "Ms",
    Sandanme: "Sd",
    Jonidan: "Jd",
    Jonokuchi: "Jk",
  };
  return `${abbr[tier] ?? rank}${num}${side}`;
}

type BoutLike = { bashoId: string; day: number; division: string; matchNo: number; winnerId: number; eastId: number; westId: number; eastRank: string; westRank: string };

/**
 * Newest bout first; within a day Makuuchi before Juryo (and lower divisions), each by the winner's
 * rank, Yokozuna down. Used for "recent wins" lists and clips of a technique.
 */
export function compareRecentBouts(a: BoutLike, b: BoutLike): number {
  const div = (m: BoutLike) => ["Makuuchi", "Juryo"].indexOf(m.division) >>> 0; // unknown divisions sort last
  const winnerRank = (m: BoutLike) => rankValue(m.winnerId === m.westId ? m.westRank : m.eastRank);
  return (
    b.bashoId.localeCompare(a.bashoId) ||
    b.day - a.day ||
    div(a) - div(b) ||
    winnerRank(a) - winnerRank(b) ||
    b.matchNo - a.matchNo
  );
}
