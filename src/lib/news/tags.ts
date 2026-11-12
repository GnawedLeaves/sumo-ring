// Rule-based tagging and shikona romanisation for Japanese sumo headlines. No AI: keyword rules plus the
// kanji -> English shikona table from the Sumo API.
import "server-only";
import { getActiveIndex } from "@/lib/sumo-data";

/** Topic tag -> Japanese keywords (matched against headline + lead). Order = display priority. */
const TOPICS: [tag: string, pattern: RegExp][] = [
  ["Yusho race", /優勝/],
  ["Retirement", /引退|断髪|年寄襲名/],
  ["Injury", /休場|負傷|けが|ケガ|怪我|診断書|途中出場|再出場/],
  ["Promotion", /昇進|昇格|新入幕|新十両|再入幕|新三役|伝達式/],
  ["Banzuke", /番付/],
  ["Kinboshi", /金星/],
  ["Results", /\d+勝目|[０-９\d]+勝|白星|黒星|連勝|連敗|全勝|勝ち越し|負け越し|勝ち越|負け越|初日|千秋楽|取組/],
  ["Yokozuna", /横綱/],
  ["Ozeki", /大関/],
  ["Kyokai", /相撲協会|理事|審判部|八角/],
  ["Stables", /部屋/],
  ["Debut", /初土俵|新弟子|入門|前相撲/],
];

const MAX_TAGS = 6;

export type NameTable = { jp: string; en: string }[];

/** Old / variant kanji the Sumo API uses for some shikona (琴櫻, 髙安) vs the forms newspapers print. */
const VARIANTS: Record<string, string> = { 櫻: "桜", 髙: "高", 﨑: "崎", 德: "徳", 國: "国", 濵: "浜", 邊: "辺", 邉: "辺", 嶋: "島", 龍: "竜", 冨: "富", 澤: "沢", 齋: "斎", 齊: "斉" };
const VARIANT_RE = new RegExp(`[${Object.keys(VARIANTS).join("")}]`, "g");

/** Folds width and kanji variants so names match however an outlet spells them. Apply to both sides. */
export const fold = (s: string) => s.normalize("NFKC").replace(VARIANT_RE, (c) => VARIANTS[c]);

/**
 * Makuuchi + Juryo shikona, longest kanji first so "若元春" wins over shorter overlaps.
 * Lower divisions are left out: their names are rarely in the news and more likely to collide with ordinary words.
 */
export async function loadNameTable(): Promise<NameTable> {
  const index = await getActiveIndex();
  return index
    .filter((r) => ["Yokozuna", "Ozeki", "Sekiwake", "Komusubi", "Maegashira", "Juryo"].includes(r.tier) && r.jp && r.en)
    .map((r) => ({ jp: fold(r.jp.split(" ")[0]), en: r.en }))
    .filter((r) => r.jp.length >= 2)
    .sort((a, b) => b.jp.length - a.jp.length);
}

/** English shikona of rikishi named in the text, in order of first appearance. */
export function findRikishi(text: string, names: NameTable): string[] {
  const hits: { en: string; at: number }[] = [];
  let rest = fold(text);
  for (const n of names) {
    const at = rest.indexOf(n.jp);
    if (at < 0) continue;
    hits.push({ en: n.en, at });
    rest = rest.split(n.jp).join("　".repeat(n.jp.length)); // blank it so shorter names can't re-match inside
  }
  return [...new Set(hits.sort((a, b) => a.at - b.at).map((h) => h.en))];
}

/**
 * Swaps kanji shikona for their official romanisation before machine translation, so "豊昇龍" comes out as
 * "Hoshoryu" rather than a literal reading.
 */
export function romaniseNames(text: string, names: NameTable): string {
  let out = fold(text);
  for (const n of names) out = out.split(n.jp).join(` ${n.en} `);
  return out.replace(/ {2,}/g, " ").trim();
}

export function tagStory(text: string, names: NameTable): string[] {
  const topics = TOPICS.filter(([, re]) => re.test(text)).map(([t]) => t);
  const rikishi = findRikishi(text, names).slice(0, 3);
  // Keep at least the first two topics, then rikishi, then any remaining topics.
  return [...new Set([...topics.slice(0, 2), ...rikishi, ...topics.slice(2)])].slice(0, MAX_TAGS);
}
