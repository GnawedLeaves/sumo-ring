// Auto-clipper upload: POST { boutId, eastShikona, westShikona } (or { fileName }) -> a presigned Hygraph upload
// target (the worker POSTs the file there itself, as the browser does on the bout page). With a bout, the asset is
// named like manual uploads: "Kyushu Basho 2026 Day 12: Shonannoumi vs Ryuho.mp4".
// GET ?assetId= -> processing status, polled before saving.
// `Authorization: Bearer $RECORDER_SECRET`.
import { boutTitle } from "@/lib/basho";
import { store } from "@/lib/content";
import { parseBoutId } from "@/lib/format";
import { recorderAuthError, recorderFailure } from "@/lib/recorder-auth";

type Body = { fileName?: string; boutId?: string; eastShikona?: string; westShikona?: string };

export async function POST(request: Request) {
  const denied = recorderAuthError(request);
  if (denied) return denied;
  const b = (await request.json().catch(() => ({}))) as Body;
  const bout = b.boutId ? parseBoutId(b.boutId) : null;
  const fileName =
    bout && b.eastShikona && b.westShikona ? `${boutTitle(bout.bashoId, bout.day, b.eastShikona, b.westShikona)}.mp4` : b.fileName;
  if (!fileName) return Response.json({ error: "Need boutId + eastShikona + westShikona, or fileName" }, { status: 400 });
  try {
    const target = await store.createUpload(fileName);
    if (!target) return Response.json({ error: "Uploads need Hygraph to be configured" }, { status: 503 });
    return Response.json(target);
  } catch (e) {
    return recorderFailure(e);
  }
}

export async function GET(request: Request) {
  const denied = recorderAuthError(request);
  if (denied) return denied;
  const assetId = new URL(request.url).searchParams.get("assetId");
  if (!assetId) return Response.json({ error: "Missing assetId" }, { status: 400 });
  try {
    const status = await store.getUploadStatus(assetId);
    if (!status) return Response.json({ error: "Asset not found" }, { status: 404 });
    return Response.json(status);
  } catch (e) {
    return recorderFailure(e);
  }
}
