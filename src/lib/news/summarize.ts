// Turns a Japanese sumo news item into a short English news brief with Claude.
// We write an original summary in our own words and link to the source — we do not republish full
// translations of copyrighted articles.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { FeedItem } from "./feeds";

export const NEWS_TAGS = [
  "Results",
  "Yokozuna",
  "Ozeki",
  "Banzuke",
  "Promotion",
  "Injury",
  "Retirement",
  "Yusho race",
  "Stables",
  "Kyokai",
  "Interview",
  "Debut",
] as const;

const Brief = z.object({
  title: z.string().describe("English headline, max ~90 characters, news style"),
  summary: z.string().describe("One-sentence English standfirst"),
  body: z.string().describe("2-4 short English paragraphs separated by a blank line, ~120-220 words, written in your own words"),
  tags: z.array(z.string()).describe("2-5 tags: pick from the allowed topic tags, plus shikona of rikishi who are central to the story"),
});
export type NewsBrief = z.infer<typeof Brief>;

const SYSTEM = `You are the English news editor for a sumo fan site. You receive a Japanese sumo news item (headline + text or excerpt) and write a short, original English news brief about it.

Rules:
- Write in your own words. Summarise the facts; do not translate the article sentence by sentence and do not quote more than a short phrase.
- Only state facts present in the source. If the source is a short excerpt, write a shorter brief rather than inventing detail.
- Romanise shikona the way the Japan Sumo Association does in English (e.g. 豊昇龍 -> Hoshoryu, 大の里 -> Onosato, 宇良 -> Ura). Use standard sumo terms in romaji (yokozuna, ozeki, kinboshi, yusho, kimarite names such as yorikiri).
- Neutral, factual tone; no hype.
- Tags: choose from these topic tags where they apply: ${NEWS_TAGS.join(", ")}. You may add the English shikona of rikishi central to the story.`;

let client: Anthropic | null = null;
export const summarizerConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

/** Returns null when every model in the fallback chain declines, so the item is skipped rather than retried forever. */
export async function summarize(item: FeedItem): Promise<NewsBrief | null> {
  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // If a safety classifier declines, the API re-runs the request on a suitable fallback model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // Routine summarisation: low effort keeps cost and latency down.
    output_config: { effort: "low", format: betaZodOutputFormat(Brief) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Source: ${item.source.publisher}\nPublished: ${item.publishedAt}\n\n見出し: ${item.title}\n\n本文:\n${item.text}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  return response.parsed_output ?? null;
}
