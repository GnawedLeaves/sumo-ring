// Japanese sumo news feeds. Only feeds the publisher offers for syndication — we never crawl their sites.
import "server-only";

export type FeedSource = { id: string; publisher: string; url: string };

export const FEEDS: FeedSource[] = [
  // Verified Nov 2026: Atom, ~20 entries, includes article text.
  { id: "nks", publisher: "Nikkan Sports (日刊スポーツ)", url: "https://www.nikkansports.com/battle/sumo/atom.xml" },
];

export type FeedItem = {
  source: FeedSource;
  /** Stable id used for de-duplication and the article slug, e.g. "nks-202611120001509". */
  key: string;
  title: string;
  link: string;
  publishedAt: string;
  /** Japanese article text (or excerpt), tags stripped. */
  text: string;
};

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1];

/** Minimal Atom + RSS 2.0 parser — enough for news feeds, no dependency. */
function parse(xml: string, source: FeedSource): FeedItem[] {
  const blocks = xml.match(/<entry[\s>][\s\S]*?<\/entry>|<item[\s>][\s\S]*?<\/item>/g) ?? [];
  return blocks
    .map((b) => {
      const link = b.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? decode(tag(b, "link") ?? "");
      const published = tag(b, "published") ?? tag(b, "updated") ?? tag(b, "pubDate") ?? "";
      const text = decode(tag(b, "content") ?? tag(b, "description") ?? tag(b, "summary") ?? "");
      const id = link.split("/").pop()?.replace(/\.html?$/, "").replace(/[^a-zA-Z0-9-]/g, "") ?? "";
      const date = new Date(decode(published));
      return {
        source,
        key: `${source.id}-${id}`,
        title: decode(tag(b, "title") ?? ""),
        link,
        publishedAt: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
        text,
      };
    })
    .filter((i) => i.link && i.title && i.key.length > source.id.length + 1);
}

export async function fetchFeed(source: FeedSource): Promise<FeedItem[]> {
  const res = await fetch(source.url, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: { "User-Agent": "SumoHub/1.0 (news reader; links back to source)" },
  });
  if (!res.ok) throw new Error(`${source.publisher} feed ${res.status}`);
  return parse(await res.text(), source);
}
