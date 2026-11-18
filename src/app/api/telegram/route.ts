// Telegram bot webhook (registered with setWebhook + secret_token, see README "Telegram bot").
//
// - Inline mode: in any chat, "@bot" lists the newest clips; "@bot hoshoryu" filters by shikona. Picking one sends
//   the video with the bout title as its caption, in a single message.
// - "/start <clipId>" (the app's "Send via Telegram" link): the bot replies with that clip and a
//   "Send to a chat" button, which opens Telegram's chat picker with the clip ready to send.
import type { NextRequest } from "next/server";
import { getClips, type Clip } from "@/lib/content";
import { clipCaption, sendableByUrl, telegramBotUsername, telegramConfigured, tg } from "@/lib/telegram";

type Update = {
  inline_query?: { id: string; query: string };
  message?: { chat: { id: number }; text?: string };
};

/** Telegram shows at most 50 inline results. */
const MAX_RESULTS = 20;

export async function POST(request: NextRequest) {
  if (!telegramConfigured()) return Response.json({ error: "Telegram bot is not configured" }, { status: 503 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json().catch(() => ({}))) as Update;
  try {
    if (update.inline_query) await answerInline(update.inline_query, request.nextUrl.origin);
    else if (update.message?.text) await answerMessage(update.message.chat.id, update.message.text);
  } catch (e) {
    // Always 200: a non-2xx makes Telegram retry the same update over and over.
    console.error(`[telegram] ${e instanceof Error ? e.message : e}`);
  }
  return Response.json({ ok: true });
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

async function findClips(query: string): Promise<Clip[]> {
  const all = await getClips(); // newest first, cached (tag: clips)
  const q = query.trim();
  if (!q) return all;
  const exact = all.find((c) => c.id === q);
  if (exact) return [exact];
  const words = norm(q).split(/\s+/);
  return all.filter((c) => {
    const hay = norm(`${c.eastShikona} ${c.westShikona} ${clipCaption(c)}`);
    return words.every((w) => hay.includes(w));
  });
}

async function answerInline(query: { id: string; query: string }, origin: string) {
  const candidates = (await findClips(query.query)).slice(0, MAX_RESULTS * 2);
  const ok = await Promise.all(candidates.map((c) => sendableByUrl(c.videoUrl)));
  const clips = candidates.filter((_, i) => ok[i]).slice(0, MAX_RESULTS);
  await tg("answerInlineQuery", {
    inline_query_id: query.id,
    cache_time: 30,
    results: clips.map((c) => ({
      type: "video",
      id: c.id,
      video_url: c.videoUrl,
      mime_type: "video/mp4",
      thumbnail_url: `${origin}/pwa-icon/192`,
      title: `${c.eastShikona} vs ${c.westShikona}`,
      description: clipCaption(c),
      caption: clipCaption(c),
    })),
  });
}

async function answerMessage(chatId: number, text: string) {
  const [cmd, arg = ""] = text.trim().split(/\s+/, 2);
  const clip = cmd === "/start" && arg ? (await findClips(arg)).find((c) => c.id === arg) : undefined;
  if (!clip) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: `Type @${telegramBotUsername() ?? "this bot"} in any chat to send a sumo clip, e.g. "@${telegramBotUsername() ?? "bot"} hoshoryu". Or tap "Send via Telegram" under a clip in Sumo Ring.`,
    });
    return;
  }
  const caption = clipCaption(clip);
  const button = { reply_markup: { inline_keyboard: [[{ text: "Send to a chat", switch_inline_query: clip.id }]] } };
  try {
    await tg("sendVideo", { chat_id: chatId, video: clip.videoUrl, caption, supports_streaming: true, ...button });
  } catch {
    // Over 20 MB (or not MP4): Telegram can't fetch it by URL.
    await tg("sendMessage", {
      chat_id: chatId,
      text: `${caption}\n\nThis clip is too large for Telegram to send directly. Use "Share video" in Sumo Ring instead.`,
    });
  }
}
