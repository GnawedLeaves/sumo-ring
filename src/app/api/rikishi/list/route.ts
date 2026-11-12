// Paged, rank-sorted rikishi list for infinite scroll. Served from the cached roster index so
// scrolling never hits the Sumo API directly.
import type { NextRequest } from "next/server";
import { getPortraitMap } from "@/lib/content";
import { getActiveIndex, getRetiredIndex, searchIndex } from "@/lib/sumo-data";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") === "inactive" ? "inactive" : "active";
  const q = sp.get("q") ?? "";
  const skip = Math.max(0, Number(sp.get("skip")) || 0);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 40));

  const [index, portraits] = await Promise.all([status === "active" ? getActiveIndex() : getRetiredIndex(), getPortraitMap()]);
  const rows = q ? searchIndex(index, q) : index;
  const records = rows.slice(skip, skip + limit).map((r) => ({ ...r, portrait: portraits[r.id] }));
  return Response.json({ total: rows.length, skip, records });
}
