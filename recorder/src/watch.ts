// Live mode: watches a stream (or a video file played in real time) and saves each bout as a clip in a local
// folder as soon as it ends. No upload — for checking clip quality before the Hygraph step. Usage:
//   npm run watch -- <twitch URL | channel | video file> [--out <folder>] [--minutes N] [--keep] [--fast]
//
// How it works: one ffmpeg process saves the stream as ~2 s pieces (stream copy, no re-encoding) and lists them in
// pieces.csv as each one completes. Each new piece is analysed (graphic at 4 fps + loudness per 250 ms) on a
// continuous clock. When a result is detected the watcher waits until it has 5 s after it, finds the tachiai,
// joins the pieces that cover the bout and trims them into an .mp4.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EndDetector, planOne, WINDOW, type ClipPlan, type EndEvent } from "./bouts.ts";
import { FFMPEG, loudness, stripFrames } from "./frames.ts";
import { readGraphic } from "./graphic.ts";
import type { Loud } from "./tachiai.ts";
import { channelLogin, liveVariants, pickVariant } from "./twitch.ts";

const args = process.argv.slice(2);
const source = args[0];
if (!source) throw new Error("usage: npm run watch -- <twitch URL | channel | video file> [--out <folder>] [--minutes N] [--keep] [--fast]");
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const isFile = existsSync(source);
const minutes = opt("minutes") ? Number(opt("minutes")) : undefined;
/** Keep every piece (the full recording) instead of only the last few minutes. */
const keepAll = args.includes("--keep");
/** File input only: analyse as fast as possible instead of in real time. */
const fast = args.includes("--fast");

const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }); // YYYY-MM-DD
const outDir = path.resolve(opt("out") ?? path.join("clips", day));
const sessionId = new Date().toISOString().slice(11, 19).replace(/:/g, "");
const piecesDir = path.join(outDir, `.pieces-${sessionId}`);
mkdirSync(piecesDir, { recursive: true });
const logFile = path.join(outDir, "clips.jsonl");

const hms = (s: number) => new Date(Math.max(0, s) * 1000).toISOString().slice(11, 19);
const now = () => new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Singapore" });
const log = (msg: string) => console.log(`[${now()}] ${msg}`);

/** Keep this much analysed history (longest bout + margin), and pieces for a little longer than that. */
const HISTORY_SEC = WINDOW.maxBoutSec + 60;
const PIECE_KEEP_SEC = HISTORY_SEC + 60;

// ---------- 1. Recorder: source -> ~2 s pieces + pieces.csv ----------

async function inputUrl(): Promise<string> {
  if (isFile) return source;
  const v = pickVariant(await liveVariants(source));
  if (!v) throw new Error(`${channelLogin(source)} is offline.`);
  log(`Watching ${channelLogin(source)} (${v.name}, ${v.height}p)`);
  return v.url;
}

const listFile = path.join(piecesDir, "pieces.csv");
const recorder = spawn(
  FFMPEG,
  [
    "-v", "warning",
    ...(isFile && !fast ? ["-re"] : []),
    "-i", await inputUrl(),
    ...(minutes ? ["-t", String(minutes * 60)] : []),
    "-map", "0:v:0", "-map", "0:a:0", "-c", "copy",
    "-f", "segment", "-segment_time", "2", "-reset_timestamps", "1",
    "-segment_list", listFile, "-segment_list_type", "csv", "-segment_list_flags", "+live",
    path.join(piecesDir, "p%06d.ts"),
  ],
  { stdio: ["ignore", "inherit", "inherit"] },
);
let recording = true;
recorder.on("close", (code) => {
  recording = false;
  log(`Recorder stopped (ffmpeg exit ${code}).`);
});
process.on("SIGINT", () => {
  log("Stopping… (finishing the current bout if possible)");
  recorder.kill("SIGINT");
});

// ---------- 2. Analyser: each finished piece -> graphic events + loudness on one clock ----------

type Piece = { file: string; start: number; end: number };
const pieces: Piece[] = [];
let loud: Loud[] = [];
const detector = new EndDetector();
let lastEvent: EndEvent | null = null;
const pending: EndEvent[] = [];
let clipCount = 0;

