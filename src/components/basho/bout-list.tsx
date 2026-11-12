import Link from "next/link";
import { RikishiName } from "@/components/rikishi-name";
import { boutId, record } from "@/lib/format";
import { shortRank } from "@/lib/rank";
import type { Match } from "@/lib/sumo-api";

type Records = Record<number, { wins: number; losses: number; absences: number; jp?: string }>;

/**
 * Sidebar list of a day's bouts (like sumostats.com/live). Decided bouts fade out and show the result;
 * `hrefFor` decides where clicking a bout goes (usually the same page with ?bout=).
 */
export function BoutList({
  bouts,
  records,
  selected,
  currentId,
  hrefFor,
}: {
  bouts: Match[];
  records?: Records;
  selected?: string;
  currentId?: string;
  hrefFor: (id: string) => string;
}) {
  if (!bouts.length) return <p className="p-4 text-body-sm">No bouts published for this day yet.</p>;
  return (
    <ol className="divide-y divide-line">
      {bouts.map((m) => {
        const id = boutId(m);
        const decided = Boolean(m.winnerId);
        const isSel = id === selected;
        const isNow = id === currentId;
        const side = (rid: number, name: string, rank: string) => {
          const rec = records?.[rid];
          const won = m.winnerId === rid;
          return (
            <span className={`flex items-baseline justify-between gap-2 ${won ? "font-bold" : ""}`}>
              <span className="truncate">
                {won && <span aria-label="winner">● </span>}
                <RikishiName en={name} jp={rec?.jp ?? (won ? m.winnerJp : undefined)} />{" "}
                <span className="text-caption font-normal text-ink-soft">{shortRank(rank)}</span>
              </span>
              {rec && <span className="shrink-0 text-caption font-normal">{record(rec.wins, rec.losses, rec.absences)}</span>}
            </span>
          );
        };
        return (
          <li key={id}>
            <Link
              href={hrefFor(id)}
              scroll={false}
              aria-current={isSel ? "true" : undefined}
              className={`flex flex-col gap-0.5 px-4 py-3 text-body-sm ${isSel ? "bg-surface outline-2 -outline-offset-2 outline-brand" : "hover:bg-hover"} ${
                decided && !isSel ? "opacity-50" : ""
              }`}
            >
              <span className="flex items-center justify-between text-caption text-ink-soft">
                #{m.matchNo}
                {isNow && <span className="badge">NOW</span>}
                {decided && <span>{m.kimarite}</span>}
              </span>
              {side(m.eastId, m.eastShikona, m.eastRank)}
              {side(m.westId, m.westShikona, m.westRank)}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
