import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Portrait } from "@/components/portrait";
import { PortraitUploader } from "@/components/portraits/portrait-uploader";
import { isAdmin } from "@/lib/auth/session";
import { getPortraitMap, store } from "@/lib/content";
import { RANK_JP } from "@/lib/rank";
import { getActiveIndex } from "@/lib/sumo-data";
import { Romaji } from "@/components/jp";

export const metadata: Metadata = { title: "Rikishi portraits · Sumo Ring" };

/** Makuuchi (top division) ranks, in banzuke order. */
const TOP_DIVISION = ["Yokozuna", "Ozeki", "Sekiwake", "Komusubi", "Maegashira"] as const;

export default function Page() {
  return (
    <section className="page flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-heading text-brand sm:text-heading-lg">
          Rikishi portraits<span lang="ja" className="ml-2 font-jp text-[0.6em] font-normal">幕内</span>
        </h1>
        <p className="text-body-sm text-ink-soft">Top-division wrestlers. Upload a photo to replace the coloured placeholder everywhere on the site.</p>
      </header>
      <Suspense fallback={<p className="text-body-sm">Loading the banzuke…</p>}>
        <PortraitList />
      </Suspense>
    </section>
  );
}

async function PortraitList() {
  const [admin, index, portraits] = await Promise.all([isAdmin(), getActiveIndex(), getPortraitMap()]);
  const top = index.filter((r) => (TOP_DIVISION as readonly string[]).includes(r.tier));
  const done = top.filter((r) => portraits[r.id]).length;
  const uploadsEnabled = store.kind === "hygraph";

  if (top.length === 0) return <p className="text-body-sm">Couldn&apos;t load the banzuke right now. Try again in a minute.</p>;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 text-body-sm">
        <span>
          <strong>{done}</strong> of {top.length} have a photo
        </span>
        {!admin && <span className="text-ink-soft">Sign in as the admin to upload photos.</span>}
        {admin && !uploadsEnabled && <span className="text-crimson-spotlight">Uploads need Hygraph (HYGRAPH_ENDPOINT / HYGRAPH_TOKEN).</span>}
      </div>

      {TOP_DIVISION.map((tier) => {
        const group = top.filter((r) => r.tier === tier);
        if (group.length === 0) return null;
        return (
          <section key={tier} className="flex flex-col gap-4">
            <h2 className="flex items-baseline gap-3 font-display text-heading text-brand">
              {tier}
              <span lang="ja" className="font-jp text-body text-ink-soft">
                {RANK_JP[tier]}
              </span>
            </h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {group.map((r) => (
                <li key={r.id} className="flex min-w-0 flex-col gap-2 border border-line bg-surface p-3">
                  <Link href={`/rikishi/${r.id}`} className="group flex min-w-0 flex-col gap-2">
                    <Portrait id={r.id} en={r.en} jp={r.jp} src={portraits[r.id]} size="fill" />
                    <span className="break-words font-display text-subheading font-bold leading-tight text-brand group-hover:underline">{r.en}</span>
                  </Link>
                  <span className="text-caption text-ink-soft">
                    <Romaji text={r.rank} kind="rank" />
                  </span>
                  {admin && uploadsEnabled && <PortraitUploader rikishiId={r.id} name={r.en} hasPortrait={Boolean(portraits[r.id])} />}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
