// Text messages the Telegram bot sends besides clips: current standings (or the final result) and the app link.
// Used by inline mode ("@bot standings", "@bot app") and the /standings and /app commands. Plain text, no markup.
import "server-only";
import { bashoInfo, bashoName } from "./basho";
import { record } from "./format";
import { getLiveContext } from "./live";
import { shortRank } from "./rank";
import type { BanzukeEntry } from "./sumo-api";
import { getBanzuke, getBashoSummary } from "./sumo-data";

/** "Kyushu Basho 2026" */
function bashoLabel(id: string) {
  const info = bashoInfo(id);
  return info ? `${info.en} Basho ${id.slice(0, 4)}` : bashoName(id);
}

/** Losses including absent days, as in the official standings (and the app's Standings). */
const lossesOf = (r: BanzukeEntry) => r.losses + r.absences;

/** "Onosato (Y1e) 10-1" */
const line = (r: BanzukeEntry) => `${r.shikonaEn} (${shortRank(r.rank)}) ${record(r.wins, r.losses, r.absences)}`;

/**
 * During a basho: the Makuuchi standings, fewest losses first, then by rank (banzuke order, East before West),
 * grouped by number of losses. Between basho: the last basho's winner and runners-up.
 */
export async function standingsMessage(origin: string): Promise<string> {
  const ctx = await getLiveContext();
  const label = bashoLabel(ctx.bashoId);
  const link = `${origin}/basho/${ctx.bashoId}`;

  if (ctx.active) {
    const entries = (await getBanzuke(ctx.bashoId, "Makuuchi", "live")) ?? [];
    if (entries.length === 0) return `${label}: standings aren't available yet.\n\n${link}`;
    // The day is the most bouts anyone has on record, so it always matches the records shown.
    const day = Math.max(0, ...entries.map((r) => r.wins + r.losses + r.absences));
    const sorted = [...entries].sort(
      (a, b) => lossesOf(a) - lossesOf(b) || a.rankValue - b.rankValue || (a.side === b.side ? 0 : a.side === "East" ? -1 : 1),
    );
    const out = [`${label}${day ? ` · Standings after Day ${day}` : " · Standings"} (Makuuchi)`];
    let group = -1;
    for (const r of sorted) {
      if (lossesOf(r) !== group) {
        group = lossesOf(r);
        out.push("", group === 0 ? "Undefeated" : `${group} loss${group === 1 ? "" : "es"}`);
      }
      out.push(line(r));
    }
    out.push("", `Full standings: ${link}`);
    return out.join("\n");
  }

  const summary = await getBashoSummary(ctx.bashoId);
  if (!summary?.winner) return `${label}: the final results aren't available yet.\n\n${link}`;
  return [
    `${label} · Final result`,
    "",
    `🏆 Winner: ${line(summary.winner)}`,
    ...(summary.runnersUp.length ? ["", "Runners-up:", ...summary.runnersUp.map(line)] : []),
    "",
    `Full results: ${link}`,
  ].join("\n");
}

export function appMessage(origin: string) {
  return `Sumo Ring: live sumo standings, bouts and clips\n${origin}`;
}
