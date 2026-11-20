// Live mode: watches a stream (or a video file played in real time), cuts each bout as soon as it ends, and
// uploads it to the app (Hygraph + the bout's clip, as if "Upload clip" was clicked). Usage:
//   npm run watch -- <twitch URL | channel | video file> [--out <folder>] [--minutes N] [--keep] [--fast]
//                    [--basho YYYYMM --day N --from <rikishi>] [--no-upload] [--match-only]
//
// Uploading: a live stream is matched against today's torikumi automatically. A re-run or a recording needs
// --basho/--day and --from (a rikishi in the first bout it will show). Without a basho day, or with --no-upload,
// clips only go to the local folder. Each clip is still saved locally either way.
//
// How it works: one ffmpeg process saves the stream as ~2 s pieces (stream copy, no re-encoding) and lists them in
// pieces.csv as each one completes. Each new piece is analysed (graphic at 4 fps + loudness per 250 ms) on a
// continuous clock. When a result is detected the watcher waits until it has 5 s after it, finds the tachiai,
// joins the pieces that cover the bout and trims them into an .mp4.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EndDetector, planOne, WINDOW, type ClipPlan, type EndEvent } from "./bouts.ts";
import { CLIP_AUDIO, FFMPEG, loudness, stripFrames } from "./frames.ts";
import { APP_URL, getConfig, saveClip, uploadVideo } from "./app-client.ts";
import { readGraphic } from "./graphic.ts";
import { boutIdOf, BoutMatcher } from "./match.ts";
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
/** Match each clip to its bout and log it, but don't upload (for checking the matching). */
const matchOnly = args.includes("--match-only");

// One live watcher at a time. Two running together (Kyushu 2026 day 13: an old run kept going after a new one was
// started) both upload every bout, and the older one's queue put leftover clips on the wrong bouts.
const lockFile = path.resolve(import.meta.dirname, "..", ".watch.lock");
if (!isFile) {
  const other = existsSync(lockFile) ? Number(readFileSync(lockFile, "utf8")) : 0;
  let alive = false;
  try {
    if (other && other !== process.pid) alive = process.kill(other, 0);
  } catch {
    alive = false; // no such process: a stale lock from a crash
  }
  if (alive) {
    console.error(
      `Another watcher is already running (process ${other}). Stop it first (Ctrl+C in its window, or ` +
        `"Stop-Process -Id ${other}" in PowerShell), then start this one.`,
    );
    process.exit(1);
  }
  writeFileSync(lockFile, String(process.pid));
  process.on("exit", () => {
    try {
      if (Number(readFileSync(lockFile, "utf8")) === process.pid) rmSync(lockFile);
    } catch {
      /* already gone */
    }
  });
}

const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }); // YYYY-MM-DD
const outDir = path.resolve(opt("out") ?? path.join("clips", day));
const sessionId = new Date().toISOString().slice(11, 19).replace(/:/g, "");
const piecesDir = path.join(outDir, `.pieces-${sessionId}`);
mkdirSync(piecesDir, { recursive: true });
const logFile = path.join(outDir, "clips.jsonl");

const hms = (s: number) => new Date(Math.max(0, s) * 1000).toISOString().slice(11, 19);
const now = () => new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Singapore" });
const log = (msg: string) => console.log(`[${now()}] ${msg}`);

// ---------- 0. Upload setup: which day's bouts, and can we reach the app ----------

async function setupMatcher(): Promise<BoutMatcher | null> {
  if (args.includes("--no-upload")) {
    log("Upload off (--no-upload): clips stay in the local folder.");
    return null;
  }
  const bashoId = opt("basho");
  const dayArg = Number(opt("day"));
  const from = opt("from");
  let m: BoutMatcher | null = null;
  if (bashoId || dayArg || from) {
    if (!bashoId || !dayArg || !from) throw new Error("--basho, --day and --from go together (re-runs and recordings)");
    m = await BoutMatcher.from(bashoId, dayArg, from);
  } else if (!isFile) {
    m = await BoutMatcher.live();
    if (!m) log("No basho today: clips stay in the local folder. (For a re-run, pass --basho --day --from.)");
  } else {
    log("Video file without --basho/--day/--from: clips stay in the local folder.");
  }
  if (!m) return null;
  try {
    await getConfig();
  } catch (e) {
    log(`! Can't reach the app at ${APP_URL} (${e instanceof Error ? e.message : e}): clips stay in the local folder.`);
    return null;
  }
  const n = m.next;
  log(`Uploading to ${APP_URL}: ${m.bashoId} day ${m.day}, starting at ${n ? `${n.eastShikona} vs ${n.westShikona} (${n.division} #${n.matchNo})` : "the end of the day"}`);
  return m;
}
const matcher = await setupMatcher();

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
/** Live: wall-clock time each result was seen (by stream time), so the matcher can skip bouts that ended earlier. */
const signalWall = new Map<number, number>();

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
      if (!isFile) signalWall.set(ev.t, Date.now());
    }
  }
  const l = await loudness(p.file, 250, [], { voiceOnly: true });
  loud.push(...l.map((x) => ({ ...x, t: p.start + x.t })));
  loud = loud.filter((x) => x.t >= p.end - HISTORY_SEC);
}

