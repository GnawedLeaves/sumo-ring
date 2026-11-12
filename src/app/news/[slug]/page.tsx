import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getNewsArticle } from "@/lib/content";
import { formatDate } from "@/lib/format";

export default function Page({ params }: PageProps<"/news/[slug]">) {
  return (
    <section className="page">
      <Suspense fallback={<p className="text-body-sm">Loading article…</p>}>
        <Article params={params} />
      </Suspense>
    </section>
  );
}

async function Article({ params }: Pick<PageProps<"/news/[slug]">, "params">) {
  const a = await getNewsArticle((await params).slug);
  if (!a) notFound();
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/news" className="link-accent self-start border-electric-teal text-body-sm">
        ← News
      </Link>
      <div className="flex flex-wrap gap-2">
        {a.tags.map((t) => (
          <Link key={t} href={`/news?tag=${encodeURIComponent(t)}`} className="badge">
            {t}
          </Link>
        ))}
      </div>
      <h1 className="font-display text-heading sm:text-heading-lg font-bold leading-none tracking-tight text-brand">{a.title}</h1>
      <p className="text-caption text-ink-soft">
        {formatDate(a.publishedAt)} · Machine-translated from Japanese (DeepL)
        {a.sources.length > 1 && ` · Reported by ${a.sources.length} outlets`}
      </p>
      {a.sources[0] && (
        <p lang="ja" className="text-body-sm text-ink-soft">
          {a.sources[0].title}
        </p>
      )}
      {a.summary && <p className="font-display text-subheading">{a.summary}</p>}
      {/* Body is plain Markdown-ish text; paragraphs split on blank lines. Empty for translated news briefs. */}
      {a.body.trim() && (
        <div className="flex flex-col gap-4 text-body">
          {a.body.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p.replace(/^#+\s*/, "")}</p>
          ))}
        </div>
      )}
      {a.sources[0] && (
        <a href={a.sources[0].url} target="_blank" rel="noopener noreferrer" className="btn-pill self-start bg-cobalt-stage">
          Read the full story{a.sources[0].publisher ? ` at ${a.sources[0].publisher}` : ""} ↗
        </a>
      )}
      {a.sources.length > 0 && (
        <section className="border-t border-line pt-4">
          <h2 className="text-caption font-bold uppercase text-ink-soft">{a.sources.length > 1 ? "Coverage (Japanese)" : "Source (Japanese)"}</h2>
          <ul className="mt-2 flex flex-col gap-2 text-body-sm">
            {a.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" lang="ja" className="link-accent border-vermillion">
                  {s.title}
                </a>
                {s.publisher && <span className="text-ink-soft"> — {s.publisher}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
