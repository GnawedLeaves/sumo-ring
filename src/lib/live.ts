// "What's happening right now" — the active basho, today's day and the bout on the dohyō.
import "server-only";
import { connection } from "next/server";
import { bashoWindow, dayOf, latestStartedBashoId } from "./basho";
import { getBasho, getTorikumi } from "./sumo-data";
import type { Division, Match } from "./sumo-api";

export type LiveContext = {
  /** Latest basho that has started (possibly finished). */
  bashoId: string;
  active: boolean;
  /** Day number when active. */
  day: number | null;
  startDate?: string;
  endDate?: string;
};

export async function getLiveContext(): Promise<LiveContext> {
  await connection(); // reads the clock, so this must run per request
  const now = new Date();
  const id = latestStartedBashoId(now);
  const basho = await getBasho(id, "live");
  const window = bashoWindow(id, basho?.startDate);
  const day = dayOf(window, now);
  return { bashoId: id, active: day !== null, day, startDate: basho?.startDate, endDate: basho?.endDate };
}

export type CurrentBout = { bout: Match; division: Division; status: "up-now" | "day-complete" } | null;

/**
 * The first undecided top-division bout of the day. Juryo goes before Makuuchi, so while Juryo still has
 * undecided bouts the current bout is in Juryo. The API only records results after a bout ends, so this is
 * either the bout in progress or the next one up.
 */
export function findCurrentBout(juryo: Match[], makuuchi: Match[]): CurrentBout {
  const j = juryo.find((m) => !m.winnerId);
  if (j) return { bout: j, division: "Juryo", status: "up-now" };
  const mk = makuuchi.find((m) => !m.winnerId);
  if (mk) return { bout: mk, division: "Makuuchi", status: "up-now" };
  const last = makuuchi.at(-1);
  return last ? { bout: last, division: "Makuuchi", status: "day-complete" } : null;
}

export async function getTodaysBouts(ctx: LiveContext) {
  if (!ctx.active || !ctx.day) return { juryo: [], makuuchi: [], current: null as CurrentBout };
  const [juryo, makuuchi] = await Promise.all([
    getTorikumi(ctx.bashoId, ctx.day, "Juryo", "live"),
    getTorikumi(ctx.bashoId, ctx.day, "Makuuchi", "live"),
  ]);
  return { juryo, makuuchi, current: findCurrentBout(juryo, makuuchi) };
}
