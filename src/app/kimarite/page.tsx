import type { Metadata } from "next";
import Link from "next/link";
import { KIMARITE, KIMARITE_CATEGORIES, capitalise } from "@/lib/kimarite";
import { getKimariteStats } from "@/lib/sumo-data";

export const metadata: Metadata = {
  title: "Kimarite · Sumo Ring",
  description: "Every winning technique in sumo, with Japanese names, explanations and how often each is used.",
};

const fmt = new Intl.NumberFormat("en-GB");

export default async function Page() {
  const stats = await getKimariteStats(); // cached for a day
  const total = Object.values(stats).reduce((a, s) => a + s.count, 0);

  return (
    <section className="page flex flex-col gap-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-heading text-brand sm:text-heading-lg">
          Kimarite<span lang="ja" className="ml-2 font-jp text-[0.6em] font-normal">決まり手</span>
        </h1>
        <p className="max-w-2xl text-body text-ink-soft">
          The Japan Sumo Association recognises 82 winning techniques, plus a handful of results where the loser beats himself. Counts are
          every recorded professional bout{total ? ` (${fmt.format(total)} in all)` : ""}.
        </p>
        <nav aria-label="Categories" className="flex flex-wrap justify-center gap-2">
          {KIMARITE_CATEGORIES.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="border border-line bg-surface px-3 py-1 text-caption font-bold hover:bg-hover">
              {c.en} <span lang="ja" className="font-jp font-normal">{c.jp}</span>
            </a>
          ))}
        </nav>
      </header>

      {KIMARITE_CATEGORIES.map((c) => {
        const items = KIMARITE.filter((k) => k.category === c.id).sort(
          (a, b) => (stats[b.name]?.count ?? -1) - (stats[a.name]?.count ?? -1) || a.name.localeCompare(b.name),
        );
        return (
          <section key={c.id} id={c.id} className="flex scroll-mt-24 flex-col gap-5">
            <div>
              <h2 className="font-display text-heading text-brand">
                {c.en}
                <span lang="ja" className="ml-2 font-jp text-body font-normal text-ink-soft">
                  {c.jp}
                </span>
              </h2>
              <p className="text-body-sm text-ink-soft">{c.blurb}</p>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((k) => {
                const s = stats[k.name];
                return (
                  <li key={k.name} className="min-w-0">
                    <Link
                      href={`/kimarite/${k.name}`}
                      className="flex h-full flex-col gap-1 rounded-card border border-line bg-surface p-4 transition-colors hover:border-brand hover:bg-hover"
                    >
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-display text-subheading font-bold text-brand">
                          {capitalise(k.name)}
                          <span lang="ja" className="ml-2 font-jp text-body-sm font-normal text-ink">
                            {k.jp}
                          </span>
                        </span>
                        <span className="text-caption text-ink-soft">{s ? `${fmt.format(s.count)} wins` : "—"}</span>
                      </span>
                      <span className="text-body-sm font-bold">{k.en}</span>
                      <span className="text-body-sm text-ink-soft">{k.description}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
