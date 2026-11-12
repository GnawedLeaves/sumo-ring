// Autocomplete suggestions across active and retired rikishi.
import type { NextRequest } from "next/server";
import { getActiveIndex, getRetiredIndex, searchIndex } from "@/lib/sumo-data";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json({ records: [] });
  const [active, retired] = await Promise.all([getActiveIndex(), getRetiredIndex()]);
  // Active first: people mostly look up current wrestlers.
  const records = [...searchIndex(active, q).slice(0, 6), ...searchIndex(retired, q).slice(0, 4)];
  return Response.json({ records });
}
