// Scheduled news ingest. Call with `Authorization: Bearer $CRON_SECRET` (Render Cron Job, see README).
// `?dry=1` lists the stories it would create (tags, sources) without calling DeepL or writing anything.
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { TAGS } from "@/lib/content";
import { ingestNews } from "@/lib/news/ingest";

/**
 * Feeds + Sumo API roster + DeepL + up to 30 rate-limited Hygraph writes can take well over the platform's
 * default function timeout (10s on some Vercel plans), which kills the run part-way. 60s is allowed on every plan.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const report = await ingestNews({ dryRun: sp.get("dry") === "1", limit: Number(sp.get("limit")) || undefined });
  if (report.created.length || report.sourcesAdded.length) revalidateTag(TAGS.news, "max");
  // One line per run in the platform logs, so a run that saved nothing says why.
  console.log(
    `[cron/news] fetched=${report.fetched} stories=${report.stories} alreadyStored=${report.alreadyStored} created=${report.created.length} ` +
      `sourcesAdded=${report.sourcesAdded.length} dryRun=${report.dryRun}${report.errors.length ? ` errors=${JSON.stringify(report.errors)}` : ""}`,
  );
  return Response.json(report, { status: report.errors.length && !report.created.length && !report.dryRun ? 502 : 200 });
}
