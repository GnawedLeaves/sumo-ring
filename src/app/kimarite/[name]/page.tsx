import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RikishiName } from "@/components/rikishi-name";
import { Romaji } from "@/components/jp";
import { bashoName } from "@/lib/basho";
import { boutId } from "@/lib/format";
import { KIMARITE, KIMARITE_CATEGORIES, capitalise, findKimarite } from "@/lib/kimarite";
import type { Match } from "@/lib/sumo-api";
import type { Clip } from "@/lib/content/types";
import { getKimariteBouts, getKimariteStats } from "@/lib/sumo-data";
import { getClips } from "@/lib/content";
import { VideoPlayer } from "@/components/video-player";
import { Spinner } from "@/components/spinner";

const fmt = new Intl.NumberFormat("en-GB");

export async function generateMetadata({ params }: PageProps<"/kimarite/[name]">): Promise<Metadata> {
  const k = findKimarite((await params).name);
  return k
    ? { title: `${capitalise(k.name)} (${k.jp}) · Kimarite · Sumo Ring`, description: `${k.en}: ${k.description}` }
    : { title: "Kimarite · Sumo Ring" };
}

export default function Page({ params }: PageProps<"/kimarite/[name]">) {
  return (
    <section className="page flex flex-col gap-10">
      <Suspense fallback={<Spinner label="Loading technique" />}>
        <Technique params={params} />
      </Suspense>
    </section>
  );
}

