"use client";

import { useState, useTransition } from "react";
import { createClipUpload, deleteClip, saveClip } from "@/lib/actions";

type Props = {
  boutId: string;
  eastShikona: string;
  westShikona: string;
  clips: { id: string; title: string }[];
  streams: { id: string; name: string; url: string }[];
  uploadsEnabled: boolean;
};

const input = "w-full border border-line bg-surface px-3 py-2 text-body-sm";

export function ClipForm({ boutId, eastShikona, westShikona, clips, streams, uploadsEnabled }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function upload(file: File) {
    const target = await createClipUpload(file.name);
    if (!target) throw new Error("Uploads need Hygraph configured");
    const body = new FormData();
    for (const [k, v] of Object.entries(target.fields)) body.append(k, v);
    body.append("file", file);
    const res = await fetch(target.postUrl, { method: "POST", body });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return target.assetUrl;
  }

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      try {
        const file = form.get("file");
        if (mode === "upload" && file instanceof File && file.size) {
          setStatus("Uploading video…");
          form.set("videoUrl", await upload(file));
          form.set("source", "upload");
        } else {
          const stream = streams.find((s) => s.id === form.get("streamId"));
          if (stream && !form.get("videoUrl")) form.set("videoUrl", stream.url);
        }
        form.delete("file");
        setStatus("Saving…");
        const res = await saveClip(form);
        if (!res.ok) setError(res.error);
        else setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setStatus(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 border border-dashed border-line p-4">
      <div className="flex items-center justify-between">
        <span className="badge">ADMIN</span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="btn-pill bg-cobalt-stage">
          {open ? "Cancel" : "Add clip"}
        </button>
      </div>

      {clips.length > 0 && (
        <ul className="text-body-sm">
          {clips.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 border-t border-line py-1">
              {c.title}
              <button
                type="button"
                className="text-crimson-spotlight underline"
                onClick={() => confirm(`Delete clip "${c.title}"?`) && start(async () => void (await deleteClip(c.id)))}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form action={submit} className="flex flex-col gap-3 text-body-sm">
          <input type="hidden" name="boutId" value={boutId} />
          <input type="hidden" name="eastShikona" value={eastShikona} />
          <input type="hidden" name="westShikona" value={westShikona} />
          <label className="flex flex-col gap-1">
            Title
            <input name="title" className={input} placeholder={`${eastShikona} vs ${westShikona}`} />
          </label>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "link"} onChange={() => setMode("link")} /> Link / stream timestamp
            </label>
            <label className={`flex items-center gap-2 ${uploadsEnabled ? "" : "opacity-50"}`}>
              <input type="radio" disabled={!uploadsEnabled} checked={mode === "upload"} onChange={() => setMode("upload")} /> Upload file
            </label>
          </div>

          {mode === "link" ? (
            <>
              <label className="flex flex-col gap-1">
                Video URL (YouTube, Twitch VOD, or .mp4)
                <input name="videoUrl" className={input} placeholder="https://www.youtube.com/watch?v=…" />
              </label>
              {streams.length > 0 && (
                <label className="flex flex-col gap-1">
                  …or clip from a saved stream
                  <select name="streamId" className={input} defaultValue="">
                    <option value="">—</option>
                    {streams.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  Start (s or mm:ss)
                  <input name="start" className={input} placeholder="1:02:15" />
                </label>
                <label className="flex flex-col gap-1">
                  End
                  <input name="end" className={input} placeholder="1:02:48" />
                </label>
              </div>
            </>
          ) : (
            <label className="flex flex-col gap-1">
              Video file
              <input name="file" type="file" accept="video/*" required className={input} />
            </label>
          )}

          {error && <p className="text-crimson-spotlight">{error}</p>}
          <button type="submit" disabled={pending} className="btn-pill self-start bg-tangerine-pop disabled:opacity-60">
            {status ?? "Save clip"}
          </button>
        </form>
      )}
    </div>
  );
}
