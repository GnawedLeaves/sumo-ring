// Groups feed items that report the same story (different outlets, different headlines) so the news page
// shows one article with several source links. Plain string similarity on the Japanese headlines — no AI.

/** Headline reduced to its content characters. */
export function normTitle(title: string): string {
  return title
    .normalize("NFKC")
    .replace(/【[^】]*】|\[[^\]]*\]|[(（][^)）]*[)）]\s*$/g, "")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Sørensen–Dice coefficient over character bigrams, 0..1. */
export function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  const total = [...A.values(), ...B.values()].reduce((x, y) => x + y, 0);
  if (!total) return 0;
  let shared = 0;
  for (const [g, n] of A) shared += Math.min(n, B.get(g) ?? 0);
  return (2 * shared) / total;
}

/** Only items this close in time can be the same story (a yokozuna is in the news every day of a basho). */
const WINDOW_MS = 36 * 3600_000;
const DAY_MS = 24 * 3600_000;
/** Events rare enough that one rikishi + one event + one day = one story. */
const EVENTS = /金星|優勝|休場|引退|断髪|昇進|新入幕|新十両|全勝/g;

export type Comparable = { norm: string; time: number; rikishi: string[] };

/**
 * Same story when headlines are clearly alike, or moderately alike and about the same rikishi.
 * Checked against live Nikkan / Sponichi / Tokyo Sports / Google News headlines (Nov 2026).
 */
export function sameStory(a: Comparable, b: Comparable): boolean {
  const gap = Math.abs(a.time - b.time);
  if (gap > WINDOW_MS) return false;
  const s = similarity(a.norm, b.norm);
  if (s >= 0.5) return true;
  const shared = a.rikishi.filter((r) => b.rikishi.includes(r)).length;
  // Two rikishi in both headlines on the same day = the same bout (one pairing per day).
  if (shared >= 2 && gap <= DAY_MS) return true;
  // Same rikishi + same rare event on the same day ("豊昇龍…金星配給" from two outlets).
  if (shared >= 1 && gap <= DAY_MS) {
    const ev = (n: string) => new Set(n.match(EVENTS) ?? []);
    const ea = ev(a.norm);
    if ([...ev(b.norm)].some((e) => ea.has(e))) return true;
  }
  return s >= 0.3 && shared >= 1;
}

/**
 * Clustering, preserving input order inside each group. An item joins the matching group whose headlines
 * it is most similar to, so a story about the same rikishi on the same day doesn't swallow its neighbour.
 */
export function cluster<T extends Comparable>(items: T[]): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    let best: T[] | undefined;
    let bestScore = -1;
    for (const grp of groups) {
      if (!grp.some((x) => sameStory(x, item))) continue;
      const score = Math.max(...grp.map((x) => similarity(x.norm, item.norm)));
      if (score > bestScore) [best, bestScore] = [grp, score];
    }
    if (best) best.push(item);
    else groups.push([item]);
  }
  return groups;
}
