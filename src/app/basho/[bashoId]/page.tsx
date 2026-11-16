import { Spinner } from "@/components/spinner";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BashoPicker } from "@/components/basho/basho-picker";
import { BashoTabs } from "@/components/basho/basho-tabs";
import { bashoByYear } from "@/lib/basho-history";
import { BoutList } from "@/components/basho/bout-list";
import { Podium } from "@/components/basho/podium";
import { BoutDetail } from "@/components/bout/bout-detail";
import { RikishiName } from "@/components/rikishi-name";
import { bashoInfo, bashoName, bashoWindow, formatDateRange } from "@/lib/basho";
import { getClips, getPortraitMap } from "@/lib/content";
import { shikonaOnly } from "@/lib/format";
import { dayStatus, getLiveContext } from "@/lib/live";
import { DayPicker } from "@/components/basho/day-picker";
import { getBanzuke, getBashoRecords, getBashoSummary, getTorikumi } from "@/lib/sumo-data";
import { Standings } from "@/components/basho/standings";
import { Romaji } from "@/components/jp";



export default function Page({ params, searchParams }: PageProps<"/basho/[bashoId]">) {
  return (
    <section className="page flex flex-col gap-10">
      <BashoTabs active="history" />
      <Suspense fallback={<Spinner label="Loading basho" />}>
        <BashoDetail params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function BashoDetail({ params, searchParams }: PageProps<"/basho/[bashoId]">) {
  const { bashoId } = await params;
  if (!/^\d{4}(01|03|05|07|09|11)$/.test(bashoId)) notFound();
  const sp = await searchParams;
  const division = sp.div === "Juryo" ? "Juryo" : "Makuuchi";
  const ctx = await getLiveContext();
  const live = ctx.active && ctx.bashoId === bashoId;
  // A running basho opens on today's day; finished ones on Day 1.
  const day = Math.min(15, Math.max(1, Number(sp.day) || (live && ctx.day) || 1));
  const freshness = live ? "live" : "settled";

  const [summary, portraits, bouts, records, clips, banzuke] = await Promise.all([
    getBashoSummary(bashoId, freshness),
    getPortraitMap(),
    getTorikumi(bashoId, day, division, freshness),
    getBashoRecords(bashoId, freshness),
    getClips({ bashoId }),
    getBanzuke(bashoId, division, freshness),
  ]);
  if (!summary) notFound();

  const info = bashoInfo(bashoId);
  const w = bashoWindow(bashoId, summary.startDate);
  const selected = typeof sp.bout === "string" ? sp.bout : undefined;
  const clipBouts = new Set(clips.map((c) => c.boutId));
  const href = (q: Record<string, string | number>) =>
    `/basho/${bashoId}?${new URLSearchParams(Object.entries({ day, div: division, ...q }).map(([k, v]) => [k, String(v)]))}`;

  return (
    <div className="flex flex-col gap-12">
      {/* Hero: winner + runners-up, awards */}
      <header className="flex flex-col gap-8">
        <BashoPicker groups={bashoByYear(ctx)} current={bashoId} />
        <div>
          <h1 className="font-display text-heading sm:text-heading-lg font-bold text-brand">
            {bashoName(bashoId)} <span className="font-jp text-heading font-normal">{info?.jp}</span>
          </h1>
          <p className="mt-2 text-body-sm text-ink-soft">
            {formatDateRange(w.start, w.end)} · {summary.location ?? `${info?.venue}, ${info?.city}`}
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Podium summary={summary} portraits={portraits} />
          <aside className="h-fit rounded-card border border-line bg-surface p-5">
            {/* No prizes yet (basho still running): the live standings are more useful than an empty Awards panel. */}
            {(summary.specialPrizes ?? []).length === 0 && (summary.yusho ?? []).length === 0 ? (
              <Standings entries={banzuke ?? []} division={division} bashoId={bashoId} records={records} />
            ) : (
              <>
            <h2 className="font-display text-subheading text-brand">Awards</h2>
            <ul className="mt-3 flex flex-col gap-2 text-body-sm">
              {(summary.specialPrizes ?? []).map((p) => (
                <li key={`${p.type}-${p.rikishiId}`} className="flex justify-between gap-2">
                  <span className="badge"><Romaji text={p.type} kind="sansho" /></span>
                  <Link href={`/rikishi/${p.rikishiId}`} className="font-bold hover:underline">
                    <RikishiName en={p.shikonaEn} jp={p.shikonaJp} />
                  </Link>
                </li>
              ))}
              {(summary.specialPrizes ?? []).length === 0 && <li className="text-ink-soft">No sanshō awarded{summary.winner ? "" : " yet"}.</li>}
            </ul>
            <h3 className="mt-5 text-caption uppercase text-ink-soft">Yūshō 優勝 by division</h3>
            <ul className="mt-2 flex flex-col gap-1 text-body-sm">
              {(summary.yusho ?? []).map((y) => (
                <li key={y.type} className="flex justify-between gap-2">
                  <span className="text-ink-soft"><Romaji text={y.type} kind="division" /></span>
                  <Link href={`/rikishi/${y.rikishiId}`} className="font-bold hover:underline">
                    {y.shikonaEn.split(" ")[0]} <span className="font-jp font-normal">{shikonaOnly(y.shikonaJp)}</span>
                  </Link>
                </li>
              ))}
            </ul>
              </>
            )}
          </aside>
        </div>
      </header>

      {/* Day tabs | bouts | bout detail */}
      <div className="grid gap-6 md:grid-cols-[96px_280px_1fr]">
        <DayPicker vertical selected={day} statusOf={(d) => dayStatus(ctx, bashoId, d)} hrefFor={(d) => href({ day: d })} />
        {/* Fixed-height sidebar: the bout list scrolls inside it, not the page */}
        <aside className="flex h-[55dvh] flex-col self-start border border-line md:sticky md:top-20 md:h-[calc(100dvh-6rem)]">
          <div className="flex border-b border-line">
            {(["Makuuchi", "Juryo"] as const).map((d) => (
              <Link
                key={d}
                href={`/basho/${bashoId}?day=${day}&div=${d}`}
                scroll={false}
                className={`flex-1 py-3 text-center text-body-sm font-bold ${d === division ? "bg-indigo-frame text-white" : "hover:bg-hover"}`}
              >
                <Romaji text={d} kind="division" />
              </Link>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <BoutList bouts={bouts} records={records} selected={selected} hrefFor={(id) => href({ bout: id })} />
          </div>
          {clipBouts.size > 0 && <p className="border-t border-line p-3 text-caption">{clipBouts.size} bout(s) in this basho have clips.</p>}
        </aside>
        <div className="min-w-0">
          {selected ? (
            <Suspense key={selected} fallback={<Spinner label="Loading bout" />}>
              <BoutDetail boutId={selected} live={live} />
            </Suspense>
          ) : (
            <p className="border border-dashed border-line p-6 text-body-sm">Select a bout to see the head-to-head, techniques and any clips.</p>
          )}
        </div>
      </div>
    </div>
  );
}
