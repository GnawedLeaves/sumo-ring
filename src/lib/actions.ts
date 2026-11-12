"use server";
// Admin-only mutations. Every action re-checks the admin claim server-side — never trust the UI.
import { updateTag } from "next/cache";
import { requireAdmin } from "./auth/session";
import { store, TAGS, type ClipInput, type Platform, type StreamInput } from "./content";
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

const toSec = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  // accepts 754, 12:34 or 1:02:03
  const parts = s.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) throw new Error(`Bad timestamp "${s}"`);
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

export async function saveClip(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const bout = parseBoutId(String(form.get("boutId") ?? ""));
    if (!bout) throw new Error("Unknown bout");
    const videoUrl = String(form.get("videoUrl") ?? "").trim();
    if (!/^https?:\/\//.test(videoUrl)) throw new Error("Add a video URL or upload a file");
    const source = (String(form.get("source") ?? "") || detectPlatform(videoUrl) || "url") as ClipInput["source"];
    const startSec = toSec(form.get("start"));
    const endSec = toSec(form.get("end"));
    if (startSec !== undefined && endSec !== undefined && endSec <= startSec) throw new Error("End must be after start");
    await store.createClip({
      ...bout,
      boutId: String(form.get("boutId")),
      title: String(form.get("title") ?? "").trim() || `${form.get("eastShikona")} vs ${form.get("westShikona")}`,
      eastShikona: String(form.get("eastShikona") ?? ""),
      westShikona: String(form.get("westShikona") ?? ""),
      source,
      videoUrl,
      startSec,
      endSec,
      streamId: String(form.get("streamId") ?? "") || undefined,
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
