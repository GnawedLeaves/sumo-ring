import Link from "next/link";
import { Romaji } from "@/components/jp";
import { RikishiName } from "@/components/rikishi-name";
import { record, shikonaOnly } from "@/lib/format";
import { CopyButton } from "@/components/copy-button";
import { bashoInfo, bashoName } from "@/lib/basho";
import { rankTier, shortRank } from "@/lib/rank";
import type { BanzukeEntry } from "@/lib/sumo-api";

/** Losses including absent days (an absence counts as a loss on the record, as in the official standings). */
const lossesOf = (r: BanzukeEntry) => r.losses + r.absences;

function lossLabel(n: number) {
  return n === 0 ? "Undefeated" : `${n} loss${n === 1 ? "" : "es"}`;
}

/** Ranks from Yokozuna down to Komusubi. */
const SANYAKU = new Set(["Yokozuna", "Ozeki", "Sekiwake", "Komusubi"]);

/**
 * Plain-text summary of the san'yaku (Yokozuna to Komusubi) for sharing, in banzuke order:
 *   Kyushu Basho 2026 Day 9 Standings
 *   Onosato (Y1e) 8 - 1
 * The day is the most bouts anyone has on record, so it always matches the records shown.
 */
function sanyakuText(entries: BanzukeEntry[], bashoId: string, records?: Record<number, { jp?: string }>) {
  const top = entries.filter((r) => SANYAKU.has(rankTier(r.rank))).sort((a, b) => a.rankValue - b.rankValue || (a.side === "East" ? -1 : 1));
  if (top.length === 0) return null;
  const day = Math.max(0, ...entries.map((r) => r.wins + r.losses + r.absences));
  const info = bashoInfo(bashoId);
  const basho = info ? `${info.en} Basho ${bashoId.slice(0, 4)}` : bashoName(bashoId);
  const lines = top.map((r) => {
    // Kanji shikona (without the given name) beside the romaji, when known.
    const jp = shikonaOnly(r.shikonaJp || records?.[r.rikishiID]?.jp);
    return `${r.shikonaEn}${jp ? ` ${jp}` : ""} (${shortRank(r.rank)}) ${r.wins} - ${r.losses}${r.absences ? ` - ${r.absences}` : ""}`;
  });
  return [`${basho}${day ? ` Day ${day}` : ""} Standings`, ...lines].join("\n");
}

/**
 * A division's standings for a basho, grouped by number of losses (fewest first, the way the yūshō race is
 * followed). Within a group: most wins first, then higher rank.
 */
export function Standings({
  entries,
  division,
  bashoId,
  records,
  compact = false,
  title = "Standings",
}: {
  entries: BanzukeEntry[];
  division: string;
  /** Enables the "copy san'yaku standings" button (Makuuchi only). */
  bashoId?: string;
  records?: Record<number, { jp?: string }>;
  /** One line per loss group with name + record chips — a small summary for the top of a page. */
  compact?: boolean;
  title?: string;
}) {
  const shareText = bashoId && division === "Makuuchi" ? sanyakuText(entries, bashoId, records) : null;
  const heading = (
    <h2 className="flex items-baseline justify-between gap-2 font-display text-subheading text-brand">
      <span className="flex items-center gap-1.5">
        {title}
        {shareText && <CopyButton text={shareText} label="Copy Yokozuna–Komusubi standings" />}
      </span>
      <span className="text-caption font-sans font-normal text-ink-soft">
        <Romaji text={division} kind="division" />
      </span>
    </h2>
  );
  const sorted = [...entries].sort((a, b) => lossesOf(a) - lossesOf(b) || b.wins - a.wins || a.rankValue - b.rankValue);
  const groups: [number, BanzukeEntry[]][] = [];
  for (const r of sorted) {
    const last = groups.at(-1);
    if (last && last[0] === lossesOf(r)) last[1].push(r);
    else groups.push([lossesOf(r), [r]]);
  }

  if (compact) {
    return (
      <section className="flex flex-col gap-3 border border-line bg-surface p-4 sm:p-5">
        {heading}
        {sorted.length === 0 ? (
          <p className="text-body-sm text-ink-soft">No records yet.</p>
        ) : (
          <dl className="flex flex-col divide-y divide-line">
            {groups.map(([lost, rows]) => (
              <div key={lost} className="grid gap-2 py-2.5 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
                <dt className="text-caption font-bold uppercase tracking-wide text-ink-soft sm:pt-1">
                  {lossLabel(lost)} <span className="font-normal">· {rows.length}</span>
                </dt>
                <dd className="flex flex-wrap gap-1.5">
                  {rows.map((r) => (
                    <Link
                      key={r.rikishiID}
                      href={`/rikishi/${r.rikishiID}`}
                      title={`${r.shikonaEn} · ${r.rank}`}
                      className="inline-flex items-baseline gap-1.5 border border-line px-2 py-1 text-body-sm hover:bg-hover"
                    >
                      <span className="font-bold">{r.shikonaEn}</span>
                      <span className="text-caption tabular-nums text-ink-soft">{record(r.wins, r.losses, r.absences)}</span>
                    </Link>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-col gap-3">
      {heading}
      {sorted.length === 0 ? (
        <p className="text-body-sm text-ink-soft">No records yet.</p>
      ) : (
        <div className="-mx-2 max-h-[60dvh] overflow-y-auto overscroll-contain text-body-sm lg:max-h-[28rem]">
          {groups.map(([lost, rows]) => (
            <section key={lost} aria-label={lossLabel(lost)}>
              {/* Sticks to the top of the scrolling list while its group is in view. */}
              <h3 className="sticky top-0 z-10 flex items-baseline justify-between border-b border-line bg-surface px-2 pt-3 pb-1 text-caption font-bold uppercase tracking-wide text-ink-soft">
                {lossLabel(lost)}
                <span className="font-normal normal-case">{rows.length}</span>
              </h3>
              <ul>
                {rows.map((r) => (
                  <li key={r.rikishiID} className="flex items-baseline gap-2 border-b border-line px-2 py-1.5 last:border-b-0">
                    <Link href={`/rikishi/${r.rikishiID}`} className="min-w-0 flex-1 truncate font-bold hover:underline">
                      <RikishiName en={r.shikonaEn} jp={r.shikonaJp || records?.[r.rikishiID]?.jp} />
                    </Link>
                    <span className="shrink-0 text-caption text-ink-soft">{shortRank(r.rank)}</span>
                    <span className="w-12 shrink-0 text-right font-bold tabular-nums">{record(r.wins, r.losses, r.absences)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
