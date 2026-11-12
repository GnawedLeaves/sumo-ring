import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { BoutDetail } from "@/components/bout/bout-detail";
import { StreamManager } from "@/components/streams/stream-manager";
import { VideoPlayer } from "@/components/video-player";
import { isAdmin } from "@/lib/auth/session";
import { bashoName } from "@/lib/basho";
import { getStreams } from "@/lib/content";
import { boutId } from "@/lib/format";
import { getLiveContext, getTodaysBouts } from "@/lib/live";

export const metadata: Metadata = { title: "Streams · Sumo Hub" };

export default function Page({ searchParams }: PageProps<"/streams">) {
  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 py-10 md:px-6">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Suspense fallback={<div className="aspect-video w-full bg-black" />}>
            <Player searchParams={searchParams} />
          </Suspense>
          <Suspense fallback={null}>
            <AdminStreams />
          </Suspense>
        </div>
        <aside className="h-fit border border-line bg-canvas p-5 lg:sticky lg:top-4">
          <Suspense fallback={<p className="text-body-sm">Checking the dohyō…</p>}>
            <LiveSidebar />
          </Suspense>
        </aside>
      </div>
    </section>
  );
}

async function Player({ searchParams }: Pick<PageProps<"/streams">, "searchParams">) {
  const [{ s }, streams] = await Promise.all([searchParams, getStreams()]);
  const current = streams.find((x) => x.id === s) ?? streams[0];

  if (!current) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-indigo-frame p-6 text-center text-white">
        <p className="font-display text-heading">No streams yet</p>
        <p className="text-body-sm">The admin can add YouTube or Twitch streams below.</p>
      </div>
    );
  }

  return (
    <>
      <VideoPlayer url={current.url} title={current.name} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-heading text-brand">{current.name}</h1>
        {current.note && <p className="text-body-sm text-ink-soft">{current.note}</p>}
      </div>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="Streams">
        {streams.map((st) => {
          const active = st.id === current.id;
          return (
            <li key={st.id}>
              <Link
                href={`/streams?s=${st.id}`}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={`flex h-full flex-col justify-between gap-3 p-4 text-white ${st.platform === "twitch" ? "bg-plum-velvet" : "bg-vermillion"} ${
                  active ? "outline-4 outline-offset-2 outline-electric-teal" : "opacity-80 hover:opacity-100"
                }`}
              >
                <span className="text-body font-bold leading-tight">{st.name}</span>
                <span className="text-caption uppercase">{active ? "▶ Watching" : st.platform}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

async function AdminStreams() {
  if (!(await isAdmin())) return null;
  const streams = await getStreams();
  return <StreamManager streams={streams} />;
}

async function LiveSidebar() {
  const ctx = await getLiveContext();
  if (!ctx.active) {
    return (
      <div className="flex flex-col gap-3 text-body-sm">
        <h2 className="font-display text-subheading text-brand">No basho today</h2>
        <p>
          Bout stats appear here while a basho is running.{" "}
          <Link href="/calendar" className="link-accent border-tangerine-pop">
            Next basho
          </Link>
        </p>
      </div>
    );
  }
  const { current } = await getTodaysBouts(ctx);
  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh seconds={30} />
      <div className="flex items-center justify-between">
        <h2 className="font-display text-subheading text-brand">On the dohyō</h2>
        {current?.status === "up-now" && <span className="badge">{current.division.toUpperCase()}</span>}
      </div>
      {!current ? (
        <p className="text-body-sm">
          {bashoName(ctx.bashoId)} day {ctx.day}: torikumi not published yet.
        </p>
      ) : (
        <>
          {current.status === "day-complete" && <p className="text-body-sm">Day {ctx.day} is complete. Last bout:</p>}
          {/* key: remount (and show the fallback) when the bout changes */}
          <Suspense key={boutId(current.bout)} fallback={<p className="text-body-sm">Loading bout…</p>}>
            <BoutDetail boutId={boutId(current.bout)} live compact />
          </Suspense>
          <Link href={`/basho?bout=${boutId(current.bout)}`} className="link-accent self-start border-electric-teal text-body-sm">
            Full torikumi
          </Link>
        </>
      )}
    </div>
  );
}
