"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteStream, reorderStreams, saveStream } from "@/lib/actions";
import type { Stream } from "@/lib/content/types";

const input = "w-full border border-line bg-surface px-3 py-2 text-body-sm";

/** Admin-only editor for the stream list: add, rename/edit, delete, reorder. */
export function StreamManager({ streams, setupError }: { streams: Stream[]; setupError?: string | null }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed");
      else setEditing(null);
    });

  const move = (i: number, dir: -1 | 1) => {
    const ids = streams.map((s) => s.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    run(() => reorderStreams(ids));
  };

  return (
    <section className="flex flex-col gap-4 border border-dashed border-line p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-3 font-display text-subheading text-brand">
          Manage streams <span className="badge">ADMIN</span>
        </h2>
        <button type="button" className="btn-pill bg-tangerine-pop" onClick={() => setEditing("new")}>
          + Add stream
        </button>
      </div>
      {setupError && (
        <div className="border-2 border-crimson-spotlight p-3 text-body-sm">
          <p className="font-bold text-crimson-spotlight">Streams can&apos;t be saved yet.</p>
          <p className="mt-1">
            {/not defined in 'Query'|not defined/.test(setupError)
              ? "Your Hygraph project is missing the Stream model. Create it with the fields in docs/HYGRAPH.md, then reload."
              : setupError}
          </p>
        </div>
      )}
      {error && <p className="text-body-sm text-crimson-spotlight">{error}</p>}
      {editing === "new" && <StreamForm onCancel={() => setEditing(null)} onSubmit={(f) => run(() => saveStream(f))} pending={pending} />}
      <ul className="divide-y divide-line border-y border-line">
        {streams.map((s, i) =>
          editing === s.id ? (
            <li key={s.id} className="py-3">
              <StreamForm stream={s} onCancel={() => setEditing(null)} onSubmit={(f) => run(() => saveStream(f))} pending={pending} />
            </li>
          ) : (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3 text-body-sm">
              <span className="flex flex-col">
                <button type="button" aria-label="Move up" disabled={i === 0 || pending} onClick={() => move(i, -1)} className="leading-none disabled:opacity-30">
                  <ChevronUp aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === streams.length - 1 || pending}
                  onClick={() => move(i, 1)}
                  className="leading-none disabled:opacity-30"
                >
                  <ChevronDown aria-hidden className="h-4 w-4" />
                </button>
              </span>
              <span className="flex-1">
                <strong>{s.name}</strong> <span className="text-caption uppercase text-ink-soft">{s.platform}</span>
                <span className="block truncate text-caption text-ink-soft">{s.url}</span>
              </span>
              <button type="button" className="underline" onClick={() => setEditing(s.id)}>
                Edit
              </button>
              <button
                type="button"
                className="text-crimson-spotlight underline"
                onClick={() => confirm(`Remove "${s.name}"?`) && run(() => deleteStream(s.id))}
              >
                Remove
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function StreamForm({ stream, onSubmit, onCancel, pending }: { stream?: Stream; onSubmit: (f: FormData) => void; onCancel: () => void; pending: boolean }) {
  return (
    <form action={onSubmit} className="grid gap-3 text-body-sm md:grid-cols-2">
      {stream && <input type="hidden" name="id" value={stream.id} />}
      {stream && <input type="hidden" name="order" value={stream.order} />}
      <label className="flex flex-col gap-1">
        Name
        <input name="name" required defaultValue={stream?.name} className={input} placeholder="NHK World — Grand Sumo" />
      </label>
      <label className="flex flex-col gap-1">
        URL
        <input name="url" required type="url" defaultValue={stream?.url} className={input} placeholder="https://www.youtube.com/watch?v=… or https://twitch.tv/…" />
      </label>
      <label className="flex flex-col gap-1">
        Platform
        <select name="platform" defaultValue={stream?.platform ?? ""} className={input}>
          <option value="">Detect from URL</option>
          <option value="youtube">YouTube</option>
          <option value="twitch">Twitch</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Note (optional)
        <input name="note" defaultValue={stream?.note} className={input} placeholder="English commentary, Makuuchi only…" />
      </label>
      <div className="flex gap-3 md:col-span-2">
        <button type="submit" disabled={pending} className="btn-pill bg-cobalt-stage disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
