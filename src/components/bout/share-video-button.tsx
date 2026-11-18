"use client";

import { Download, Send } from "lucide-react";
import { useRef, useState } from "react";

type State = { step: "idle" } | { step: "loading"; pct: number | null } | { step: "ready" } | { step: "error"; message: string };

/**
 * Shares the clip's video FILE (not a link) with its title as the message, through the phone's share sheet —
 * pick Telegram there, then the chat. Works in mobile browsers and the installed PWA (Android and iOS).
 *
 * The video is downloaded first. Browsers only open the share sheet straight after a tap, and a download can
 * outlast that window, so if the sheet is refused the button turns into "Send video" and the next tap shares
 * the already-downloaded file immediately. Where files can't be shared (most desktops), the video is saved instead.
 */
export function ShareVideoButton({ url, title, remarks }: { url: string; title: string; remarks?: string }) {
  const [state, setState] = useState<State>({ step: "idle" });
  const file = useRef<File | null>(null);
  const text = remarks ? `${title} (${remarks})` : title;

  async function download(): Promise<File> {
    if (file.current) return file.current;
    setState({ step: "loading", pct: null });
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Couldn't download the video (${res.status})`);
    const total = Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      if (total) setState({ step: "loading", pct: Math.round((got / total) * 100) });
    }
    const type = res.headers.get("content-type")?.split(";")[0] || "video/mp4";
    const ext = type === "video/quicktime" ? "mov" : type.split("/")[1] || "mp4";
    const name = `${text.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim()}.${ext}`;
    file.current = new File(chunks, name, { type });
    return file.current;
  }

  function save(f: File) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  async function onClick() {
    try {
      const f = await download();
      const data: ShareData = { files: [f], text };
      if (typeof navigator.canShare !== "function" || !navigator.canShare(data)) {
        save(f);
        setState({ step: "idle" });
        return;
      }
      try {
        await navigator.share(data);
        setState({ step: "idle" });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return setState({ step: "idle" }); // sheet closed
        // The tap "expired" while downloading: the file is ready, so the next tap opens the sheet at once.
        if (e instanceof DOMException && e.name === "NotAllowedError") return setState({ step: "ready" });
        throw e;
      }
    } catch (e) {
      setState({ step: "error", message: e instanceof Error ? e.message : "Couldn't share the video" });
    }
  }

  const loading = state.step === "loading";
  const label = loading
    ? `Preparing video…${state.pct !== null ? ` ${state.pct}%` : ""}`
    : state.step === "ready"
      ? "Video ready — tap to send"
      : "Share video";

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 self-start text-body-sm transition-colors hover:text-brand disabled:opacity-60 ${
          state.step === "ready" ? "font-bold text-brand" : "text-ink-soft"
        }`}
      >
        {state.step === "ready" ? <Send aria-hidden className="h-4 w-4" /> : <Download aria-hidden className="h-4 w-4" />}
        {label}
      </button>
      {state.step === "error" && (
        <span role="alert" className="text-caption text-crimson-spotlight">
          {state.message}
        </span>
      )}
    </span>
  );
}
