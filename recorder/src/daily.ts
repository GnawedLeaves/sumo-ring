// Daily runner: start once (e.g. before leaving for work) and leave it running. Every basho day it starts the
// watcher just before Juryo, keeps it running through Makuuchi (restarting it if the stream drops or it crashes),
// stops it after the last bout, then waits for the next day. Non-basho days are skipped. Usage:
//   npm run daily -- [twitch URL] [--start 13:20] [--stop 17:20] [--keep]
// Times are Singapore time. The app the watcher uploads through (npm run dev, or APP_URL) must be reachable;
// if it isn't, clips are still saved locally and can be uploaded later with `npm run upload`.
import { spawn } from "node:child_process";
import path from "node:path";
import { APP_URL, getConfig } from "./app-client.ts";
import { todaysBashoDay } from "./match.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const url = args.find((a) => a.startsWith("http")) ?? "https://www.twitch.tv/leodsumo";
const keep = args.includes("--keep");

/** "HH:MM" Singapore time -> minutes after midnight. */
const parseHm = (s: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`Bad time "${s}" (use HH:MM, Singapore time)`);
  return Number(m[1]) * 60 + Number(m[2]);
};
const START = parseHm(opt("start") ?? "13:20");
const STOP = parseHm(opt("stop") ?? "17:20");
if (STOP <= START) throw new Error("--stop must be after --start");

const SGT = 8 * 3600_000; // Singapore has no daylight saving
/** Wall-clock ms of HH:MM (minutes) Singapore time on the SGT date of `ref`. */
const sgtAt = (minutes: number, ref = Date.now()) => {
  const d = new Date(ref + SGT);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - SGT + minutes * 60_000;
};
const sgtTime = (ms = Date.now()) => new Date(ms + SGT).toISOString().slice(0, 16).replace("T", " ");
const log = (msg: string) => console.log(`[${sgtTime()} SGT] ${msg}`);

/** Sleeps until `until` in steps of at most a minute, so a PC sleeping or the clock changing can't oversleep it. */
async function sleepUntil(until: number) {
  while (Date.now() < until) await new Promise((r) => setTimeout(r, Math.min(60_000, until - Date.now())));
}

/** Runs the watcher until it exits. Resolves with its exit code. */
function runWatcher(minutes: number): Promise<number | null> {
  const watchArgs = [url, "--minutes", String(minutes), ...(keep ? ["--keep"] : [])];
  log(`Starting the watcher for ${minutes} min: ${watchArgs.join(" ")}`);
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings=ExperimentalWarning", "src/watch.ts", ...watchArgs],
    { cwd: path.resolve(import.meta.dirname, ".."), stdio: "inherit" },
  );
  return new Promise((resolve) => child.on("close", (code) => resolve(code)));
}

log(`Daily runner: ${url}, every basho day ${opt("start") ?? "13:20"}-${opt("stop") ?? "17:20"} SGT${keep ? ", keeping full recordings" : ""}.`);
for (;;) {
  const start = sgtAt(START);
  const stop = sgtAt(STOP);
  if (Date.now() >= stop) {
    log("Done for today. Waiting for tomorrow.");
    await sleepUntil(sgtAt(START, stop + 24 * 3600_000) - 5 * 60_000); // check again 5 min before tomorrow's start
    continue;
  }

  let today: Awaited<ReturnType<typeof todaysBashoDay>> = null;
  try {
    today = await todaysBashoDay();
  } catch (e) {
    log(`! Couldn't reach the Sumo API (${e instanceof Error ? e.message : e}); trying again in 5 min.`);
    await sleepUntil(Date.now() + 5 * 60_000);
    continue;
  }
  if (!today) {
    log("No basho today. Waiting for tomorrow.");
    await sleepUntil(sgtAt(START, stop + 24 * 3600_000) - 5 * 60_000);
    continue;
  }

  if (Date.now() < start) {
    log(`${today.bashoId} day ${today.day}: starting at ${sgtTime(start).slice(11)} SGT.`);
    await sleepUntil(start);
  }
  try {
    await getConfig();
  } catch (e) {
    log(`! The app at ${APP_URL} isn't reachable (${e instanceof Error ? e.message : e}). Clips will only be saved locally; start it with "npm run dev" in the repo root.`);
  }

  // Keep a watcher running until the stop time. It exits on its own when the stream is offline or ends, or if it
  // crashes; then wait a minute and start it again.
  while (Date.now() < stop - 60_000) {
    const minutes = Math.max(1, Math.round((stop - Date.now()) / 60_000));
    const code = await runWatcher(minutes);
    if (Date.now() < stop - 60_000) {
      log(`Watcher stopped (exit ${code}); starting it again in 1 min.`);
      await sleepUntil(Date.now() + 60_000);
    }
  }
}
