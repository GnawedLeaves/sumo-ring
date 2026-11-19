// Records a Twitch channel (live or a re-run) to a local file, for calibrating the detectors. Usage:
//   npm run record -- <channel or twitch URL> [--minutes 60] [--out footage/rec.ts]
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { FFMPEG } from "./frames.ts";
import { channelLogin, liveVariants, pickVariant } from "./twitch.ts";

const args = process.argv.slice(2);
const channel = args[0];
if (!channel) throw new Error("usage: npm run record -- <channel or twitch URL> [--minutes 60] [--out footage/rec.ts]");
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const minutes = Number(opt("minutes") ?? 60);
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const out = opt("out") ?? `footage/${channelLogin(channel)}-${stamp}.ts`;
mkdirSync(path.dirname(out), { recursive: true });

const variant = pickVariant(await liveVariants(channel));
if (!variant) {
  console.error(`${channelLogin(channel)} is offline.`);
  process.exit(1);
}
console.log(`Recording ${channelLogin(channel)} (${variant.name}, ${variant.height}p) for ${minutes} min -> ${out}. Ctrl+C stops early (file stays usable).`);

// Stream copy: no re-encoding, so CPU stays near zero. MPEG-TS survives being cut off mid-write.
const ff = spawn(FFMPEG, ["-v", "warning", "-i", variant.url, "-c", "copy", "-t", String(minutes * 60), "-f", "mpegts", "-y", out], {
  stdio: ["ignore", "inherit", "inherit"],
});
process.on("SIGINT", () => ff.kill("SIGINT"));
ff.on("close", (code) => {
  console.log(code === 0 || code === 255 ? `Saved ${out}` : `ffmpeg exited with ${code}`);
});
