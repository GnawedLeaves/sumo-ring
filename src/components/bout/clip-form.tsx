"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { createClipUpload, deleteClip, saveClip, setBoutStar } from "@/lib/actions";
import { sendToStorage, waitUntilProcessed } from "@/lib/upload-client";

type Props = {
  boutId: string;
  eastShikona: string;
  westShikona: string;
  /** Prefilled clip title, e.g. "Kyushu Basho 2026 Day 9: Hoshoryu vs Onosato". */
  defaultTitle: string;
  starred: boolean;
  clips: { id: string; title: string; remarks?: string }[];
  uploadsEnabled: boolean;
};

type Phase = { step: "idle" } | { step: "starting" } | { step: "uploading"; pct: number } | { step: "processing" } | { step: "saving" };

const input = "w-full border border-line bg-surface px-3 py-2 text-body-sm";
// The native file input: a big "Choose file" pill, then the file name, in a bordered box so the two read as separate.
const fileInput =
  "w-full cursor-pointer border border-line bg-surface p-2 text-body-sm text-ink-soft " +
  "file:mr-3 file:cursor-pointer file:rounded-pill file:border-0 file:bg-cobalt-stage file:px-6 file:py-3 file:font-bold file:text-white " +
  "hover:file:opacity-90 disabled:cursor-not-allowed disabled:file:opacity-60";

export function ClipForm({ boutId, eastShikona, westShikona, defaultTitle, starred, clips, uploadsEnabled }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [pending, start] = useTransition();
  const [starPending, startStar] = useTransition();
  /** Flips immediately; falls back to the server value if saving fails. */
  const [isStarred, setOptimisticStar] = useOptimistic(starred);
  /** Kept if saving fails after the upload succeeded, so a retry doesn't re-upload the file. */
  const uploaded = useRef<{ file: File; assetId: string } | null>(null);
  /** Synchronous lock: blocks a second submit fired before the "busy" re-render lands (e.g. a double tap). */
  const submitting = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = phase.step !== "idle";

  // Opening the form scrolls the file picker into view so it can be tapped straight away.
  useEffect(() => {
    if (open) fileRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [open]);

  function toggleStar() {
    const next = !isStarred;
    setError(null);
    startStar(async () => {
      setOptimisticStar(next);
      const res = await setBoutStar(boutId, next);
      if (!res.ok) setError(res.error);
    });
  }

  // onSubmit (not a form action) so the fields aren't reset on failure — a retry keeps the file and text.
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPhase({ step: "starting" });
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const file = form.get("file");
      if (!(file instanceof File) || !file.size) throw new Error("Choose a video file");
      if (!file.type.startsWith("video/")) throw new Error("That isn't a video file");
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
      await waitUntilProcessed(assetId, "video");

      setPhase({ step: "saving" });
      form.delete("file");
      form.set("assetId", assetId);
      const res = await saveClip(form);
      if (!res.ok) throw new Error(res.error);
      uploaded.current = null;
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      submitting.current = false;
      setPhase({ step: "idle" });
    }
  }

  const label =
    phase.step === "uploading"
      ? `Uploading… ${phase.pct}%`
      : phase.step === "processing"
        ? "Processing video…"
        : phase.step === "saving"
          ? "Saving…"
          : phase.step === "starting"
            ? "Starting…"
            : "Upload clip";

  return (
    <div className="flex flex-col gap-3 border border-dashed border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="badge">ADMIN</span>
        <span className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleStar}
            disabled={starPending}
            aria-pressed={isStarred}
            className={`btn-pill border border-line disabled:opacity-60 ${isStarred ? "bg-daffodil text-ink!" : "bg-surface text-ink!"}`}
          >
            <Star aria-hidden className="h-4 w-4" fill={isStarred ? "currentColor" : "none"} />
            {isStarred ? "Exciting" : "Mark exciting"}
          </button>
          {uploadsEnabled && (
            <button type="button" disabled={busy} onClick={() => setOpen((o) => !o)} className="btn-pill bg-cobalt-stage disabled:opacity-60">
              {open ? "Cancel" : "Add clip"}
            </button>
          )}
        </span>
      </div>

      {!uploadsEnabled && <p className="text-body-sm">Clip uploads need Hygraph — set HYGRAPH_ENDPOINT and HYGRAPH_TOKEN.</p>}

      {clips.length > 0 && (
        <ul className="text-body-sm">
          {clips.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 border-t border-line py-1">
              <span className="min-w-0 break-words">
                {c.title}
                {c.remarks && <span className="block text-caption text-ink-soft">{c.remarks}</span>}
              </span>
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

      {!open && error && <p className="text-body-sm text-crimson-spotlight">{error}</p>}

      {open && uploadsEnabled && (
        <form onSubmit={submit} className="flex flex-col gap-3 text-body-sm">
          <input type="hidden" name="boutId" value={boutId} />
          <input type="hidden" name="eastShikona" value={eastShikona} />
          <input type="hidden" name="westShikona" value={westShikona} />
          <label className="flex flex-col gap-1">
            Video file
            <input ref={fileRef} name="file" type="file" accept="video/*" required className={fileInput} disabled={busy} />
          </label>
          <label className="flex flex-col gap-1">
            Title
            <input name="title" className={input} defaultValue={defaultTitle} disabled={busy} />
          </label>
          <label className="flex flex-col gap-1">
            <span>
              Remarks <span className="text-ink-soft">(optional — shown under the clip)</span>
            </span>
            <input name="remarks" className={input} placeholder="e.g. Rematch (torinaoshi)" disabled={busy} />
          </label>
          {phase.step === "uploading" && (
            <div className="h-2 border border-line" role="progressbar" aria-valuenow={phase.pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-tangerine-pop transition-[width]" style={{ width: `${phase.pct}%` }} />
            </div>
          )}
          {error && <p className="text-crimson-spotlight">{error}</p>}
          <button type="submit" disabled={busy} aria-busy={busy} className="btn-pill self-start bg-tangerine-pop disabled:cursor-not-allowed disabled:opacity-60">
            {label}
          </button>
        </form>
      )}
    </div>
  );
}
