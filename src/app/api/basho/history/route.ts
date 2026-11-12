// Next page of past basho for the History tab's infinite scroll.
import type { NextRequest } from "next/server";
import { getHistoryPage, HISTORY_PAGE_SIZE } from "@/lib/basho-history";
import { getLiveContext } from "@/lib/live";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const skip = Math.max(0, Number(sp.get("skip")) || 0);
  const limit = Math.min(HISTORY_PAGE_SIZE, Math.max(1, Number(sp.get("limit")) || HISTORY_PAGE_SIZE));
  const ctx = await getLiveContext();
  return Response.json(await getHistoryPage(ctx, skip, limit));
}
