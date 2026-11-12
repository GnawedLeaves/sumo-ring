// Past-basho listing shared by the History page (first page, server-rendered) and
// /api/basho/history (next pages, fetched by infinite scroll).
import "server-only";
import { bashoInfo, bashoName, bashoWindow, formatDateRange, previousBashoIds } from "./basho";
import { getPortraitMap } from "./content";
import type { LiveContext } from "./live";
import { getBashoSummary, type BashoSummary } from "./sumo-data";

/** The Sumo API's records start with Hatsu 1958. */
export const FIRST_BASHO = "195801";
export const HISTORY_PAGE_SIZE = 20;

/** Every finished basho, most recent first. */
export function pastBashoIds(ctx: LiveContext): string[] {
  const all = ctx.active ? previousBashoIds(ctx.bashoId, 600) : [ctx.bashoId, ...previousBashoIds(ctx.bashoId, 600)];
  return all.filter((id) => id >= FIRST_BASHO);
}

export type HistoryItem = {
  id: string;
  name: string;
  jp?: string;
  dates: string;
  location?: string;
  summary: BashoSummary | null;
};

export async function getHistoryPage(ctx: LiveContext, skip: number, limit = HISTORY_PAGE_SIZE) {
  const all = pastBashoIds(ctx);
  const ids = all.slice(skip, skip + limit);
  const [summaries, portraits] = await Promise.all([Promise.all(ids.map((id) => getBashoSummary(id))), getPortraitMap()]);
  const items: HistoryItem[] = ids.map((id, i) => {
    const s = summaries[i];
    const info = bashoInfo(id);
    const w = bashoWindow(id, s?.startDate);
    return { id, name: bashoName(id), jp: info?.jp, dates: formatDateRange(w.start, w.end), location: s?.location ?? info?.city, summary: s };
  });
  // Only send portraits for the rikishi on this page.
  const shown = new Set(items.flatMap((it) => [it.summary?.winner, ...(it.summary?.runnersUp ?? [])].map((r) => r?.rikishiID)));
  const pagePortraits = Object.fromEntries(Object.entries(portraits).filter(([k]) => shown.has(Number(k))));
  return { items, portraits: pagePortraits, total: all.length, nextSkip: skip + ids.length };
}

/** Finished basho grouped by year (newest first), for the jump-to dropdown. */
export function bashoByYear(ctx: LiveContext) {
  const groups: { year: string; basho: { id: string; label: string }[] }[] = [];
  for (const id of pastBashoIds(ctx)) {
    const year = id.slice(0, 4);
    let g = groups.at(-1);
    if (g?.year !== year) groups.push((g = { year, basho: [] }));
    const info = bashoInfo(id);
    g.basho.push({ id, label: `${info?.en ?? id} ${year}${info ? ` · ${info.jp}` : ""}` });
  }
  return groups;
}
