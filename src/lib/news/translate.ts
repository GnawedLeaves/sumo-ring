// Japanese -> English machine translation with the DeepL API (https://developers.deepl.com/docs).
// Free keys end in ":fx" and use api-free.deepl.com; the free tier allows 500,000 source characters a month.
import "server-only";

const key = () => process.env.DEEPL_API_KEY ?? "";
export const translatorConfigured = () => Boolean(key());

const endpoint = () => (key().endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate");

/** DeepL accepts up to 50 texts per request. */
const BATCH = 50;

/** Translates texts in order. Throws on API errors (456 = monthly quota used up). */
export async function translate(texts: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const chunk = texts.slice(i, i + BATCH);
    const res = await fetch(endpoint(), {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `DeepL-Auth-Key ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: chunk,
        source_lang: "JA",
        target_lang: "EN-US",
        // Steers terminology; not translated or billed.
        context: "Professional sumo wrestling (ozumo) news from Japan: rikishi, basho, banzuke, yokozuna, ozeki, kimarite.",
      }),
    });
    if (!res.ok) {
      const hint = res.status === 456 ? " (monthly character quota used up)" : res.status === 403 ? " (bad DEEPL_API_KEY)" : "";
      throw new Error(`DeepL ${res.status}${hint}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { translations: { text: string }[] };
    out.push(...json.translations.map((t) => t.text));
  }
  return out;
}
