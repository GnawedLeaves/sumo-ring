import type { Metadata } from "next";
import { Suspense } from "react";
import { Romaji } from "@/components/jp";
import { Spinner } from "@/components/spinner";
import { WhitelistToggle } from "@/components/telegram/whitelist-toggle";
import { isAdmin } from "@/lib/auth/session";
import { RANK_JP } from "@/lib/rank";
import { getActiveIndex } from "@/lib/sumo-data";
import { autoPostConfigured, channelId, getWhitelist } from "@/lib/telegram-autopost";

export const metadata: Metadata = { title: "Telegram auto-post · Sumo Ring" };

/** Sekitori ranks (the auto-clipper records Juryo + Makuuchi), in banzuke order. */
const TIERS = ["Yokozuna", "Ozeki", "Sekiwake", "Komusubi", "Maegashira", "Juryo"] as const;

export default function Page() {
  return (
    <section className="page flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-heading text-brand sm:text-heading-lg">Telegram auto-post</h1>
        <p className="text-body-sm text-ink-soft">
          Auto clips of these wrestlers&apos; bouts are posted to your Telegram channel as soon as they&apos;re saved.
        </p>
      </header>
      <Suspense fallback={<Spinner label="Loading the whitelist" />}>
        <Whitelist />
      </Suspense>
    </section>
  );
}

async function Whitelist() {
  if (!(await isAdmin())) {
    return <p className="border border-line bg-surface p-6 text-body">Only admins can change the Telegram whitelist.</p>;
  }
  const [index, whitelist] = await Promise.all([
    getActiveIndex(),
    getWhitelist().catch((e: unknown) => (e instanceof Error ? e : new Error(String(e)))),
  ]);
  if (whitelist instanceof Error) {
    return <p className="border border-line bg-surface p-6 text-body">Couldn&apos;t load the whitelist: {whitelist.message}</p>;
  }
  const on = new Set(whitelist);
  const sekitori = index.filter((r) => (TIERS as readonly string[]).includes(r.tier));
  const channel = channelId();

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 text-body-sm">
        <span>
          <strong>{sekitori.filter((r) => on.has(r.id)).length}</strong> wrestler(s) on the whitelist
        </span>
        {autoPostConfigured() ? (
          <span className="text-ink-soft">Posting to {channel}</span>
        ) : (
          <span className="text-crimson-spotlight">
            Not posting yet: set TELEGRAM_CHANNEL_ID (and make the bot an admin of the channel).
          </span>
        )}
      </div>

      {TIERS.map((tier) => {
        const group = sekitori.filter((r) => r.tier === tier);
        if (group.length === 0) return null;
        return (
          <section key={tier} className="flex flex-col gap-4">
            <h2 className="flex items-baseline gap-3 font-display text-heading text-brand">
              {tier}
              <span lang="ja" className="font-jp text-body text-ink-soft">
                {RANK_JP[tier]}
              </span>
            </h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {group.map((r) => (
                <li key={r.id} className="flex min-w-0 flex-col gap-1">
                  <WhitelistToggle rikishiId={r.id} name={r.en} initial={on.has(r.id)} />
                  <span className="text-caption text-ink-soft">
                    <Romaji text={r.rank} kind="rank" />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
