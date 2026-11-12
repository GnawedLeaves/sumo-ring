import Link from "next/link";
import { Suspense } from "react";
import { Portrait } from "@/components/portrait";
import { RikishiName } from "@/components/rikishi-name";
import { VideoPlayer } from "@/components/video-player";
import { ClipAdmin } from "@/components/bout/clip-admin";
import { bashoName } from "@/lib/basho";
import { getClips, getPortraitMap } from "@/lib/content";
import { ageFrom, parseBoutId, pct, record, shikonaOnly, yyyymm } from "@/lib/format";
import { getHeadToHead, getRikishi, getRikishiMatches, getRikishiProfile, getRikishiStats } from "@/lib/sumo-data";
import type { Match } from "@/lib/sumo-api";

type Props = {
  boutId: string;
  /** Use short cache lifetimes (bout is from today's torikumi). */
  live?: boolean;
  /** Compact layout for sidebars (Streams page). */
  compact?: boolean;
};

export async function BoutDetail({ boutId, live = false, compact = false }: Props) {
  const b = parseBoutId(boutId);
  if (!b) return <p className="text-body-sm">Unknown bout.</p>;
  const freshness = live ? "live" : "settled";

  const [eastBasho, westBasho, east, west, eastStats, westStats, eastProfile, westProfile, h2h, portraits] = await Promise.all([
    getRikishiMatches(b.eastId, b.bashoId, freshness),
    getRikishiMatches(b.westId, b.bashoId, freshness),
    getRikishi(b.eastId),
    getRikishi(b.westId),
    getRikishiStats(b.eastId),
    getRikishiStats(b.westId),
    getRikishiProfile(b.eastId),
    getRikishiProfile(b.westId),
    getHeadToHead(b.eastId, b.westId),
    getPortraitMap(),
  ]);

  const bout = eastBasho.find((m) => m.day === b.day && (m.westId === b.westId || m.eastId === b.westId));
  const recordTo = (matches: Match[], id: number) => {
    const upto = matches.filter((m) => m.winnerId && (m.day < b.day || (bout?.winnerId && m.day === b.day)));
    const w = upto.filter((m) => m.winnerId === id).length;
    return record(w, upto.length - w);
  };

  const sides = [
    { id: b.eastId, side: "East", r: east, stats: eastStats, profile: eastProfile, rank: bout?.eastRank ?? east?.currentRank, rec: recordTo(eastBasho, b.eastId), h2hWins: h2h?.rikishiWins ?? 0 },
    { id: b.westId, side: "West", r: west, stats: westStats, profile: westProfile, rank: bout?.westRank ?? west?.currentRank, rec: recordTo(westBasho, b.westId), h2hWins: h2h?.opponentWins ?? 0 },
  ];
  const [e, w] = sides;
  const h2hTotal = e.h2hWins + w.h2hWins;
  // Previous meetings: exclude this bout itself so "history" means before today.
  const previous = (h2h?.matches ?? []).filter((m) => !(m.bashoId === b.bashoId && m.day === b.day));

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-caption font-bold uppercase tracking-wide text-ink-soft">
          {bashoName(b.bashoId)} · Day {b.day}
          {bout ? ` · ${bout.division}` : ""}
        </p>
        {!compact && (
          <Link href={`/bout/${boutId}`} className="link-accent border-electric-teal text-body-sm">
            Open bout page
          </Link>
        )}
      </header>

      {/* Matchup */}
      {/* minmax(0,1fr) lets each side shrink below its content width so long shikona wrap instead of spilling out */}
      <div className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start ${compact ? "gap-2" : "gap-4"}`}>
        {sides.map((s, i) => {
          const won = bout?.winnerId === s.id;
          const decided = Boolean(bout?.winnerId);
          return (
            <div key={s.id} className={`flex min-w-0 flex-col gap-1.5 ${i === 0 ? "items-start" : "col-start-3 items-end text-right"}`}>
              <Portrait id={s.id} en={s.r?.shikonaEn ?? ""} jp={s.r?.shikonaJp} src={portraits[s.id]} size={compact ? "sm" : "lg"} />
              <Link
                href={`/rikishi/${s.id}`}
                className={`max-w-full break-words font-display font-bold leading-tight tracking-tight text-brand hover:underline ${
                  compact ? "text-body" : "text-subheading md:text-heading md:leading-none"
                }`}
              >
                {s.r?.shikonaEn ?? (i === 0 ? bout?.eastShikona : bout?.westShikona)}
              </Link>
              <span className="font-jp text-body-sm">{shikonaOnly(s.r?.shikonaJp)}</span>
              <span className="text-caption text-ink-soft">{s.rank}</span>
              <span className="text-body-sm">
                Basho <strong>{s.rec}</strong>
              </span>
              {decided && (
                <span className={`badge max-w-full break-words ${won ? "" : "bg-surface! text-ink! border border-line"}`}>
                  {won ? `WIN · ${bout?.kimarite}` : "LOSS"}
                </span>
              )}
            </div>
          );
        })}
        <span className={`col-start-2 row-start-1 self-center font-display italic text-brand ${compact ? "text-subheading" : "text-heading"}`}>vs</span>
      </div>

      {/* Head to head */}
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-subheading text-brand">Head-to-head</h3>
        {h2hTotal === 0 ? (
          <p className="text-body-sm">First meeting.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between font-display text-heading font-bold">
              <span>{e.h2hWins}</span>
              <span className="text-caption font-sans font-normal text-ink-soft">{h2hTotal} bouts</span>
              <span>{w.h2hWins}</span>
            </div>
            <div className="flex h-3 border border-line" aria-hidden>
              <div className="bg-cobalt-stage" style={{ width: `${(e.h2hWins / h2hTotal) * 100}%` }} />
              <div className="bg-tangerine-pop" style={{ width: `${(w.h2hWins / h2hTotal) * 100}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-4 break-words text-body-sm">
              <KimariteList who={<RikishiName en={e.r?.shikonaEn ?? "East"} jp={e.r?.shikonaJp} />} rows={Object.entries(h2h?.kimariteWins ?? {})} />
              <KimariteList who={<RikishiName en={w.r?.shikonaEn ?? "West"} jp={w.r?.shikonaJp} />} rows={Object.entries(h2h?.kimariteLosses ?? {})} align="right" />
            </div>
          </>
        )}
      </section>

      {/* Tale of the tape */}
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-subheading text-brand">Tale of the tape</h3>
        <table className="w-full table-fixed border-collapse break-words text-body-sm">
          <tbody>
            {[
              ["Heya", e.r?.heya, w.r?.heya],
              ["Age", ageFrom(e.r?.birthDate), ageFrom(w.r?.birthDate)],
              ["Height", e.r?.height && `${e.r.height} cm`, w.r?.height && `${w.r.height} cm`],
              ["Weight", e.r?.weight && `${e.r.weight} kg`, w.r?.weight && `${w.r.weight} kg`],
              ["Career", e.stats && record(e.stats.totalWins, e.stats.totalLosses), w.stats && record(w.stats.totalWins, w.stats.totalLosses)],
              ["Win rate", e.stats && pct(e.stats.totalWins, e.stats.totalWins + e.stats.totalLosses), w.stats && pct(w.stats.totalWins, w.stats.totalWins + w.stats.totalLosses)],
              ["Makuuchi yūshō", e.stats?.yushoByDivision?.Makuuchi ?? 0, w.stats?.yushoByDivision?.Makuuchi ?? 0],
              ["Top kimarite", e.profile.kimariteWins[0]?.[0], w.profile.kimariteWins[0]?.[0]],
            ].map(([label, a, c]) => (
              <tr key={String(label)} className="border-t border-line">
                <td className="py-2 font-bold">{a ?? "—"}</td>
                <td className="py-2 text-center text-caption uppercase text-ink-soft">{label}</td>
                <td className="py-2 text-right font-bold">{c ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Previous meetings */}
      {previous.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-display text-subheading text-brand">Previous meetings</h3>
          <ul className="divide-y divide-line border-y border-line text-body-sm">
            {previous.slice(0, compact ? 5 : 15).map((m) => (
              <li key={`${m.bashoId}-${m.day}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 py-2 sm:grid-cols-[6rem_minmax(0,1fr)_auto]">
                <span className="text-ink-soft">
                  {yyyymm(m.bashoId)} · D{m.day}
                </span>
                <span className="min-w-0 break-words font-bold">
                  <RikishiName en={m.winnerEn} jp={m.winnerJp || (m.winnerId === b.eastId ? e.r?.shikonaJp : w.r?.shikonaJp)} />
                </span>
                {/* Wraps under the name on narrow widths and in the sidebar */}
                <span className={`text-ink-soft ${compact ? "col-span-2 sm:col-span-3" : "col-span-2 sm:col-span-1 sm:text-right"}`}>{m.kimarite}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Suspense fallback={null}>
        <BoutClips boutId={boutId} eastShikona={e.r?.shikonaEn ?? ""} westShikona={w.r?.shikonaEn ?? ""} />
      </Suspense>
    </article>
  );
}

function KimariteList({ who, rows, align }: { who: React.ReactNode; rows: [string, number][]; align?: "right" }) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-caption text-ink-soft">
        <span className="font-bold">{who}</span> wins by
      </p>
      {rows.length === 0 ? (
        <p>—</p>
      ) : (
        <ul>
          {rows
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => (
              <li key={k}>
                {k} <strong>×{n}</strong>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

async function BoutClips({ boutId, eastShikona, westShikona }: { boutId: string; eastShikona: string; westShikona: string }) {
  const clips = await getClips({ boutId });
  return (
    <section className="flex flex-col gap-3">
      {clips.length > 0 && <h3 className="font-display text-subheading text-brand">Clips</h3>}
      {clips.map((c) => (
        <figure key={c.id} className="flex flex-col gap-2">
          <VideoPlayer url={c.videoUrl} start={c.startSec} end={c.endSec} title={c.title} />
          <figcaption className="text-body-sm">{c.title}</figcaption>
        </figure>
      ))}
      <ClipAdmin boutId={boutId} eastShikona={eastShikona} westShikona={westShikona} clips={clips.map((c) => ({ id: c.id, title: c.title }))} />
    </section>
  );
}
