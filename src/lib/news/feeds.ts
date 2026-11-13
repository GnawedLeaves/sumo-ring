// Japanese sumo news feeds. Only feeds the publishers / aggregators offer for syndication — we never crawl
// article pages. Verified Nov 2026.
import "server-only";
import { createHash } from "node:crypto";

export type FeedSource = {
  id: string;
  /** Shown when an item doesn't name its own publisher. */
  publisher: string;
  url: string;
  /** General sports feed: keep only items that look like sumo news. */
  filter?: boolean;
  /** Publisher names to drop (aggregators mix in video sites, TV listings, etc.). */
  exclude?: RegExp;
};

export const FEEDS: FeedSource[] = [
  // Atom, ~20 sumo-only entries with a 2–3 sentence lead.
  { id: "nks", publisher: "Nikkan Sports (日刊スポーツ)", url: "https://www.nikkansports.com/battle/sumo/atom.xml" },
  // Google News search for 大相撲 over the last 7 days: ~100 headlines from many outlets (Jiji, NHK, Sponichi,
  // Hochi, Sanspo, Yomiuri…). Headlines only, links go through news.google.com.
  {
    id: "gn",
    publisher: "Google News",
    url: "https://news.google.com/rss/search?q=%E5%A4%A7%E7%9B%B8%E6%92%B2+when:7d&hl=ja&gl=JP&ceid=JP:ja",
    // Video sites, and NHK's broadcast pages (schedules, clips) as opposed to NHK news.
    exclude: /youtube|ニコニコ|abema|^NHK( ONE)?$|大相撲公式ファンクラブ/i,
  },
  // Yahoo! News per-outlet feeds (all sports, so filtered) — headline + short lead.
  { id: "tsp", publisher: "Tokyo Sports (東スポWEB)", url: "https://news.yahoo.co.jp/rss/media/tospoweb/all.xml", filter: true },
  { id: "spn", publisher: "Sponichi Annex (スポニチ)", url: "https://news.yahoo.co.jp/rss/media/spnannex/all.xml", filter: true },
];

export type FeedItem = {
  source: FeedSource;
  /** Stable id used for de-duplication and the article slug, e.g. "nks-202611120001509". */
  key: string;
  /** Japanese headline, publisher suffixes stripped. */
  title: string;
  link: string;
  publisher: string;
  publishedAt: string;
  /** Japanese lead / excerpt, tags stripped. Empty for headline-only feeds. */
  text: string;
};

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))?.[1];

/** Looks like sumo news (for general sports feeds). Avoids bare 場所 / 横綱 metaphors by requiring sumo vocabulary. */
const SUMO = /大相撲|相撲|力士|大関|関脇|小結|幕内|十両|幕下|親方|番付|土俵|(初|春|夏|名古屋|秋|九州)場所|横綱(?!級)/;

/** Short, URL-safe id for a link: the article's own id when it has a clean one, else a hash. */
function linkId(link: string) {
  const last = link.split("?")[0].split("/").filter(Boolean).pop()?.replace(/\.html?$/, "") ?? "";
  return /^[\w-]{6,40}$/.test(last) ? last : createHash("sha1").update(link).digest("hex").slice(0, 16);
}

/** Minimal Atom + RSS 2.0 parser — enough for news feeds, no dependency. */
function parse(xml: string, source: FeedSource): FeedItem[] {
  const blocks = xml.match(/<entry[\s>][\s\S]*?<\/entry>|<item[\s>][\s\S]*?<\/item>/g) ?? [];
  const items: FeedItem[] = [];
  for (const b of blocks) {
    const link = (b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) ?? b.match(/<link[^>]*href="([^"]+)"/))?.[1] ?? decode(tag(b, "link") ?? "");
    const published = tag(b, "published") ?? tag(b, "updated") ?? tag(b, "pubDate") ?? "";
    const date = new Date(decode(published));
    let title = decode(tag(b, "title") ?? "");
    let publisher = decode(tag(b, "source") ?? "") || source.publisher;
    const text = source.id === "gn" ? "" : decode(tag(b, "content") ?? tag(b, "description") ?? tag(b, "summary") ?? "");

    if (source.id === "gn") {
      // "見出し（東スポWEB） - Yahoo!ニュース" -> headline + real publisher
      title = title.replace(/\s+-\s+[^-]+$/, "");
    }
    // Yahoo appends "(publisher)" to headlines.
    const paren = title.match(/[（(]([^（()）]+)[)）]\s*$/);
    if (paren && (source.filter || /yahoo/i.test(publisher))) {
      title = title.slice(0, paren.index).trim();
      if (/yahoo/i.test(publisher)) publisher = paren[1];
    }

    if (!link || !title || Number.isNaN(date.getTime())) continue;
    if (source.exclude?.test(publisher)) continue;
    // All-sports feeds: the headline must look like sumo, or the lead must say 大相撲 outright — a stray 大関 or
    // 土俵 in the lead of a boat-racing or entertainment story isn't enough.
    if (source.filter && !SUMO.test(title) && !/大相撲/.test(text)) continue;
    if (source.id === "gn" && (!SUMO.test(title) || /大相撲中継|動画|の一番】/.test(title))) continue;

    items.push({ source, key: `${source.id}-${linkId(link)}`, title, link, publisher, publishedAt: date.toISOString(), text });
  }
  return items;
}

export async function fetchFeed(source: FeedSource): Promise<FeedItem[]> {
  const res = await fetch(source.url, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: { "User-Agent": "SumoRing/1.0 (news reader; links back to source)" },
  });
  if (!res.ok) throw new Error(`${source.publisher} feed ${res.status}`);
  return parse(await res.text(), source);
}
