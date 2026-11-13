import Link from "next/link";
import { Portrait } from "@/components/portrait";
import { record, shikonaOnly } from "@/lib/format";
import type { BashoSummary } from "@/lib/sumo-data";
import { Romaji } from "@/components/jp";

/** Yūshō winner + three runners-up (or the four leaders while a basho is in progress). */
/** A rikishi link, or a plain block when the whole podium already sits inside another link (History cards). */
function RikishiLink({ id, link, className, children }: { id: number; link: boolean; className: string; children: React.ReactNode }) {
  return link ? (
    <Link href={`/rikishi/${id}`} className={className}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}

export function Podium({
  summary,
  portraits,
  size = "lg",
  linkRikishi = true,
}: {
  summary: BashoSummary;
  portraits: Record<number, string>;
  size?: "lg" | "md";
  /** false when the podium is inside a card that is itself a link (no nested links). */
  linkRikishi?: boolean;
}) {
  const lead = summary.winner ?? summary.runnersUp[0];
  const others = summary.winner ? summary.runnersUp : summary.runnersUp.slice(1, 4);
  if (!lead) return <p className="text-body-sm">No results yet.</p>;
  const big = size === "lg";
  return (
    // Stacked (winner, then runners-up below) at every width: side by side, the winner's portrait + name took
    // the whole row and squeezed the runners-up until their names wrapped one letter per line.
    <div className="grid min-w-0 gap-6">
      <RikishiLink id={lead.rikishiID} link={linkRikishi} className="flex min-w-0 items-end gap-4 sm:gap-5">
        <Portrait id={lead.rikishiID} en={lead.shikonaEn} jp={lead.shikonaJp} src={portraits[lead.rikishiID]} size={big ? "xl" : "lg"} />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="badge self-start">{summary.winner ? "YŪSHŌ 優勝" : "LEADER"}</span>
          <span
            className={`break-words font-display font-bold leading-none tracking-tight ${big ? "text-subheading sm:text-heading xl:text-heading-lg" : "text-subheading sm:text-heading"}`}
          >
            {lead.shikonaEn}
          </span>
          <span className="font-jp text-body">{shikonaOnly(lead.shikonaJp)}</span>
          <span className="text-body-sm">
            <Romaji text={lead.rank} kind="rank" /> · <strong>{record(lead.wins, lead.losses, lead.absences)}</strong>
          </span>
        </span>
      </RikishiLink>
      <ul className={`grid grid-cols-3 gap-3 sm:gap-4 ${big ? "max-w-xl" : ""}`}>
        {others.map((r) => (
          <li key={r.rikishiID} className="min-w-0">
            <RikishiLink id={r.rikishiID} link={linkRikishi} className="flex min-w-0 flex-col gap-1 break-words">
              <Portrait id={r.rikishiID} en={r.shikonaEn} jp={r.shikonaJp} src={portraits[r.rikishiID]} size={big ? "md" : "sm"} />
              <span className="font-bold leading-tight">{r.shikonaEn}</span>
              <span className="font-jp text-body-sm">{shikonaOnly(r.shikonaJp)}</span>
              <span className="text-caption">{record(r.wins, r.losses, r.absences)}</span>
            </RikishiLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
