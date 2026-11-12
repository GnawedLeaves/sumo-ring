// News ingest job: read Japanese sumo feeds -> skip items already stored -> write English briefs with
// Claude -> save to the content store (Hygraph). Triggered by /api/cron/news (Render Cron Job).
import "server-only";
import { store } from "@/lib/content";
import { FEEDS, fetchFeed, type FeedItem } from "./feeds";
import { summarize, summarizerConfigured } from "./summarize";

/** Cap per run so one run can't burn through API budget (feeds hold ~20 items). */
const MAX_PER_RUN = 5;

export type IngestReport = {
  fetched: number;
  alreadyStored: number;
  created: { slug: string; title: string }[];
  skipped: { key: string; reason: string }[];
  errors: string[];
  dryRun: boolean;
};

export async function ingestNews({ dryRun = false, limit = MAX_PER_RUN } = {}): Promise<IngestReport> {
  const report: IngestReport = { fetched: 0, alreadyStored: 0, created: [], skipped: [], errors: [], dryRun };

  const items: FeedItem[] = [];
  for (const feed of FEEDS) {
    try {
      items.push(...(await fetchFeed(feed)));
    } catch (e) {
      report.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  report.fetched = items.length;

  let existing: Set<string>;
  try {
    existing = new Set((await store.listNews()).map((n) => n.slug));
  } catch (e) {
    report.errors.push(`Can't read stored news (is the NewsArticle model set up in Hygraph?): ${e instanceof Error ? e.message : e}`);
    return report;
  }
  const fresh = items.filter((i) => !existing.has(i.key)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  report.alreadyStored = items.length - fresh.length;

  const batch = fresh.slice(0, Math.min(limit, MAX_PER_RUN));
  if (dryRun) {
    report.skipped = batch.map((i) => ({ key: i.key, reason: `dry run — would summarise "${i.title}"` }));
    return report;
  }
  if (!summarizerConfigured()) {
    report.errors.push("ANTHROPIC_API_KEY is not set — nothing summarised");
    return report;
  }

  // Sequential on purpose: small batches, and it keeps API usage predictable.
  for (const item of batch) {
    try {
      const brief = await summarize(item);
      if (!brief) {
        report.skipped.push({ key: item.key, reason: "model declined" });
        continue;
      }
      await store.createNews({
        slug: item.key,
        title: brief.title,
        summary: brief.summary,
        body: brief.body,
        tags: [...new Set(brief.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 6),
        sources: [{ title: item.title, url: item.link, publisher: item.source.publisher }],
        publishedAt: item.publishedAt,
      });
      report.created.push({ slug: item.key, title: brief.title });
    } catch (e) {
      report.errors.push(`${item.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return report;
}