// ---------- 3. Cutter: plan -> join covering pieces -> trimmed .mp4 ----------

async function cut(plan: ClipPlan): Promise<string | null> {
  const covering = pieces.filter((p) => p.end > plan.startT && p.start < plan.stopT);
  if (!covering.length) {
    log(`  ! no pieces left for ${hms(plan.startT)}-${hms(plan.stopT)} (skipped)`);
    return null;
  }
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
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", ...CLIP_AUDIO, "-movflags", "+faststart", "-y", file,
    ], { stdio: ["ignore", "inherit", "inherit"] });
    ff.on("close", () => resolve());
  });
  appendFileSync(logFile, `${JSON.stringify({ file: name, savedAt: new Date().toISOString(), ...plan })}\n`);
  log(
    `  saved ${name}  (${Math.round(plan.stopT - plan.startT)} s; tachiai ${plan.tachiaiT === null ? "not found" : hms(plan.tachiaiT)}${
      plan.note ? `; ${plan.note}` : ""
    })`,
  );
  return file;
}

// ---------- 4. Uploader: match the clip to its bout -> Hygraph -> the bout's clip in the app ----------

let uploaded = 0;
async function upload(file: string, plan: ClipPlan) {
  if (!matcher) return;
  const name = path.basename(file);
  if (plan.note === "Repeat") {
    // A second result right after the previous one, with a fresh tachiai: maybe a rematch, maybe a replay.
    log(`  ${name}: repeat result within ${WINDOW.minResultGapSec} s of the previous one; kept locally, not uploaded`);
    appendFileSync(logFile, `${JSON.stringify({ file: name, upload: "skipped-repeat" })}\n`);
    return;
  }
  try {
    const bout = await matcher.match(plan.winner, plan.note === "Rematch", signalWall.get(plan.endT), () => [...signalWall.values()]);
    if (!bout) {
      log(`  ! ${name}: no bout matches (graphic: ${plan.winner ?? plan.kind} won; next is ${matcher.next ? `${matcher.next.eastShikona} vs ${matcher.next.westShikona}` : "none"}). Kept locally only.`);
      appendFileSync(logFile, `${JSON.stringify({ file: name, upload: "unmatched" })}\n`);
      return;
    }
    const names = { boutId: boutIdOf(bout), eastShikona: bout.eastShikona, westShikona: bout.westShikona };
    if (matchOnly) {
      log(`  would upload ${name} -> ${bout.eastShikona} vs ${bout.westShikona} (${bout.division} #${bout.matchNo}, ${names.boutId})`);
      return;
    }
    const assetId = await uploadVideo(file, names);
    const saved = await saveClip({ ...names, assetId, note: plan.note === "Rematch" ? "Rematch" : undefined });
    uploaded++;
    const lag = matcher.resultLagSec(bout, signalWall.get(plan.endT));
    log(
      `  uploaded ${name} -> ${bout.eastShikona} vs ${bout.westShikona} (${bout.division} #${bout.matchNo}), clip ${saved.clipId}${
        lag === null ? "" : `; Sumo API had the result ${lag} s after the graphic`
      }`,
    );
    appendFileSync(logFile, `${JSON.stringify({ file: name, upload: "saved", boutId: names.boutId, clipId: saved.clipId, apiLagSec: lag })}\n`);
  } catch (e) {
    log(`  ! upload of ${name} failed: ${e instanceof Error ? e.message : e}. Kept locally.`);
    appendFileSync(logFile, `${JSON.stringify({ file: name, upload: "failed", error: String(e) })}\n`);
  }
}

/** Uploads run one at a time, in clip order (the matcher's cursor depends on it), behind the cuts. */
let uploading: Promise<void> = Promise.resolve();

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
      log("  same bout again (after a yellow, or a mono-ii / replay within 150 s) with no new tachiai: no new clip");
      continue;
    }
    protectedFrom.push(plan.startT);
    cutting = cutting
      .then(() => cut(plan))
      .then((file) => {
        if (file) uploading = uploading.then(() => upload(file, plan));
      })
      .finally(() => protectedFrom.splice(protectedFrom.indexOf(plan.startT), 1));
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
await uploading;
if (!keepAll) rmSync(piecesDir, { recursive: true, force: true });
log(
  `Done: ${clipCount} clip(s) in ${outDir}${matcher ? `, ${uploaded} uploaded to the app` : ""}${
    keepAll ? ` (full recording pieces kept in ${piecesDir})` : ""
  }`,
);
