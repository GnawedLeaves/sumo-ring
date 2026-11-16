import { Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { BoutDetail } from "@/components/bout/bout-detail";
import { StreamManager } from "@/components/streams/stream-manager";
import { LiveIndicator } from "@/components/live-indicator";
import { VideoPlayer } from "@/components/video-player";
import { isAdmin } from "@/lib/auth/session";
import { bashoName } from "@/lib/basho";
import { getStreams, store } from "@/lib/content";
import { thumbnailFor } from "@/lib/embed";
import { boutId } from "@/lib/format";
import { getLiveContext, getTodaysBouts, SESSION_HOURS_SGT } from "@/lib/live";
import { RefreshButton } from "@/components/refresh-button";
import { Romaji } from "@/components/jp";

export const metadata: Metadata = { title: "Streams · Sumo Ring" };

export default function Page({ searchParams }: PageProps<"/streams">) {
  return (
    /*
     * Phones/tablets: a single column (flex). The player is a DIRECT child of this section so its `sticky`
     * holds for the whole page — a sticky element only sticks within its parent, and when it lived inside the
     * left-column wrapper it let go as soon as the stats below came into view.
     * Desktop (lg): a two-column grid; the player and stream list stack on the left, the stats sidebar spans
     * both rows on the right, and the player is no longer sticky.
     */
    <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-0 pb-6 sm:px-4 sm:py-10 md:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-x-8">
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 bg-black lg:static lg:col-start-1 lg:row-start-1">
        <Suspense fallback={<div className="aspect-video w-full bg-black" />}>
          <PlayerVideo searchParams={searchParams} />
        </Suspense>
      </div>
      <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-2">
        <Suspense fallback={null}>
          <StreamPicker searchParams={searchParams} />
        </Suspense>
        <div className="px-4 sm:px-0">
          <Suspense fallback={null}>
            <AdminStreams />
          </Suspense>
        </div>
      </div>
      <aside className="mx-4 h-fit min-w-0 border border-line bg-canvas p-4 sm:mx-0 sm:p-5 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <Suspense fallback={<p className="text-body-sm">Checking the dohyō…</p>}>
          <LiveSidebar />
        </Suspense>
      </aside>
    </section>
  );
}

async function currentStream(searchParams: PageProps<"/streams">["searchParams"]) {
  const [{ s }, streams] = await Promise.all([searchParams, getStreams()]);
  return { streams, current: streams.find((x) => x.id === s) ?? streams[0] };
}

/** The video itself (sticky on phones — see the layout note in Page). */
async function PlayerVideo({ searchParams }: Pick<PageProps<"/streams">, "searchParams">) {
  const { current } = await currentStream(searchParams);
  if (!current) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-indigo-frame p-6 text-center text-white">
        <p className="font-display text-heading">No streams yet</p>
        <p className="text-body-sm">The admin can add YouTube or Twitch streams below.</p>
      </div>
    );
  }
  return <VideoPlayer url={current.url} title={current.name} autoplay />;
}

/** Title of the stream being watched + the cards to switch streams. */
async function StreamPicker({ searchParams }: Pick<PageProps<"/streams">, "searchParams">) {
  const { streams, current } = await currentStream(searchParams);
  if (!current) return null;
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 sm:px-0">
        <h1 className="break-words font-display text-subheading text-brand sm:text-heading">{current.name}</h1>
        {current.note && <p className="text-body-sm text-ink-soft">{current.note}</p>}
      </div>
      <ul className="grid grid-cols-2 gap-3 px-4 sm:gap-4 sm:px-0 md:grid-cols-4" aria-label="Streams">
        {streams.map((st) => {
          const active = st.id === current.id;
          const thumb = thumbnailFor(st.url);
          return (
            <li key={st.id}>
              <Link
                href={`/streams?s=${st.id}`}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={`group flex h-full flex-col text-white ${st.platform === "twitch" ? "bg-plum-velvet" : "bg-vermillion"} ${
                  active ? "outline-4 outline-offset-2 outline-electric-teal" : "opacity-85 hover:opacity-100"
                }`}
              >
                <span className="relative block aspect-video w-full overflow-hidden bg-black/30">
                  {thumb ? (
                    // Plain <img>: Twitch previews are live frames, so they must not go through (and get cached by) the image optimizer.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <span aria-hidden className="flex h-full items-center justify-center opacity-60">
                      <Play className="h-8 w-8" />
                    </span>
                  )}
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/45 text-caption font-bold uppercase">
                      <Play aria-hidden className="h-3.5 w-3.5 fill-current" /> Watching
                    </span>
                  )}
                </span>
                <span className="flex flex-1 flex-col justify-between gap-1 p-3">
                  <span className="text-body font-bold leading-tight">{st.name}</span>
                  <span className="text-caption uppercase opacity-80">{st.platform}</span>
                </span>
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
  // getStreams() swallows errors for viewers; admins need to see why saving will fail (e.g. missing Hygraph model).
  const setupError = await store
    .listStreams()
    .then(() => null)
    .catch((e: unknown) => (e instanceof Error ? e.message : "Content store unavailable"));
  return <StreamManager streams={streams} setupError={setupError} />;
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
      {ctx.onAir && <AutoRefresh seconds={30} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-subheading text-brand">On the dohyō <span lang="ja" className="font-jp text-body font-normal">土俵</span></h2>
        <span className="flex items-center gap-2">
          {current?.status === "up-now" ? (
            <>
              <LiveIndicator />
              <span className="badge"><Romaji text={current.division.toUpperCase()} kind="division" /></span>
            </>
          ) : (
            <span className="text-caption text-ink-soft">Day {ctx.day}</span>
          )}
          <RefreshButton label="Refresh current bout" />
        </span>
      </div>
      {!current ? (
        <p className="text-body-sm">
          {bashoName(ctx.bashoId)} day {ctx.day}: torikumi not published yet.
        </p>
      ) : (
        <>
          {current.status === "day-complete" && <p className="text-body-sm">Day {ctx.day} is complete. Last bout:</p>}
          {current.status === "off-air" && (
            <p className="text-body-sm">
              Not live right now: bouts run {SESSION_HOURS_SGT.start}am–{SESSION_HOURS_SGT.end - 12}pm Singapore time. Next up:
            </p>
          )}
          {/* key: remount (and show the fallback) when the bout changes */}
          <Suspense key={boutId(current.bout)} fallback={<p className="text-body-sm">Loading bout…</p>}>
            <BoutDetail boutId={boutId(current.bout)} live compact />
          </Suspense>
          <Link href={`/basho?bout=${boutId(current.bout)}`} className="link-accent self-start border-electric-teal text-body-sm">
            Full torikumi <span lang="ja" className="font-jp">取組</span>
          </Link>
        </>
      )}
    </div>
  );
}
