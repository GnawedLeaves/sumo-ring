"use client";

import { useRef, useState, useTransition } from "react";
import { checkClipUpload, createClipUpload, deleteClip, saveClip } from "@/lib/actions";
import type { UploadTarget } from "@/lib/content/types";

type Props = {
  boutId: string;
  eastShikona: string;
  westShikona: string;
  clips: { id: string; title: string }[];
  uploadsEnabled: boolean;
};

type Phase = { step: "idle" } | { step: "uploading"; pct: number } | { step: "processing" } | { step: "saving" };

const input = "w-full border border-line bg-surface px-3 py-2 text-body-sm";
const POLL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60_000;

/** POSTs the file to Hygraph's presigned S3 form with progress. Policy fields first, `file` last (required). */
function sendToStorage(target: UploadTarget, file: File, onProgress: (pct: number) => void) {
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

/** Hygraph analyses the video before serving it; wait for ASSET_UPLOAD_COMPLETE. */
async function waitUntilProcessed(assetId: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const s = await checkClipUpload(assetId);
    if (s?.status === "complete") return;
    if (s?.status === "error") throw new Error(s.error ?? "Hygraph couldn't process this video");
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error("Hygraph is still processing the video. Try saving again in a minute.");
}

export function ClipForm({ boutId, eastShikona, westShikona, clips, uploadsEnabled }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [pending, start] = useTransition();
  /** Kept if saving fails after the upload succeeded, so a retry doesn't re-upload the file. */
  const uploaded = useRef<{ file: File; assetId: string } | null>(null);
  const busy = phase.step !== "idle";

  async function submit(form: FormData) {
    setError(null);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return setError("Choose a video file");
    if (!file.type.startsWith("video/")) return setError("That isn't a video file");
    try {
      let assetId = uploaded.current?.file === file ? uploaded.current.assetId : null;
      if (!assetId) {
        setPhase({ step: "uploading", pct: 0 });
        const target = await createClipUpload(file.name);
        if (!target) throw new Error("Video uploads need Hygraph to be configured");
        await sendToStorage(target, file, (pct) => setPhase({ step: "uploading", pct }));
        assetId = target.assetId;
        uploaded.current = { file, assetId };
      }
      setPhase({ step: "processing" });
      await waitUntilProcessed(assetId);

      setPhase({ step: "saving" });
      form.delete("file");
      form.set("assetId", assetId);
      const res = await saveClip(form);
      if (!res.ok) throw new Error(res.error);
      uploaded.current = null;
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPhase({ step: "idle" });
    }
  }

  const label =
    phase.step === "uploading" ? `Uploading… ${phase.pct}%` : phase.step === "processing" ? "Processing video…" : phase.step === "saving" ? "Saving…" : "Upload clip";

  return (
    <div className="flex flex-col gap-3 border border-dashed border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="badge">ADMIN</span>
        {uploadsEnabled && (
          <button type="button" disabled={busy} onClick={() => setOpen((o) => !o)} className="btn-pill bg-cobalt-stage disabled:opacity-60">
            {open ? "Cancel" : "Add clip"}
          </button>
        )}
      </div>

      {!uploadsEnabled && <p className="text-body-sm">Clip uploads need Hygraph — set HYGRAPH_ENDPOINT and HYGRAPH_TOKEN.</p>}

      {clips.length > 0 && (
        <ul className="text-body-sm">
          {clips.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 border-t border-line py-1">
              <span className="min-w-0 break-words">{c.title}</span>
              <button
                type="button"
                className="shrink-0 text-crimson-spotlight underline"
                onClick={() => confirm(`Delete clip "${c.title}"?`) && start(async () => void (await deleteClip(c.id)))}
              >
                {pending ? "…" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && uploadsEnabled && (
        <form action={submit} className="flex flex-col gap-3 text-body-sm">
          <input type="hidden" name="boutId" value={boutId} />
          <input type="hidden" name="eastShikona" value={eastShikona} />
          <input type="hidden" name="westShikona" value={westShikona} />
          <label className="flex flex-col gap-1">
            Title
            <input name="title" className={input} placeholder={`${eastShikona} vs ${westShikona}`} disabled={busy} />
          </label>
          <label className="flex flex-col gap-1">
            Video file
            <input name="file" type="file" accept="video/*" required className={input} disabled={busy} />
          </label>
          {phase.step === "uploading" && (
            <div className="h-2 border border-line" role="progressbar" aria-valuenow={phase.pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-tangerine-pop transition-[width]" style={{ width: `${phase.pct}%` }} />
            </div>
          )}
          {error && <p className="text-crimson-spotlight">{error}</p>}
          <button type="submit" disabled={busy} className="btn-pill self-start bg-tangerine-pop disabled:opacity-60">
            {label}
          </button>
        </form>
      )}
    </div>
  );
}