function readList(): Piece[] {
  if (!existsSync(listFile)) return [];
  return readFileSync(listFile, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [file, start, end] = line.split(",");
      return { file: path.join(piecesDir, file), start: Number(start), end: Number(end) };
    });
}

async function analyse(p: Piece) {
  for await (const [t, frame] of stripFrames(p.file, 4)) {
    const ev = detector.push(p.start + t, readGraphic(frame));
    if (ev) {
      log(`Result: ${ev.kind.toUpperCase()} ${ev.side} at ${hms(ev.t)}${ev.followsYellow ? " (after yellow)" : ""}`);
      pending.push(ev);
    }
  }
  const l = await loudness(p.file, 250, [], { voiceOnly: true });
  loud.push(...l.map((x) => ({ ...x, t: p.start + x.t })));
  loud = loud.filter((x) => x.t >= p.end - HISTORY_SEC);
}

// ---------- 3. Cutter: plan -> join covering pieces -> trimmed .mp4 ----------

async function cut(plan: ClipPlan) {
  const covering = pieces.filter((p) => p.end > plan.startT && p.start < plan.stopT);
  if (!covering.length) return log(`  ! no pieces left for ${hms(plan.startT)}-${hms(plan.stopT)} (skipped)`);
  const listPath = path.join(piecesDir, "concat.txt");
  writeFileSync(listPath, covering.map((p) => `file '${p.file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"));
  clipCount++;
  const name = `${String(clipCount).padStart(3, "0")}-${hms(plan.endT).replace(/:/g, "")}-${plan.winner ?? plan.kind}${plan.note ? `-${plan.note}` : ""}.mp4`;
  const file = path.join(outDir, name);
  const offset = Math.max(0, plan.startT - covering[0].start);
  await new Promise<void>((resolve) => {
    const ff = spawn(FFMPEG, [
      "-v", "error", "-f", "concat", "-safe", "0", "-i", listPath,
      "-ss", String(offset), "-t", String(plan.stopT - plan.startT),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-y", file,
    ], { stdio: ["ignore", "inherit", "inherit"] });
    ff.on("close", () => resolve());
  });
  appendFileSync(logFile, `${JSON.stringify({ file: name, savedAt: new Date().toISOString(), ...plan })}\n`);
  log(
    `  saved ${name}  (${Math.round(plan.stopT - plan.startT)} s; tachiai ${plan.tachiaiT === null ? "not found" : hms(plan.tachiaiT)}${
      plan.note ? `; ${plan.note}` : ""
    })`,
  );
}

/** Cuts run one at a time in the background, so encoding a clip never holds up analysing the stream. */
let cutting: Promise<void> = Promise.resolve();
/** Pieces a queued cut still needs (prune must not delete them). */
const protectedFrom: number[] = [];

/** Clips for results whose 5 s tail is now available (or all of them once the recording has ended). */
function flush(final = false) {
  const have = pieces.at(-1)?.end ?? 0;
  while (pending.length && (final || have >= pending[0].t + WINDOW.afterSec)) {
    const ev = pending.shift()!;
    const plan = planOne(ev, lastEvent, loud);
    lastEvent = ev;
    if (!plan) {
      log("  red after yellow without a new tachiai: confirms the previous clip, no new clip");
      continue;
    }
    protectedFrom.push(plan.startT);
    cutting = cutting.then(() => cut(plan)).finally(() => protectedFrom.splice(protectedFrom.indexOf(plan.startT), 1));
  }
}

function prune() {
  if (keepAll) return;
  const cutoff = Math.min((pieces.at(-1)?.end ?? 0) - PIECE_KEEP_SEC, ...protectedFrom);
  while (pieces.length && pieces[0].end < cutoff) rmSync(pieces.shift()!.file, { force: true });
}

// ---------- main loop ----------
log(`Saving clips to ${outDir}`);
let seen = 0;
for (;;) {
  const list = readList();
  for (const p of list.slice(seen)) {
    pieces.push(p);
    await analyse(p);
    flush();
    prune();
  }
  seen = list.length;
  if (!recording && readList().length === seen) break;
  await new Promise((r) => setTimeout(r, 500));
}
flush(true);
await cutting;
if (!keepAll) rmSync(piecesDir, { recursive: true, force: true });
log(`Done: ${clipCount} clip(s) in ${outDir}${keepAll ? ` (full recording pieces kept in ${piecesDir})` : ""}`);
