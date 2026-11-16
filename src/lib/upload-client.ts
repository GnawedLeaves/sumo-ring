// Browser-side helpers for uploading a file straight to Hygraph's asset storage (clips, portraits).
import { checkClipUpload } from "@/lib/actions";
import type { UploadStatus, UploadTarget } from "@/lib/content/types";

const POLL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60_000;

/** POSTs the file to Hygraph's presigned S3 form with progress. Policy fields first, `file` last (required). */
export function sendToStorage(target: UploadTarget, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const body = new FormData();
    for (const [k, v] of Object.entries(target.fields)) body.append(k, v);
    body.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", target.postUrl);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.send(body);
  });
}

/**
 * Hygraph processes an asset before serving it; wait for ASSET_UPLOAD_COMPLETE.
 * `check` defaults to the admin clip check; user uploads (avatars) pass their own.
 */
export async function waitUntilProcessed(
  assetId: string,
  what = "file",
  check: (id: string) => Promise<UploadStatus | null> = checkClipUpload,
) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const s = await check(assetId);
    if (s?.status === "complete") return;
    if (s?.status === "error") throw new Error(s.error ?? `Hygraph couldn't process this ${what}`);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`Hygraph is still processing the ${what}. Try again in a minute.`);
}
