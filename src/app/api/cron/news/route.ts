// Scheduled news ingest. Call with `Authorization: Bearer $CRON_SECRET` (Render Cron Job, see README).
// `?dry=1` lists what would be summarised without calling Claude or writing anything.
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { TAGS } from "@/lib/content";
import { ingestNews } from "@/lib/news/ingest";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const report = await ingestNews({ dryRun: sp.get("dry") === "1", limit: Number(sp.get("limit")) || undefined });
  if (report.created.length) revalidateTag(TAGS.news, "max");
  return Response.json(report, { status: report.errors.length && !report.created.length && !report.dryRun ? 502 : 200 });
}
