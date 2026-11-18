// Telegram bot that sends clip videos with the bout title as the caption (one message, not video + text).
// Webhook: src/app/api/telegram/route.ts. Setup: README "Telegram bot".
import "server-only";
import { boutTitle } from "./basho";
import type { Clip } from "./content";

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? "";

export const telegramConfigured = () => Boolean(TOKEN() && process.env.TELEGRAM_WEBHOOK_SECRET);
/** Bot username without the @, for t.me links. */
export const telegramBotUsername = () => (process.env.TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "") || null;

/** Telegram fetches videos sent by URL itself, up to 20 MB, and only as MP4 for inline results. */
export const TELEGRAM_URL_LIMIT = 20 * 1024 * 1024;

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.status}`);
  return json.result as T;
}

/** "Kyushu Basho 2026 Day 9: Hoshoryu vs Onosato (Rematch)" */
export function clipCaption(c: Clip) {
  const title = boutTitle(c.bashoId, c.day, c.eastShikona || "East", c.westShikona || "West");
  return c.remarks ? `${title} (${c.remarks})` : title;
}

/** Why Telegram can't fetch a video by URL, or null when it can. */
export type Unsendable = "too-large" | "not-mp4" | "unreachable";

/**
 * Size + type of each video, remembered per server instance so repeat searches don't re-check every file.
 * Only real answers are remembered: a failed check (e.g. a just-uploaded asset the CDN doesn't serve yet) is retried
 * on the next search instead of hiding that clip until the server restarts.
 */
const probed = new Map<string, { size: number; type: string }>();

/** null when Telegram can fetch this video by URL (MP4, ≤ 20 MB), else the reason. Unknown sizes/types are allowed. */
export async function unsendableReason(url: string): Promise<Unsendable | null> {
  let p = probed.get(url);
  if (!p) {
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(3000) });
      if (!res.ok) return "unreachable";
      p = { size: Number(res.headers.get("content-length")) || 0, type: res.headers.get("content-type") ?? "" };
      probed.set(url, p);
    } catch {
      return null; // timeout: let Telegram try
    }
  }
  if (p.type && !p.type.startsWith("video/mp4")) return "not-mp4";
  if (p.size > TELEGRAM_URL_LIMIT) return "too-large";
  return null;
}

export const UNSENDABLE_TEXT: Record<Unsendable, string> = {
  "too-large": "Over Telegram's 20 MB limit",
  "not-mp4": "Not an MP4, so Telegram can't send it",
  unreachable: "Video not available yet",
};
