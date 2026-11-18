// Full-article reader for signed-in users: fetches one source article page on demand, pulls out its paragraphs and
// machine-translates them with DeepL. Nothing is written to the content store — the translation lives only in the
// server's short-lived cache, and the story page shows it to signed-in viewers only (src/app/news/[slug]/page.tsx).
//
// Only outlets whose pages we know how to read are supported; Google News links are encoded redirects that need
// JavaScript to resolve, so those stories use another outlet from the same group when there is one.
import "server-only";
import { cacheLife } from "next/cache";
import type { NewsSource } from "@/lib/content";
import { loadNameTable, romaniseNames, type NameTable } from "./tags";
import { translate, translatorConfigured } from "./translate";

/** Upper bound on Japanese characters sent to DeepL per article (a long feature is ~3,000). */
const MAX_CHARS = 6_000;
/** Yahoo splits long articles over pages; read at most this many. */
const MAX_PAGES = 4;

const NKS = /^https:\/\/www\.nikkansports\.com\/.+\/news\/\d+\.html$/;
const YAHOO = /^https:\/\/news\.yahoo\.co\.jp\/articles\/[0-9a-f]+/;

/** The first source whose article page we can read, or undefined. */
export function readableSource(sources: NewsSource[]): NewsSource | undefined {
  return sources.find((s) => NKS.test(s.url) || YAHOO.test(s.url));
}

const decode = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

async function page(url: string): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SumoRing/1.0; personal news reader)", "Accept-Language": "ja" },
  });
  if (!res.ok) throw new Error(`article page ${res.status}`);
  return res.text();
}

/** Nikkan Sports: plain <p> paragraphs inside <div id="news" class="article-body">. */
function nikkanParagraphs(html: string): string[] {
  const start = html.indexOf('id="news"');
  if (start < 0) return [];
  const body = html.slice(start, html.indexOf("</div>", start));
  return [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => decode(m[1])).filter(Boolean);
}

type YahooState = { articleDetail?: { maxPage?: number; paragraphs?: { textDetails?: { text?: string }[] }[] } };

/** Yahoo! News: the article is in the page's __PRELOADED_STATE__ JSON; paragraphs are split on blank lines. */
function yahooPage(html: string): { paragraphs: string[]; maxPage: number } {
  const json = html.match(/__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/)?.[1];
  if (!json) return { paragraphs: [], maxPage: 1 };
  const d = (JSON.parse(json) as YahooState).articleDetail;
  const text = (d?.paragraphs ?? []).flatMap((p) => (p.textDetails ?? []).map((t) => t.text ?? "")).join("\n\n");
  return {
    paragraphs: text
      .split(/\n{2,}/)
      .map((p) => decode(p).replace(/^　+/, ""))
      .filter(Boolean),
    maxPage: d?.maxPage ?? 1,
  };
}

/** The article's Japanese paragraphs (whole paragraphs up to MAX_CHARS). Throws if the page can't be read or has no text. */
export async function articleParagraphs(url: string): Promise<{ paragraphs: string[]; truncated: boolean }> {
  let paragraphs: string[] = [];
  if (NKS.test(url)) {
    paragraphs = nikkanParagraphs(await page(url));
  } else if (YAHOO.test(url)) {
    const base = url.split("?")[0];
    const first = yahooPage(await page(base));
    paragraphs = first.paragraphs;
    for (let n = 2; n <= Math.min(first.maxPage, MAX_PAGES); n++) paragraphs.push(...yahooPage(await page(`${base}?page=${n}`)).paragraphs);
  } else {
    throw new Error("unsupported outlet");
  }
  if (!paragraphs.length) throw new Error("no article text found (the outlet may have changed its page layout)");

  const kept: string[] = [];
  let chars = 0;
  for (const p of paragraphs) {
    if (chars + p.length > MAX_CHARS && kept.length) break;
    kept.push(p);
    chars += p.length;
  }
  return { paragraphs: kept, truncated: kept.length < paragraphs.length };
}

export type FullText = { ok: true; paragraphs: string[]; truncated: boolean } | { ok: false; error: string };

/**
 * English paragraphs of one source article, cached on the server for a day per URL so repeat views don't spend
 * DeepL quota again. Failures are cached for only a couple of minutes. Never throws (it runs inside `use cache`).
 * Callers must check the viewer is signed in before calling.
 */
export async function getFullTranslation(url: string): Promise<FullText> {
  "use cache";
  try {
    if (!translatorConfigured()) throw new Error("DEEPL_API_KEY is not set");
    const jp = await articleParagraphs(url);
    let names: NameTable = [];
    try {
      names = await loadNameTable();
    } catch {
      // Roster unavailable: translate without romanised shikona.
    }
    const en = await translate(jp.paragraphs.map((p) => romaniseNames(p, names)));
    cacheLife("days");
    return { ok: true, paragraphs: en.map((p) => p.trim()).filter(Boolean), truncated: jp.truncated };
  } catch (e) {
    cacheLife({ stale: 30, revalidate: 60, expire: 120 });
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
