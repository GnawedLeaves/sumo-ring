import Link from "next/link";
import { Portrait } from "@/components/portrait";
import { record, shikonaOnly } from "@/lib/format";
import type { BashoSummary } from "@/lib/sumo-data";

/** Yūshō winner + three runners-up (or the four leaders while a basho is in progress). */
export function Podium({ summary, portraits, size = "lg" }: { summary: BashoSummary; portraits: Record<number, string>; size?: "lg" | "md" }) {
  const lead = summary.winner ?? summary.runnersUp[0];
  const others = summary.winner ? summary.runnersUp : summary.runnersUp.slice(1, 4);
  if (!lead) return <p className="text-body-sm">No results yet.</p>;
  const big = size === "lg";
  return (
    <div className={`grid gap-6 ${big ? "md:grid-cols-[auto_1fr]" : ""}`}>
      <Link href={`/rikishi/${lead.rikishiID}`} className="flex items-end gap-5">
        <Portrait id={lead.rikishiID} en={lead.shikonaEn} jp={lead.shikonaJp} src={portraits[lead.rikishiID]} size={big ? "xl" : "lg"} />
        <span className="flex flex-col gap-1">
          <span className="badge self-start">{summary.winner ? "YŪSHŌ" : "LEADER"}</span>
          <span className={`font-display font-bold leading-none tracking-tight ${big ? "text-heading-lg" : "text-heading"}`}>{lead.shikonaEn}</span>
          <span className="font-jp text-body">{shikonaOnly(lead.shikonaJp)}</span>
          <span className="text-body-sm">
            {lead.rank} · <strong>{record(lead.wins, lead.losses, lead.absences)}</strong>
          </span>
        </span>
      </Link>
      <ul className={`grid grid-cols-3 gap-4 ${big ? "self-end" : ""}`}>
        {others.map((r) => (
          <li key={r.rikishiID}>
            <Link href={`/rikishi/${r.rikishiID}`} className="flex flex-col gap-1">
              <Portrait id={r.rikishiID} en={r.shikonaEn} jp={r.shikonaJp} src={portraits[r.rikishiID]} size={big ? "md" : "sm"} />
              <span className="font-bold leading-tight">{r.shikonaEn}</span>
              <span className="font-jp text-body-sm">{shikonaOnly(r.shikonaJp)}</span>
              <span className="text-caption">{record(r.wins, r.losses, r.absences)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
