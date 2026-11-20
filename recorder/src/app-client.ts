// Talks to the Sumo Ring app's recorder endpoints (src/app/api/recorder/* in the Next.js app). The worker never
// holds Hygraph credentials: the app hands out a presigned upload target and saves the clip.
//
// Env: APP_URL (default http://localhost:3000) and RECORDER_SECRET. When run from this repo, missing values are
// read from the app's ../.env.local, so local practice runs need no extra setup.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const rootEnv = path.resolve(import.meta.dirname, "../../.env.local");
if (!process.env.RECORDER_SECRET && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

type UploadTarget = { assetId: string; assetUrl: string; postUrl: string; fields: Record<string, string> };
type UploadStatus = { status: "pending" | "complete" | "error"; url?: string; error?: string };

async function call<T>(method: "GET" | "POST", route: string, body?: unknown): Promise<T> {
  const secret = process.env.RECORDER_SECRET;
  if (!secret) throw new Error("RECORDER_SECRET is not set");
  const res = await fetch(`${APP_URL}/api/recorder/${route}`, {
    method,
    headers: { authorization: `Bearer ${secret}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(`${route}: ${json.error ?? `HTTP ${res.status}`}`);
  return json;
}

export type RecorderConfig = {
  enabled: boolean;
  startTimeSgt: string;
  stopTimeSgt: string;
  streams: { name: string; url: string }[];
};

export const getConfig = () => call<RecorderConfig>("GET", "config");

const POLL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60_000;

/**
 * Uploads a video file to Hygraph via a presigned target and waits until it's processed. Returns the asset id.
 * With `bout`, the app names the asset after it ("Kyushu Basho 2026 Day 12: A vs B.mp4"), like manual uploads.
 */
export async function uploadVideo(
  file: string,
  bout?: { boutId: string; eastShikona: string; westShikona: string },
  log: (s: string) => void = () => {},
): Promise<string> {
  const target = await call<UploadTarget>("POST", "upload", bout ?? { fileName: path.basename(file) });
  const form = new FormData();
  // Policy fields first, `file` last (S3 POST rule).
  for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
  form.append("file", new Blob([await readFile(file)], { type: "video/mp4" }), path.basename(file));
  const res = await fetch(target.postUrl, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload to storage failed (HTTP ${res.status})`);
  log(`uploaded ${path.basename(file)}, waiting for Hygraph to process it…`);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const s = await call<UploadStatus>("GET", `upload?assetId=${encodeURIComponent(target.assetId)}`);
    if (s.status === "complete") return target.assetId;
    if (s.status === "error") throw new Error(s.error ?? "Hygraph couldn't process the video");
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error("Hygraph is still processing the video after 5 minutes");
}

/** Saves an uploaded video as the bout's clip. `note` is added to the "Auto clip" remarks (e.g. "Rematch"). */
export const saveClip = (input: { boutId: string; assetId: string; eastShikona: string; westShikona: string; note?: string }) =>
  call<{ ok: true; clipId: string; videoUrl: string }>("POST", "clip", input);
