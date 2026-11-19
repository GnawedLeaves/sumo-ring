// Resolves a Twitch channel to its live HLS playlist (the same public flow the web player and streamlink use):
// a playback access token from Twitch's GQL API, then the usher master playlist, then one variant.
const CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko"; // Twitch web player's public client id

const TOKEN_QUERY = `query PlaybackAccessToken($login: String!) {
  streamPlaybackAccessToken(channelName: $login, params: { platform: "web", playerBackend: "mediaplayer", playerType: "embed" }) {
    value
    signature
  }
}`;

export type Variant = { url: string; name: string; height: number; fps: number; bandwidth: number };

/** "https://www.twitch.tv/leodsumo" or "leodsumo" -> "leodsumo" */
export const channelLogin = (urlOrLogin: string) => urlOrLogin.replace(/^https?:\/\/(www\.)?twitch\.tv\//, "").split(/[/?#]/)[0].toLowerCase();

/** Live variants, best first; empty when the channel is offline. */
export async function liveVariants(channel: string): Promise<Variant[]> {
  const login = channelLogin(channel);
  const res = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: { "Client-ID": CLIENT_ID, "Content-Type": "application/json" },
    body: JSON.stringify({ query: TOKEN_QUERY, variables: { login } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!(res.headers.get("content-type") ?? "").includes("json")) {
    // e.g. a corporate web filter (Zscaler) answering 403 with an HTML block page.
    throw new Error(`Twitch unreachable from this network (HTTP ${res.status}, ${res.headers.get("content-type")}). Run from another network.`);
  }
  const json = (await res.json()) as { data?: { streamPlaybackAccessToken?: { value: string; signature: string } | null } };
  const tok = json.data?.streamPlaybackAccessToken;
  if (!tok) throw new Error(`Twitch: no access token for "${login}"`);

  const usher = new URL(`https://usher.ttvnw.net/api/channel/hls/${login}.m3u8`);
  usher.search = new URLSearchParams({
    sig: tok.signature,
    token: tok.value,
    allow_source: "true",
    allow_audio_only: "true",
    fast_bread: "true",
    p: String(Math.floor(Math.random() * 1e7)),
  }).toString();
  const m = await fetch(usher, { signal: AbortSignal.timeout(15_000) });
  if (m.status === 404) return []; // offline
  if (!m.ok) throw new Error(`Twitch usher ${m.status}`);
  return parseMaster(await m.text());
}

function parseMaster(text: string): Variant[] {
  const lines = text.split(/\r?\n/);
  const out: Variant[] = [];
  let media = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("#EXT-X-MEDIA:")) media = /NAME="([^"]+)"/.exec(l)?.[1] ?? "";
    if (l.startsWith("#EXT-X-STREAM-INF:")) {
      const res = /RESOLUTION=\d+x(\d+)/.exec(l);
      const fps = /FRAME-RATE=([\d.]+)/.exec(l);
      const bw = /BANDWIDTH=(\d+)/.exec(l);
      const url = lines[i + 1];
      if (url && !url.startsWith("#")) {
        out.push({ url, name: media, height: res ? Number(res[1]) : 0, fps: fps ? Number(fps[1]) : 0, bandwidth: bw ? Number(bw[1]) : 0 });
      }
    }
  }
  return out.sort((a, b) => b.bandwidth - a.bandwidth);
}

/** The variant to record: the best one at or below `maxHeight` (720p keeps the graphic sharp and bandwidth modest). */
export function pickVariant(variants: Variant[], maxHeight = 720): Variant | null {
  return variants.filter((v) => v.height > 0 && v.height <= maxHeight)[0] ?? variants.find((v) => v.height > 0) ?? null;
}
