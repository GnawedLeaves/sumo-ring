/**
 * Section head, broadsheet style: a tracked uppercase eyebrow (the Japanese name), a left-aligned serif
 * headline with tight tracking, a grey standfirst, and a hairline underneath.
 */
export function PageBanner({ title, jp, kicker }: { title: string; jp?: string; kicker?: string }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line pb-5">
      {jp && (
        <span lang="ja" className="eyebrow font-jp">
          {jp}
        </span>
      )}
      <h1 className="font-display text-heading-xl text-brand md:text-display">{title}</h1>
      {kicker && <p className="text-subheading text-ink-soft">{kicker}</p>}
    </div>
  );
}
