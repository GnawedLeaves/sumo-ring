"use server";
// Admin-only mutations. Every action re-checks the admin claim server-side — never trust the UI.
import { updateTag } from "next/cache";
import { requireAdmin } from "./auth/session";
import { store, TAGS, type Platform, type StreamInput } from "./content";
import { detectPlatform } from "./embed";
import { parseBoutId } from "./format";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (e: unknown): ActionResult => ({ ok: false, error: e instanceof Error ? e.message : "Something went wrong" });

function readStream(form: FormData): StreamInput {
  const url = String(form.get("url") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const platform = (String(form.get("platform") ?? "") || detectPlatform(url)) as Platform | null;
  if (!name) throw new Error("Name is required");
  if (!/^https?:\/\//.test(url)) throw new Error("URL must start with http(s)://");
  if (platform !== "youtube" && platform !== "twitch") throw new Error("Only YouTube and Twitch links are supported");
  return { name, url, platform, order: Number(form.get("order") ?? 0) || 0, note: String(form.get("note") ?? "").trim() || undefined };
}

export async function saveStream(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = String(form.get("id") ?? "");
    const input = readStream(form);
    if (id) await store.updateStream(id, input);
    else {
      const existing = await store.listStreams();
      await store.createStream({ ...input, order: existing.length ? Math.max(...existing.map((s) => s.order)) + 1 : 0 });
    }
    updateTag(TAGS.streams);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteStream(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await store.deleteStream(id);
    updateTag(TAGS.streams);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Persists a new order for the whole list (ids in display order). */
export async function reorderStreams(ids: string[]): Promise<ActionResult> {
  try {
    await requireAdmin();
    await Promise.all(ids.map((id, order) => store.updateStream(id, { order })));
    updateTag(TAGS.streams);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Saves a clip whose video file was uploaded to Hygraph (see createClipUpload). The asset URL is read
 * from Hygraph here rather than trusted from the browser.
 */
export async function saveClip(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const bout = parseBoutId(String(form.get("boutId") ?? ""));
    if (!bout) throw new Error("Unknown bout");
    const assetId = String(form.get("assetId") ?? "");
    if (!assetId) throw new Error("Choose a video file to upload");
    const asset = await store.getUploadStatus(assetId);
    if (!asset) throw new Error("Uploaded video not found in Hygraph");
    if (asset.status !== "complete") throw new Error(asset.error ?? "The video is still processing — try again in a moment");
    await store.publishUpload(assetId);
    await store.createClip({
      // Only fields the Clip model has — matchNo is already encoded in boutId.
      bashoId: bout.bashoId,
      day: bout.day,
      eastId: bout.eastId,
      westId: bout.westId,
      boutId: String(form.get("boutId")),
      title: String(form.get("title") ?? "").trim() || `${form.get("eastShikona")} vs ${form.get("westShikona")}`,
      eastShikona: String(form.get("eastShikona") ?? ""),
      westShikona: String(form.get("westShikona") ?? ""),
      source: "upload",
      videoUrl: asset.url,
    });
    updateTag(TAGS.clips);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteClip(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await store.deleteClip(id);
    updateTag(TAGS.clips);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Presigned upload target for a clip video (Hygraph only). The browser uploads the file directly. */
export async function createClipUpload(fileName: string) {
  await requireAdmin();
  return store.createUpload(fileName);
}

/**
 * Sets a rikishi's portrait to an image already uploaded to Hygraph (via createClipUpload, which works for any
 * file). The upload must have finished processing.
 */
export async function savePortrait(rikishiId: number, assetId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!Number.isInteger(rikishiId) || rikishiId <= 0) throw new Error("Unknown rikishi");
    const asset = await store.getUploadStatus(assetId);
    if (!asset) throw new Error("Uploaded image not found in Hygraph");
    if (asset.status !== "complete") throw new Error(asset.error ?? "The image is still processing — try again in a moment");
    await store.setPortrait(rikishiId, assetId);
    updateTag(TAGS.portraits);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Polled by the clip form after the file is sent: Hygraph processes the video before serving it. */
export async function checkClipUpload(assetId: string) {
  await requireAdmin();
  return store.getUploadStatus(assetId);
}
