import "server-only";
import { store, type Clip } from "./content";
import { parseBoutId } from "./format";

export type UploadedClipInput = {
  boutId: string;
  /** Hygraph asset the video was uploaded to (store.createUpload). It must have finished processing. */
  assetId: string;
  eastShikona: string;
  westShikona: string;
  title?: string;
  remarks?: string;
};

/**
 * Attaches an uploaded video to a bout as a Clip: checks the asset finished processing, publishes it, and creates
 * the published Clip entry. Shared by the bout page's upload form (saveClip server action) and the auto-clipper
 * (/api/recorder/clip). Callers invalidate TAGS.clips themselves: updateTag in a Server Action, revalidateTag in a
 * Route Handler.
 */
export async function createUploadedClip(input: UploadedClipInput): Promise<Clip> {
  const bout = parseBoutId(input.boutId);
  if (!bout) throw new Error("Unknown bout");
  if (!input.assetId) throw new Error("Choose a video file to upload");
  const asset = await store.getUploadStatus(input.assetId);
  if (!asset) throw new Error("Uploaded video not found in Hygraph");
  if (asset.status !== "complete") throw new Error(asset.error ?? "The video is still processing — try again in a moment");
  await store.publishUpload(input.assetId);
  const clip = await store.createClip({
    // Only fields the Clip model has — matchNo is already encoded in boutId.
    bashoId: bout.bashoId,
    day: bout.day,
    eastId: bout.eastId,
    westId: bout.westId,
    boutId: input.boutId,
    title: input.title?.trim() || `${input.eastShikona} vs ${input.westShikona}`,
    eastShikona: input.eastShikona,
    westShikona: input.westShikona,
    source: "upload",
    videoUrl: asset.url!,
    remarks: input.remarks?.trim() || undefined,
  });
  await afterClipSaved(clip);
  return clip;
}

/**
 * Post-save hook. Future: auto-post clips of whitelisted wrestlers to the owner's Telegram channel. Nothing yet.
 */
async function afterClipSaved(clip: Clip): Promise<void> {
  void clip;
}
