import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Portrait } from "@/components/portrait";
import { bashoInfo, bashoName } from "@/lib/basho";
import { Romaji } from "@/components/jp";
import { getPortraitMap, store } from "@/lib/content";
import { PortraitUploader } from "@/components/portraits/portrait-uploader";
import { isAdmin } from "@/lib/auth/session";
import { formatDate, pct, record, shikonaOnly, topEntries, yyyymm } from "@/lib/format";
import { getRikishi, getRikishiProfile, getRikishiStats } from "@/lib/sumo-data";
import { Spinner } from "@/components/spinner";

export default function Page({ params }: PageProps<"/rikishi/[id]">) {
  return (
    <Suspense fallback={<section className="page"><Spinner label="Loading rikishi" /></section>}>
      <RikishiDetail params={params} />
    </Suspense>
  );
}

async function RikishiDetail({ params }: Pick<PageProps<"/rikishi/[id]">, "params">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [r, stats, profile, portraits, admin] = await Promise.all([
    getRikishi(id),
    getRikishiStats(id),
    getRikishiProfile(id),
    getPortraitMap(),
    isAdmin(),
  ]);
  if (!r) notFound();

  const highest = [...(r.rankHistory ?? [])].sort((a, b) => a.rankValue - b.rankValue)[0];
  const bouts = stats ? stats.totalWins + stats.totalLosses : 0;
  const latestMeasure = r.measurementHistory?.[0];

  const facts: [string, React.ReactNode][] = [
    ["Heya", r.heya && <Romaji text={r.heya} kind="heya" />],
    ["Shusshin 出身", r.shusshin && <Romaji text={r.shusshin} kind="shusshin" />],
    ["Born", r.birthDate && formatDate(r.birthDate)],
    ["Debut", yyyymm(r.debut)],
    ["Height", (r.height ?? latestMeasure?.height) && `${r.height ?? latestMeasure?.height} cm`],
    ["Weight", (r.weight ?? latestMeasure?.weight) && `${r.weight ?? latestMeasure?.weight} kg`],
    ["Highest rank", highest ? <><Romaji text={highest.rank} kind="rank" /> ({yyyymm(highest.bashoId)})</> : undefined],
    ["Retired", r.intai && formatDate(r.intai)],
  ];

  return (
    <>
      {/* Hero */}
      <section className="bg-indigo-frame text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-16 md:flex-row md:items-end md:px-6">
          <div className="flex flex-col items-start gap-3">
            <Portrait id={r.id} en={r.shikonaEn} jp={r.shikonaJp} src={portraits[r.id]} size="xl" />
            {admin && store.kind === "hygraph" && (
              <PortraitUploader rikishiId={r.id} name={r.shikonaEn} hasPortrait={Boolean(portraits[r.id])} onDark />
            )}
          </div>
          <div className="flex flex-col gap-3">
            <span className="badge self-start">{r.intai ? "RETIRED 引退" : r.currentRank ? <Romaji text={r.currentRank} kind="rank" /> : "ACTIVE"}</span>
            <h1 className="font-display text-heading sm:text-heading-lg font-bold md:text-display">{r.shikonaEn}</h1>
            <p className="font-jp text-heading">{r.shikonaJp}</p>
          </div>
        </div>
      </section>

      <div className="page flex flex-col gap-16">
        {/* Headline numbers */}
        {stats && (
          <section className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
            {[
              ["Career record", record(stats.totalWins, stats.totalLosses, stats.totalAbsences)],
              ["Win rate", pct(stats.totalWins, bouts)],
              ["Yūshō 優勝 (all divisions)", stats.yusho],
              ["Makuuchi 幕内 yūshō 優勝", stats.yushoByDivision?.Makuuchi ?? 0],
              ["Basho", stats.basho],
              ["Sanshō 三賞", Object.values(stats.sansho ?? {}).reduce((a, b) => a + b, 0)],
              ["Best technique", profile.kimariteWins[0] ? <Romaji text={profile.kimariteWins[0][0]} kind="kimarite" /> : "—"],
              ["Bouts", stats.totalMatches],
            ].map(([label, value]) => (
              <div key={String(label)} className="min-w-0 rounded-card border border-line bg-surface p-4 sm:p-5">
                <p className="text-caption uppercase text-ink-soft">{label}</p>
                <p className="mt-2 break-words font-display text-subheading font-bold text-brand sm:text-heading">{value}</p>
              </div>
            ))}
          </section>
        )}

        <div className="grid gap-12 md:grid-cols-2">
          <Section title="Profile" jp="プロフィール">
            <dl className="divide-y divide-line border-y border-line text-body-sm">
              {facts.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="text-right font-bold">{v}</dd>
                </div>
              ))}
            </dl>
          </Section>

          {stats && (
            <Section title="By division">
              <table className="w-full border-collapse text-body-sm">
                <thead>
                  <tr className="text-left text-caption uppercase text-ink-soft">
                    <th className="py-2">Division</th>
                    <th>Basho</th>
                    <th>W-L-A</th>
                    <th>Yūshō</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(stats.bashoByDivision ?? {}).map((d) => (
                    <tr key={d} className="border-t border-line">
                      <td className="py-2 font-bold"><Romaji text={d} kind="division" /></td>
                      <td>{stats.bashoByDivision[d]}</td>
                      <td>{record(stats.winsByDivision?.[d] ?? 0, stats.lossByDivision?.[d] ?? 0, stats.absenceByDivision?.[d] ?? 0)}</td>
                      <td>{stats.yushoByDivision?.[d] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topEntries(stats.sansho).length > 0 && (
                <p className="mt-4 flex flex-wrap gap-2">
                  {topEntries(stats.sansho).map(([k, n]) => (
                    <span key={k} className="badge">
                      <Romaji text={k} kind="sansho" /> ×{n}
                    </span>
                  ))}
                </p>
              )}
            </Section>
          )}

          <Section title="Winning techniques" jp="決まり手">
            <KimariteTable rows={profile.kimariteWins} />
          </Section>
          <Section title="Lost to">
            <KimariteTable rows={profile.kimariteLosses} />
          </Section>
        </div>

        <Section title="Basho results" jp="場所成績">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-body-sm">
              <thead>
                <tr className="text-left text-caption uppercase text-ink-soft">
                  <th className="py-2">Basho</th>
                  <th>Rank</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {profile.bashoResults.slice(0, 30).map((b) => (
                  <tr key={b.bashoId} className="border-t border-line">
                    <td className="py-2">
                      <Link href={`/basho/${b.bashoId}`} className="link-accent border-electric-teal">
                        {bashoName(b.bashoId)} <span lang="ja" className="font-jp text-caption">{bashoInfo(b.bashoId)?.jp}</span>
                      </Link>
                    </td>
                    <td><Romaji text={b.rank} kind="rank" /></td>
                    <td className={`font-bold ${b.wins > b.losses ? "text-brand" : ""}`}>{record(b.wins, b.losses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="grid gap-12 md:grid-cols-2">
          {(r.rankHistory?.length ?? 0) > 0 && (
            <Section title="Rank history" jp="番付履歴">
              <ul className="max-h-96 divide-y divide-line overflow-y-auto border-y border-line text-body-sm">
                {r.rankHistory!.map((h) => (
                  <li key={h.id} className="flex justify-between py-2">
                    <span className="text-ink-soft">{yyyymm(h.bashoId)}</span>
                    <span className="font-bold"><Romaji text={h.rank} kind="rank" /></span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {(r.shikonaHistory?.length ?? 0) > 1 && (
            <Section title="Shikona history" jp="四股名履歴">
              <ul className="divide-y divide-line border-y border-line text-body-sm">
                {r.shikonaHistory!.map((h) => (
                  <li key={h.id} className="flex justify-between gap-4 py-2">
                    <span className="text-ink-soft">{yyyymm(h.bashoId)}</span>
                    <span className="font-bold">
                      {h.shikonaEn} <span className="font-jp font-normal">{shikonaOnly(h.shikonaJp)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ title, jp, children }: { title: string; jp?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-heading text-brand">
        {title}
        {jp && <span lang="ja" className="ml-2 font-jp text-body font-normal text-ink-soft">{jp}</span>}
      </h2>
      {children}
    </section>
  );
}

function KimariteTable({ rows }: { rows: [string, number][] }) {
  if (!rows.length) return <p className="text-body-sm">No data.</p>;
  const total = rows.reduce((a, [, n]) => a + n, 0);
  return (
    <ul className="divide-y divide-line border-y border-line text-body-sm">
      {rows.slice(0, 10).map(([k, n]) => (
        <li key={k} className="flex justify-between py-2">
          <span><Romaji text={k} kind="kimarite" /></span>
          <span>
            <strong>{n}</strong> <span className="text-ink-soft">({pct(n, total)})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
