// Paged, rank-sorted rikishi list for infinite scroll. Served from the cached roster index so
// scrolling never hits the Sumo API directly.
import type { NextRequest } from "next/server";
import { getActiveIndex, getRetiredIndex, searchIndex } from "@/lib/sumo-data";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") === "inactive" ? "inactive" : "active";
  const q = sp.get("q") ?? "";
  const skip = Math.max(0, Number(sp.get("skip")) || 0);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 40));

  const index = status === "active" ? await getActiveIndex() : await getRetiredIndex();
  const rows = q ? searchIndex(index, q) : index;
  return Response.json({ total: rows.length, skip, records: rows.slice(skip, skip + limit) });
}
