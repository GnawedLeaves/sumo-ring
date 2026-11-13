import Link from "next/link";
import { Romaji } from "@/components/jp";
import { RikishiName } from "@/components/rikishi-name";
import { record } from "@/lib/format";
import { shortRank } from "@/lib/rank";
import type { BanzukeEntry } from "@/lib/sumo-api";

/**
 * A division's standings for a basho: every rikishi's record, best first (most wins, then fewest losses, then
 * higher rank). Ties on record share a position number.
 */
export function Standings({ entries, division, records }: { entries: BanzukeEntry[]; division: string; records?: Record<number, { jp?: string }> }) {
  const sorted = [...entries].sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.rankValue - b.rankValue);
  const key = (r: BanzukeEntry) => `${r.wins}-${r.losses}-${r.absences}`;
  // Same record = same position (1, 2, 2, 4…): each row takes the index of the first row with its record.
  const positions = sorted.map((r, i) => sorted.findIndex((s) => key(s) === key(r)) + 1 || i + 1);
  return (
    <section className="flex min-h-0 flex-col gap-3">
      <h2 className="flex items-baseline justify-between gap-2 font-display text-subheading text-brand">
        Standings
        <span className="text-caption font-sans font-normal text-ink-soft">
          <Romaji text={division} kind="division" />
        </span>
      </h2>
      {sorted.length === 0 ? (
        <p className="text-body-sm text-ink-soft">No records yet.</p>
      ) : (
        <ol className="-mx-2 max-h-[60dvh] overflow-y-auto overscroll-contain text-body-sm lg:max-h-[28rem]">
          {sorted.map((r, i) => {
            return (
              <li key={r.rikishiID} className="flex items-baseline gap-2 border-b border-line px-2 py-1.5 last:border-b-0">
                <span className="w-6 shrink-0 text-right text-caption tabular-nums text-ink-soft">{positions[i]}</span>
                <Link href={`/rikishi/${r.rikishiID}`} className="min-w-0 flex-1 truncate font-bold hover:underline">
                  <RikishiName en={r.shikonaEn} jp={r.shikonaJp || records?.[r.rikishiID]?.jp} />
                </Link>
                <span className="shrink-0 text-caption text-ink-soft">{shortRank(r.rank)}</span>
                <span className="w-12 shrink-0 text-right font-bold tabular-nums">{record(r.wins, r.losses, r.absences)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
