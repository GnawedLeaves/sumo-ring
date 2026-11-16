"use server";
// Actions any signed-in user may take on THEIR OWN account. Each one re-reads the session server-side and only
// ever touches /profiles/{that user's uid}.
import type { ActionResult } from "./actions";
import type { UploadTarget } from "./content/types";
import { requireUser } from "./auth/session";
import { store } from "./content";
import { ensureProfile, updateProfileDoc } from "./profiles";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
/** Raster images only (no SVG: it can carry scripts). */
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
/** At most one new upload per user per this long — stops anyone filling the Hygraph asset quota. */
const UPLOAD_COOLDOWN_MS = 20_000;

const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Something went wrong" });

/**
 * Starts an avatar upload: returns a presigned Hygraph upload target for the browser to send the file to.
 * The asset id is remembered on the profile, so only this user can later turn it into their avatar.
 */
export async function createAvatarUpload(
  fileName: string,
  size: number,
  type: string,
): Promise<{ ok: true; target: UploadTarget } | { ok: false; error: string }> {
  try {
    const viewer = await requireUser();
    if (!ALLOWED_TYPES.has(type)) throw new Error("Choose a JPG, PNG, WebP, GIF or AVIF image");
    if (!(size > 0 && size <= MAX_AVATAR_BYTES)) throw new Error("Image must be 5 MB or smaller");
    const profile = await ensureProfile(viewer.uid);
    if (profile.lastAvatarUploadAt && Date.now() - profile.lastAvatarUploadAt < UPLOAD_COOLDOWN_MS) {
      throw new Error("Please wait a few seconds before uploading again");
    }
    const ext = fileName.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? "";
    const target = await store.createUpload(`avatar-${viewer.uid}${ext}`);
    if (!target) throw new Error("Picture uploads need Hygraph to be configured");
    await updateProfileDoc(viewer.uid, { pendingAvatar: target.assetId, lastAvatarUploadAt: Date.now() });
    return { ok: true, target };
  } catch (e) {
    return fail(e);
  }
}

/** Polled while Hygraph processes the upload. Only for the caller's own pending upload. */
export async function checkAvatarUpload(assetId: string) {
  const viewer = await requireUser();
  const profile = await ensureProfile(viewer.uid);
  if (profile.pendingAvatar !== assetId) throw new Error("Upload not found");
  return store.getUploadStatus(assetId);
}

/** Makes the processed upload the caller's avatar, after checking it really is a small image. */
export async function saveAvatar(assetId: string): Promise<ActionResult> {
  try {
    const viewer = await requireUser();
    const profile = await ensureProfile(viewer.uid);
    if (profile.pendingAvatar !== assetId) throw new Error("Upload not found — try again");
    const asset = await store.getUploadStatus(assetId);
    if (!asset) throw new Error("Upload not found — try again");
    if (asset.status !== "complete") throw new Error(asset.error ?? "Still processing — try again in a moment");
    // Trust what Hygraph stored, not what the browser said it was sending.
    if (!asset.mimeType || !ALLOWED_TYPES.has(asset.mimeType) || (asset.size ?? Infinity) > MAX_AVATAR_BYTES) {
      await store.deleteUpload(assetId).catch(() => {});
      await updateProfileDoc(viewer.uid, { pendingAvatar: null });
      throw new Error("That file isn't a supported image under 5 MB");
    }
    await store.publishUpload(assetId);
    await updateProfileDoc(viewer.uid, { photoURL: asset.url, avatarAssetId: assetId, pendingAvatar: null });
    // Remove the picture it replaces so old avatars don't pile up in Hygraph.
    if (profile.avatarAssetId && profile.avatarAssetId !== assetId) await store.deleteUpload(profile.avatarAssetId).catch(() => {});
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Back to the colour avatar. */
export async function removeAvatar(): Promise<ActionResult> {
  try {
    const viewer = await requireUser();
    const profile = await ensureProfile(viewer.uid);
    await updateProfileDoc(viewer.uid, { photoURL: null, avatarAssetId: null });
    if (profile.avatarAssetId) await store.deleteUpload(profile.avatarAssetId).catch(() => {});
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
