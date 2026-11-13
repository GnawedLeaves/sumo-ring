// Turns user-pasted YouTube / Twitch / video URLs into embeddable player URLs.
import type { Platform } from "./content/types";

export type EmbedTarget =
  | { kind: "iframe"; src: string }
  | { kind: "video"; src: string }
  | { kind: "invalid"; reason: string };

export function detectPlatform(url: string): Platform | null {
  if (/youtu\.?be/i.test(url)) return "youtube";
  if (/twitch\.tv/i.test(url)) return "twitch";
  return null;
}

function youtubeId(u: URL): string | null {
  const path = u.pathname.split("/").filter(Boolean);
  if (u.hostname.includes("youtu.be")) return path[0] ?? null;
  if (u.searchParams.get("v")) return u.searchParams.get("v");
  if (["embed", "live", "shorts", "v"].includes(path[0]) && path[1]) return path[1];
  return null;
}

/**
 * Preview image for a stream link, or null when there's no public one (YouTube channel links, Twitch VODs).
 * Twitch channel previews are live frames (an "offline" card when not live); Twitch serves them with max-age=300,
 * so browsers pick up a fresh frame every 5 minutes on their own.
 */
export function thumbnailFor(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const platform = detectPlatform(url);
  if (platform === "youtube") {
    const id = youtubeId(u);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  }
  if (platform === "twitch") {
    const path = u.pathname.split("/").filter(Boolean);
    if (u.hostname.startsWith("clips.") || !path[0] || path[0] === "videos" || path[1] === "clip") return null;
    return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${path[0].toLowerCase()}-640x360.jpg`;
  }
  return null;
}

function youtube(u: URL, start?: number, end?: number, autoplay?: boolean): EmbedTarget {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
  if (autoplay) params.set("autoplay", "1");
  if (start) params.set("start", String(Math.floor(start)));
  if (end) params.set("end", String(Math.floor(end)));
  const path = u.pathname.split("/").filter(Boolean);

  const id = youtubeId(u);
  if (!id && path[0] === "channel" && path[1]) {
    params.set("channel", path[1]);
    return { kind: "iframe", src: `https://www.youtube.com/embed/live_stream?${params}` };
  }
  if (!start && u.searchParams.get("t")) params.set("start", String(parseInt(u.searchParams.get("t")!, 10) || 0));
  if (!id) return { kind: "invalid", reason: "Use a video URL (youtube.com/watch?v=… or /live/…) or youtube.com/channel/UC…" };
  return { kind: "iframe", src: `https://www.youtube.com/embed/${id}?${params}` };
}

function twitchTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h${m}m${s}s`;
}

function twitch(u: URL, parent: string, start?: number, autoplay?: boolean): EmbedTarget {
  const path = u.pathname.split("/").filter(Boolean);
  if (u.hostname.startsWith("clips.") || path[1] === "clip") {
    const slug = u.hostname.startsWith("clips.") ? path[0] : path[2];
    return { kind: "iframe", src: `https://clips.twitch.tv/embed?clip=${slug}&parent=${parent}` };
  }
  const params = new URLSearchParams({ parent, autoplay: autoplay ? "true" : "false" });
  if (path[0] === "videos" && path[1]) {
    params.set("video", `v${path[1]}`);
    if (start) params.set("time", twitchTime(start));
  } else if (path[0]) {
    params.set("channel", path[0]);
  } else {
    return { kind: "invalid", reason: "Use twitch.tv/<channel> or twitch.tv/videos/<id>" };
  }
  return { kind: "iframe", src: `https://player.twitch.tv/?${params}` };
}

/** `parent` is the page hostname — Twitch refuses to embed without it. */
export function toEmbed(url: string, opts: { parent: string; start?: number; end?: number; autoplay?: boolean }): EmbedTarget {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { kind: "invalid", reason: "Not a valid URL" };
  }
  const platform = detectPlatform(url);
  if (platform === "youtube") return youtube(u, opts.start, opts.end, opts.autoplay);
  if (platform === "twitch") return twitch(u, opts.parent, opts.start, opts.autoplay);
  // Direct video file (e.g. a Hygraph asset). Media fragments give us start/end for free.
  const frag = opts.start || opts.end ? `#t=${opts.start ?? 0}${opts.end ? `,${opts.end}` : ""}` : "";
  return { kind: "video", src: `${url}${frag}` };
}
