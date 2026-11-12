// News ingest job (no AI): read Japanese sumo feeds -> group the same story across outlets -> skip stories
// already stored (adding any new outlets to them) -> tag by keyword rules -> machine-translate the headline and
// a short lead with DeepL -> save to the content store (Hygraph). Triggered by /api/cron/news (Render Cron Job).
//
// Only the headline and a ~150-character lead are translated and shown; readers follow the source links for
// the full story. Republishing whole translated articles would copy the outlets' copyrighted text.
import "server-only";
import { store, type NewsArticle, type NewsSource } from "@/lib/content";
import { cluster, normTitle, sameStory, type Comparable } from "./cluster";
import { FEEDS, fetchFeed, type FeedItem } from "./feeds";
import { findRikishi, loadNameTable, romaniseNames, tagStory, type NameTable } from "./tags";
import { translate, translatorConfigured } from "./translate";

/** Cap per run so a backlog can't burn through the DeepL quota (~200 source characters per story). */
const MAX_PER_RUN = 30;
/** Ignore items older than this (first run / feeds that keep old entries). */
const MAX_AGE_DAYS = 7;
/** Japanese characters of lead text to translate and show. */
const LEAD_CHARS = 150;

/** Preference when choosing which item's headline/lead represents a story. */
const SOURCE_RANK: Record<string, number> = { nks: 0, spn: 1, tsp: 2, gn: 3 };

export type IngestReport = {
  fetched: number;
  stories: number;
  alreadyStored: number;
  created: { slug: string; title: string; tags: string[]; sources: number }[];
  sourcesAdded: { slug: string; added: number }[];
  skipped: { key: string; reason: string }[];
  errors: string[];
  dryRun: boolean;
};

type Item = FeedItem & Comparable;

/** First sentences of the lead up to LEAD_CHARS, ending on a full stop where possible. */
function lead(text: string): string {
  const t = text.replace(/\s*…\s*$/, "").trim();
  if (t.length <= LEAD_CHARS) return t;
  const cut = t.slice(0, LEAD_CHARS);
  const stop = cut.lastIndexOf("。");
  return stop > 40 ? cut.slice(0, stop + 1) : `${cut}…`;
}

const toSource = (i: FeedItem): NewsSource => ({ title: i.title, url: i.link, publisher: i.publisher });

