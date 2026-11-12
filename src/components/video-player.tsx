"use client";

import { useSyncExternalStore } from "react";
import { toEmbed } from "@/lib/embed";

const noop = () => () => {};

/** Plays a YouTube / Twitch stream or VOD, or a direct video file, optionally clipped to start/end. */
export function VideoPlayer({ url, start, end, title }: { url: string; start?: number; end?: number; title: string }) {
  // Twitch needs the embedding page's hostname, which only exists in the browser.
  const host = useSyncExternalStore(noop, () => window.location.hostname, () => null);

  if (!host) return <div className="aspect-video w-full bg-black" />;

  const target = toEmbed(url, { parent: host, start, end });
  if (target.kind === "invalid") {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-black p-6 text-center text-body-sm text-white">
        Can&apos;t play this link. {target.reason}
      </div>
    );
  }
  if (target.kind === "video") {
    return <video key={target.src} src={target.src} controls playsInline preload="metadata" className="aspect-video w-full bg-black" title={title} />;
  }
  return (
    <iframe
      key={target.src}
      src={target.src}
      title={title}
      className="aspect-video w-full bg-black"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}