async function Technique({ params }: Pick<PageProps<"/kimarite/[name]">, "params">) {
  const k = findKimarite((await params).name);
  if (!k) notFound();
  const category = KIMARITE_CATEGORIES.find((c) => c.id === k.category)!;
  // All recent Makuuchi/Juryo wins with this technique, already in display order.
  const [stats, wins] = await Promise.all([getKimariteStats(), getKimariteBouts(k.name)]);
  const bouts = wins.slice(0, RECENT_SHOWN);
  const s = stats[k.name];
  const total = Object.values(stats).reduce((a, x) => a + x.count, 0);
  const ranked = Object.entries(stats).sort((a, b) => b[1].count - a[1].count);
  const rank = ranked.findIndex(([n]) => n === k.name) + 1;
  // lastUsage looks like "202611-9"
  const [lastBasho, lastDay] = s?.lastUsage?.split("-") ?? [];
  const siblings = KIMARITE.filter((x) => x.category === k.category && x.name !== k.name);

  return (
    <>
      <Link href={`/kimarite#${category.id}`} className="link-accent self-start border-electric-teal text-body-sm">
        ← All kimarite
      </Link>

      <header className="flex flex-col gap-3">
        <span className="badge self-start">
          {category.en} <span lang="ja" className="font-jp font-normal">{category.jp}</span>
        </span>
        <h1 className="font-display text-heading font-bold leading-none text-brand sm:text-heading-lg md:text-display">
          {capitalise(k.name)}
          <span lang="ja" className="ml-3 font-jp text-[0.55em] font-normal text-ink">
            {k.jp}
          </span>
        </h1>
        <p className="font-display text-subheading">{k.en}</p>
        <p className="max-w-2xl text-body">{k.description}</p>
      </header>

      {s && (
        <section className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4" aria-label="Usage">
          {[
            ["Wins recorded", fmt.format(s.count)],
            ["Share of all wins", total ? `${((s.count / total) * 100).toFixed(s.count / total < 0.001 ? 3 : 1)}%` : "—"],
            ["Most-used rank", rank ? `#${rank} of ${ranked.length}` : "—"],
            ["Last used", lastBasho ? `${bashoName(lastBasho)}${lastDay ? `, day ${lastDay}` : ""}` : "—"],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-card border border-line bg-surface p-4 sm:p-5">
              <p className="text-caption uppercase text-ink-soft">{label}</p>
              <p className="mt-2 break-words font-display text-subheading font-bold text-brand">{value}</p>
            </div>
          ))}
        </section>
      )}

      <Suspense fallback={<Spinner label="Looking for clips" size="sm" />}>
        <TechniqueClips wins={wins} />
      </Suspense>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-heading text-brand">
          Recent top-division wins
          <span lang="ja" className="ml-2 font-jp text-body font-normal text-ink-soft">
            関取の取組
          </span>
        </h2>
        {bouts.length === 0 ? (
          <p className="text-body-sm text-ink-soft">No recent Makuuchi or Juryo bouts were won with {capitalise(k.name)}.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line text-body-sm">
            {bouts.map((m) => {
              const winnerIsEast = m.winnerId === m.eastId;
              const loser = winnerIsEast ? m.westShikona : m.eastShikona;
              return (
                <li key={m.id ?? boutId(m)}>
                  <Link
                    href={`/bout/${boutId(m)}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 py-3 hover:bg-hover sm:grid-cols-[11rem_minmax(0,1fr)_auto]"
                  >
                    <span className="text-ink-soft">
                      {bashoName(m.bashoId)} · Day {m.day}
                    </span>
                    <span className="col-start-1 min-w-0 break-words sm:col-start-2">
                      <strong>
                        <RikishiName en={m.winnerEn} jp={m.winnerJp} />
                      </strong>{" "}
                      <span className="text-ink-soft">beat</span> {loser}
                    </span>
                    <span className="col-start-2 row-span-2 row-start-1 self-center text-caption text-ink-soft sm:col-start-3 sm:row-span-1">
                      <Romaji text={m.division} kind="division" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {siblings.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-subheading text-brand">More {category.en.toLowerCase()}</h2>
          <ul className="flex flex-wrap gap-2">
            {siblings.map((x) => (
              <li key={x.name}>
                <Link href={`/kimarite/${x.name}`} title={x.en} className="inline-block border border-line bg-surface px-3 py-1 text-body-sm hover:bg-hover">
                  {capitalise(x.name)}{" "}
                  <span lang="ja" className="font-jp text-caption">
                    {x.jp}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

const RECENT_SHOWN = 30;
const CLIPS_SHOWN = 3;

/**
 * Up to three clips of bouts won with this technique. `wins` is already in display order (newest day
 * first, then Makuuchi before Juryo by rank), so this takes the first wins that have a clip — matched
 * against the cached clip list, with no extra API calls. A new upload shows at once: saving a clip
 * refreshes the clips cache.
 */
async function TechniqueClips({ wins }: { wins: Match[] }) {
  const clips = await getClips(); // newest uploads first
  if (clips.length === 0) return null;
  // Same bout = same basho, day and pair. (Keyed without matchNo in case sources number bouts differently.)
  const key = (x: { bashoId: string; day: number; eastId: number; westId: number }) => `${x.bashoId}-${x.day}-${x.eastId}-${x.westId}`;
  const newestClip = new Map<string, Clip>();
  for (const c of clips) if (!newestClip.has(key(c))) newestClip.set(key(c), c);

  const picks: { clip: Clip; bout: Match }[] = [];
  for (const bout of wins) {
    const clip = newestClip.get(key(bout));
    if (clip) picks.push({ clip, bout });
    if (picks.length === CLIPS_SHOWN) break;
  }
  if (picks.length === 0) return null;

  return (
    <section className="flex flex-col gap-4" aria-label="Clips">
      <h2 className="font-display text-heading text-brand">
        Latest clips
        <span lang="ja" className="ml-2 font-jp text-body font-normal text-ink-soft">
          最新の映像
        </span>
      </h2>
      <ul className={`grid grid-cols-1 gap-5 ${picks.length > 1 ? "md:grid-cols-2" : ""} ${picks.length > 2 ? "lg:grid-cols-3" : ""}`}>
        {picks.map(({ clip, bout }) => (
          <li key={clip.id} className="flex min-w-0 flex-col gap-2">
            <VideoPlayer url={clip.videoUrl} start={clip.startSec} end={clip.endSec} title={clip.title} />
            <Link href={`/bout/${clip.boutId}`} className="text-body-sm hover:underline">
              <span className="text-ink-soft">
                {bashoName(clip.bashoId)} · Day {clip.day}
              </span>
              <br />
              <strong>
                <RikishiName en={bout.winnerEn} jp={bout.winnerJp} />
              </strong>{" "}
              <span className="text-ink-soft">beat</span> {bout.winnerId === bout.eastId ? bout.westShikona : bout.eastShikona}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
