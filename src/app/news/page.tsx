import { Spinner } from "@/components/spinner";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getNewsArticles, type NewsArticle } from "@/lib/content";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "News · Sumo Ring" };

const ARCHIVE_AFTER_DAYS = 90;

/** Articles published before this timestamp go to the archive. */
function archiveCutoff() {
  return Date.now() - ARCHIVE_AFTER_DAYS * 86_400_000;
}

export default function Page({ searchParams }: PageProps<"/news">) {
  return (
    <section className="page flex flex-col gap-10">
      <h1 className="text-center font-display text-heading sm:text-heading-lg text-brand">News</h1>
      <Suspense fallback={<Spinner label="Loading news" />}>
        <NewsList searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function NewsList({ searchParams }: Pick<PageProps<"/news">, "searchParams">) {
  const sp = await searchParams;
  const archive = sp.archive === "1";
  const tag = typeof sp.tag === "string" ? sp.tag : undefined;
  await connection();
  const cutoff = archiveCutoff();

  const all = await getNewsArticles();
  const recent = all.filter((a) => new Date(a.publishedAt).getTime() >= cutoff);
  const archived = all.filter((a) => new Date(a.publishedAt).getTime() < cutoff);
  const pool = archive ? archived : recent;
  const list = tag ? pool.filter((a) => a.tags.includes(tag)) : pool;
  const tags = [...new Set(pool.flatMap((a) => a.tags))].sort();

  if (all.length === 0) {
    return (
      <p className="mx-auto max-w-xl rounded-card border border-line bg-surface p-6 text-body-sm">
        No articles yet. Headlines are collected from Japanese outlets and machine-translated by a scheduled job — see the README’s “News ingest” section.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Link href={archive ? "/news?archive=1" : "/news"} className={`border border-line px-3 py-1 text-caption font-bold ${!tag ? "bg-ink text-canvas" : "bg-surface"}`}>
            All
          </Link>
          {tags.map((t) => (
            <Link
              key={t}
              href={`/news?${new URLSearchParams({ ...(archive ? { archive: "1" } : {}), tag: t })}`}
              className={`border border-line px-3 py-1 text-caption font-bold ${tag === t ? "bg-ink text-canvas" : "bg-surface"}`}
            >
              {t}
            </Link>
          ))}
        </div>
        {archive ? (
          <Link href="/news" className="btn-pill bg-cobalt-stage">
            ← Latest news
          </Link>
        ) : (
          archived.length > 0 && (
            <Link href="/news?archive=1" className="btn-pill bg-plum-velvet">
              Archive ({archived.length})
            </Link>
          )
        )}
      </div>

      {archive && <p className="text-body-sm text-ink-soft">Articles older than 3 months.</p>}

      {list.length === 0 ? (
        <p className="text-body-sm">No articles{tag ? ` tagged “${tag}”` : ""}.</p>
      ) : archive ? (
        <ul className="divide-y divide-line border-y border-line">
          {list.map((a) => (
            <li key={a.id} className="flex justify-between gap-4 py-3 text-body-sm">
              <Link href={`/news/${a.slug}`} className="font-bold hover:underline">
                {a.title}
              </Link>
              <span className="shrink-0 text-ink-soft">{formatDate(a.publishedAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {list.map((a, i) => (
            <ArticleCard key={a.id} article={a} lead={i === 0 && !tag} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ArticleCard({ article: a, lead }: { article: NewsArticle; lead: boolean }) {
  return (
    <li className={lead ? "md:col-span-2 lg:col-span-3" : ""}>
      <Link href={`/news/${a.slug}`} className="flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-6 hover:bg-hover">
        <span className="flex flex-wrap gap-2">
          {a.tags.slice(0, 3).map((t) => (
            <span key={t} className="badge">
              {t}
            </span>
          ))}
        </span>
        <span className={`font-display font-bold leading-tight tracking-tight text-brand ${lead ? "text-heading md:text-heading-lg" : "text-subheading"}`}>{a.title}</span>
        <span className="text-body-sm">{a.summary}</span>
        <span className="mt-auto text-caption text-ink-soft">
          {formatDate(a.publishedAt)} · {a.sources.length > 1 ? `${a.sources.length} outlets` : (a.sources[0]?.publisher ?? "")}
        </span>
      </Link>
    </li>
  );
}
