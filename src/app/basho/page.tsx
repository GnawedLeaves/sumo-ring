import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { BashoTabs } from "@/components/basho/basho-tabs";
import { BoutList } from "@/components/basho/bout-list";
import { Podium } from "@/components/basho/podium";
import { BoutDetail } from "@/components/bout/bout-detail";
import { LiveIndicator } from "@/components/live-indicator";
import { Portrait } from "@/components/portrait";
import { RikishiName } from "@/components/rikishi-name";
import { bashoInfo, bashoName } from "@/lib/basho";
import { getPortraitMap } from "@/lib/content";
import { boutId, record } from "@/lib/format";
import { getLiveContext, getTodaysBouts } from "@/lib/live";
import { getBashoRecords, getBashoSummary } from "@/lib/sumo-data";

export const metadata: Metadata = { title: "Basho · Sumo Hub" };

export default function Page({ searchParams }: PageProps<"/basho">) {
  return (
    <section className="page flex flex-col gap-10">
      <h1 className="text-center font-display text-heading sm:text-heading-lg text-brand">Basho</h1>
      <BashoTabs active="current" />
      <Suspense fallback={<p className="text-body-sm">Loading today&apos;s torikumi…</p>}>
        <CurrentBasho searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function CurrentBasho({ searchParams }: Pick<PageProps<"/basho">, "searchParams">) {
  const sp = await searchParams;
  const ctx = await getLiveContext();

  // 3.3 — no basho running: show the most recent winners.
  if (!ctx.active) {
    const [summary, portraits] = await Promise.all([getBashoSummary(ctx.bashoId), getPortraitMap()]);
    return (
      <div className="flex flex-col gap-8">
        <p className="text-body">
          No basho in progress. Latest: <strong>{bashoName(ctx.bashoId)}</strong>.{" "}
          <Link href="/calendar" className="link-accent border-tangerine-pop">
            See when the next one starts
          </Link>
        </p>
        {summary && <Podium summary={summary} portraits={portraits} />}
        <Link href={`/basho/${ctx.bashoId}`} className="btn-pill self-start bg-cobalt-stage">
          Full results
        </Link>
      </div>
    );
  }

  const [{ juryo, makuuchi, current }, records, portraits] = await Promise.all([
    getTodaysBouts(ctx),
    getBashoRecords(ctx.bashoId, "live"),
    getPortraitMap(),
  ]);
  const division = sp.div === "Juryo" || sp.div === "Makuuchi" ? sp.div : (current?.division ?? "Makuuchi");
  const bouts = division === "Juryo" ? juryo : makuuchi;
  const currentId = current?.status === "up-now" ? boutId(current.bout) : undefined;
  const selected = typeof sp.bout === "string" ? sp.bout : (currentId ?? (bouts[0] && boutId(bouts[0])));
  const href = (extra: Record<string, string>) => `/basho?${new URLSearchParams({ div: division, ...(selected ? { bout: selected } : {}), ...extra })}`;

  return (
    <div className="flex flex-col gap-10">
      <AutoRefresh seconds={30} />

      {/* Hero: the bout on the dohyō right now */}
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption font-bold uppercase tracking-wide text-ink-soft">
          {current?.status === "up-now" && <LiveIndicator />}
          <span>
            {bashoName(ctx.bashoId)} · {bashoInfo(ctx.bashoId)?.jp} · Day {ctx.day}
          </span>
        </p>
        {current?.status === "up-now" ? (
          <Link href={href({ bout: boutId(current.bout), div: current.division })} scroll={false} className="block bg-indigo-frame p-4 text-white sm:p-6 md:p-10">
            <span className="flex flex-wrap items-center gap-2">
              <LiveIndicator />
              <span className="badge">ON THE DOHYŌ · {current.division.toUpperCase()}</span>
            </span>
            <span className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-4">
              {[
                { id: current.bout.eastId, en: current.bout.eastShikona, rank: current.bout.eastRank },
                { id: current.bout.westId, en: current.bout.westShikona, rank: current.bout.westRank },
              ].map((s, i) => {
                const rec = records[s.id];
                return (
                  <span key={s.id} className={`flex min-w-0 flex-col gap-2 ${i ? "col-start-3 items-end text-right" : "items-start"}`}>
                    <Portrait id={s.id} en={s.en} jp={rec?.jp} src={portraits[s.id]} size="lg" />
                    <span className="max-w-full break-words font-display text-subheading font-bold leading-tight sm:text-heading md:text-heading-lg md:leading-none">
                      <RikishiName en={s.en} jp={rec?.jp} stacked />
                    </span>
                    <span className="text-caption sm:text-body-sm">{s.rank}</span>
                    {rec && <span className="font-display text-subheading">{record(rec.wins, rec.losses, rec.absences)}</span>}
                  </span>
                );
              })}
              <span className="col-start-2 row-start-1 font-display text-subheading italic sm:text-heading">vs</span>
            </span>
          </Link>
        ) : (
          <p className="border border-line bg-surface p-6 text-body">
            {current ? `Day ${ctx.day} is complete.` : `Day ${ctx.day} torikumi hasn't been published yet.`}
          </p>
        )}
      </div>

      <div className="grid gap-8 md:grid-cols-[320px_1fr]">
        {/* Fixed-height sidebar: the bout list scrolls inside it, not the page */}
        <aside className="flex h-[55dvh] flex-col self-start border border-line bg-canvas md:sticky md:top-20 md:h-[calc(100dvh-6rem)]">
          <div className="flex border-b border-line">
            {(["Makuuchi", "Juryo"] as const).map((d) => (
              <Link
                key={d}
                href={`/basho?div=${d}`}
                scroll={false}
                className={`flex-1 py-3 text-center text-body-sm font-bold ${d === division ? "bg-indigo-frame text-white" : "hover:bg-hover"}`}
              >
                {d}
              </Link>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <BoutList bouts={bouts} records={records} selected={selected} currentId={currentId} hrefFor={(id) => href({ bout: id })} />
          </div>
        </aside>
        <div className="min-w-0">
          {selected ? (
            <Suspense key={selected} fallback={<p className="text-body-sm">Loading bout…</p>}>
              <BoutDetail boutId={selected} live />
            </Suspense>
          ) : (
            <p className="text-body-sm">Pick a bout.</p>
          )}
        </div>
      </div>
    </div>
  );
}