export async function ingestNews({ dryRun = false, limit = MAX_PER_RUN } = {}): Promise<IngestReport> {
  const report: IngestReport = { fetched: 0, stories: 0, alreadyStored: 0, created: [], sourcesAdded: [], skipped: [], errors: [], dryRun };

  // 1. Feeds
  const raw: FeedItem[] = [];
  for (const feed of FEEDS) {
    try {
      raw.push(...(await fetchFeed(feed)));
    } catch (e) {
      report.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  report.fetched = raw.length;

  let names: NameTable = [];
  try {
    names = await loadNameTable();
  } catch (e) {
    report.errors.push(`Sumo API roster unavailable — no rikishi tags or name romanisation: ${e instanceof Error ? e.message : e}`);
  }

  const minTime = Date.now() - MAX_AGE_DAYS * 86_400_000;
  const items: Item[] = raw
    .map((i) => ({ ...i, norm: normTitle(i.title), time: Date.parse(i.publishedAt), rikishi: findRikishi(i.title, names) }))
    .filter((i) => i.time >= minTime && i.norm.length >= 6)
    // Best sources first, so they lead their group.
    .sort((a, b) => SOURCE_RANK[a.source.id] - SOURCE_RANK[b.source.id] || b.text.length - a.text.length);

  // 2. Group the same story across outlets; drop exact duplicate links inside a group.
  // (The same article often arrives twice — e.g. from Yahoo directly and via Google News — so also by headline.)
  const stories = cluster(items).map((g) => g.filter((x, i) => g.findIndex((y) => y.link === x.link || y.norm === x.norm) === i));
  report.stories = stories.length;

  // 3. Match against stored articles
  let existing: NewsArticle[] = [];
  try {
    existing = await store.listNews();
  } catch (e) {
    const msg = `Can't read stored news (is the NewsArticle model set up in Hygraph?): ${e instanceof Error ? e.message : e}`;
    if (!dryRun) {
      report.errors.push(msg);
      return report;
    }
    report.skipped.push({ key: "-", reason: `${msg} — dry run continues as if nothing is stored` });
  }
  const stored = existing.map((a) => ({
    article: a,
    links: new Set(a.sources.map((s) => s.url)),
    comparables: a.sources.map((s) => ({ norm: normTitle(s.title), time: Date.parse(a.publishedAt), rikishi: findRikishi(s.title, names) })),
  }));

  const fresh: Item[][] = [];
  for (const story of stories) {
    const match = stored.find(
      (s) => story.some((i) => s.article.slug === i.key || s.links.has(i.link)) || story.some((i) => s.comparables.some((c) => sameStory(c, i))),
    );
    if (!match) {
      fresh.push(story);
      continue;
    }
    report.alreadyStored++;
    // New outlets covering a stored story: add them as extra sources.
    const extra = story.filter((i) => !match.links.has(i.link) && !match.article.sources.some((s) => normTitle(s.title) === i.norm));
    if (extra.length && !dryRun) {
      try {
        const sources = [...match.article.sources, ...extra.map(toSource)];
        await store.updateNewsSources(match.article.id, sources);
        match.article.sources = sources;
        extra.forEach((i) => match.links.add(i.link));
        report.sourcesAdded.push({ slug: match.article.slug, added: extra.length });
      } catch (e) {
        report.errors.push(`${match.article.slug}: adding sources failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else if (extra.length) {
      report.sourcesAdded.push({ slug: match.article.slug, added: extra.length });
    }
  }

  // Newest first; a story's time is its earliest report.
  const storyTime = (s: Item[]) => Math.min(...s.map((i) => i.time));
  const batch = fresh.sort((a, b) => storyTime(b) - storyTime(a)).slice(0, Math.min(limit, MAX_PER_RUN));

  // 4. Tag + translate
  const prepared = batch.map((story) => {
    const main = story[0];
    const jpLead = lead(story.find((i) => i.text)?.text ?? "");
    return { story, main, jpLead, tags: tagStory(`${main.title} ${story.map((i) => i.title).join(" ")} ${jpLead}`, names) };
  });

  if (dryRun) {
    report.skipped.push(
      ...prepared.map((p) => ({
        key: p.main.key,
        reason: `dry run — would translate "${p.main.title}" [${p.tags.join(", ")}] (${p.story.length} source${p.story.length > 1 ? "s" : ""}: ${p.story.map((i) => `${i.publisher}: ${i.title}`).join(" | ")})`,
      })),
    );
    return report;
  }
  if (!prepared.length) return report;
  if (!translatorConfigured()) {
    report.errors.push("DEEPL_API_KEY is not set — nothing translated");
    return report;
  }

  // One DeepL call for every headline and lead (empty leads are not sent).
  const texts = prepared.flatMap((p) => [romaniseNames(p.main.title, names), romaniseNames(p.jpLead, names)]);
  const english = texts.map(() => "");
  try {
    const sent = texts.map((t, i) => ({ t, i })).filter((x) => x.t);
    const out = await translate(sent.map((x) => x.t));
    sent.forEach((x, k) => (english[x.i] = out[k]?.trim() ?? ""));
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : String(e));
    return report;
  }

  // 5. Save
  for (const [n, p] of prepared.entries()) {
    const title = english[n * 2];
    const summary = english[n * 2 + 1];
    if (!title) {
      report.skipped.push({ key: p.main.key, reason: "empty translation" });
      continue;
    }
    try {
      await store.createNews({
        slug: p.main.key,
        title,
        summary,
        body: "",
        tags: p.tags,
        sources: p.story.map(toSource),
        publishedAt: new Date(storyTime(p.story)).toISOString(),
      });
      report.created.push({ slug: p.main.key, title, tags: p.tags, sources: p.story.length });
    } catch (e) {
      report.errors.push(`${p.main.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return report;
}
