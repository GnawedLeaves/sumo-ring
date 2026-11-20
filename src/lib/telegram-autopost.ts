// Auto-posts auto-clipper clips to the owner's Telegram channel when a whitelisted wrestler is in the bout.
//
// Firestore (Admin SDK only; firestore.rules deny client access):
//   /settings/telegram         { whitelist: number[] }   rikishi ids, edited on /telegram (admins)
//   /telegramPosts/{clipId}    { boutId, postedAt, messageId? }   one per posted clip, so nothing posts twice
// Env: TELEGRAM_BOT_TOKEN (the bot must be an admin of the channel, allowed to post) and TELEGRAM_CHANNEL_ID
// ("@channelname" for a public channel, or the numeric id "-100…" for a private one). SITE_URL (optional) for links.
import "server-only";
import { adminDb, adminConfigured, withTimeout } from "./auth/firebase-admin";
import type { Clip } from "./content";
import { clipCaption, TELEGRAM_URL_LIMIT, unsendableReason } from "./telegram";

/** Telegram's upload limit for bots (multipart). Bigger clips are posted as a link instead. */
const TELEGRAM_UPLOAD_LIMIT = 50 * 1024 * 1024;

export const channelId = () => (process.env.TELEGRAM_CHANNEL_ID ?? "").trim() || null;
export const autoPostConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN && channelId() && adminConfigured);
const siteUrl = () => (process.env.SITE_URL ?? "https://sumo-ring.vercel.app").replace(/\/$/, "");

const settingsRef = async () => (await adminDb()).collection("settings").doc("telegram");

export async function getWhitelist(): Promise<number[]> {
  const snap = await withTimeout((await settingsRef()).get());
  const list = snap.exists ? (snap.data()?.whitelist as unknown) : [];
  return Array.isArray(list) ? list.filter((n): n is number => Number.isInteger(n)) : [];
}

export async function setWhitelisted(rikishiId: number, on: boolean) {
  // Loaded on demand, like the rest of firebase-admin (see auth/firebase-admin.ts).
  const { FieldValue } = await import("firebase-admin/firestore");
  await withTimeout(
    (await settingsRef()).set(
      { whitelist: on ? FieldValue.arrayUnion(rikishiId) : FieldValue.arrayRemove(rikishiId) },
      { merge: true },
    ),
  );
}

async function telegramUpload(method: string, form: FormData) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { message_id: number }; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.status}`);
  return json.result!;
}

/** Sends the clip as a video: by URL when Telegram can fetch it (≤ 20 MB MP4), uploaded when ≤ 50 MB, else a link. */
async function sendClip(chat: string, clip: Clip): Promise<number> {
  const caption = clipCaption(clip);
  const form = new FormData();
  form.append("chat_id", chat);
  form.append("caption", caption);
  form.append("supports_streaming", "true");

  const why = await unsendableReason(clip.videoUrl);
  if (why === null) {
    form.append("video", clip.videoUrl);
    return (await telegramUpload("sendVideo", form)).message_id;
  }
  if (why === "too-large") {
    const res = await fetch(clip.videoUrl, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
    const size = Number(res.headers.get("content-length")) || 0;
    if (res.ok && size > TELEGRAM_URL_LIMIT && size <= TELEGRAM_UPLOAD_LIMIT) {
      form.append("video", new Blob([await res.arrayBuffer()], { type: "video/mp4" }), "clip.mp4");
      return (await telegramUpload("sendVideo", form)).message_id;
    }
  }
  // Too big for a bot, not an MP4, or not served yet: post the title with a link to the bout page.
  const text = new FormData();
  text.append("chat_id", chat);
  text.append("text", `${caption}\n${siteUrl()}/bout/${clip.boutId}`);
  return (await telegramUpload("sendMessage", text)).message_id;
}

/**
 * Posts an auto clip to the channel if either wrestler is whitelisted. Runs after the response (after()), so it
 * logs instead of throwing. Each clip is posted at most once (a create() on /telegramPosts/{clipId} claims it).
 */
export async function autoPostClip(clip: Clip): Promise<void> {
  const chat = channelId();
  if (!chat || !autoPostConfigured()) return;
  try {
    const whitelist = await getWhitelist();
    if (!whitelist.includes(clip.eastId) && !whitelist.includes(clip.westId)) return;
    const claim = (await adminDb()).collection("telegramPosts").doc(clip.id);
    try {
      await withTimeout(claim.create({ boutId: clip.boutId, postedAt: Date.now() }));
    } catch {
      return; // already posted (or being posted)
    }
    const messageId = await sendClip(chat, clip);
    await claim.set({ messageId }, { merge: true });
    console.log(`[telegram] posted ${clip.title} to ${chat}`);
  } catch (e) {
    console.error(`[telegram] auto-post of ${clip.title} failed: ${e instanceof Error ? e.message : e}`);
  }
}
