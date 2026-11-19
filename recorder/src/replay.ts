// Runs the detectors over a recording and cuts every bout it finds, for checking/tuning. Usage:
//   npm run replay -- <recording> [--out out/<name>] [--no-cut]
// Writes report.json + report.txt and one .mp4 per bout into the out folder.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EndDetector, planClips, type EndEvent } from "./bouts.ts";
import { FFMPEG, loudness, stripFrames } from "./frames.ts";
import { readGraphic } from "./graphic.ts";

const args = process.argv.slice(2);
const input = args[0];
if (!input) throw new Error("usage: npm run replay -- <recording> [--out out/<name>] [--no-cut]");
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : path.join("out", path.parse(input).name);
const cut = !args.includes("--no-cut");
mkdirSync(outDir, { recursive: true });

const hms = (s: number) => new Date(s * 1000).toISOString().slice(11, 19);

console.log("Reading the graphic (4 fps)…");
const det = new EndDetector();
const events: EndEvent[] = [];
for await (const [t, frame] of stripFrames(input, 4)) {
  const ev = det.push(t, readGraphic(frame));
  if (ev) {
    events.push(ev);
    console.log(`  ${hms(ev.t)}  ${ev.kind.toUpperCase()} ${ev.side}${ev.followsYellow ? " (after yellow)" : ""}`);
  }
}

console.log("Reading the audio…");
const loud = await loudness(input, 250);
const plans = planClips(events, loud);

const lines = plans.map(
  (p, i) =>
    `${String(i + 1).padStart(3)}  ${hms(p.startT)} → ${hms(p.stopT)}  (${Math.round(p.stopT - p.startT)} s)  tachiai ${
      p.tachiaiT === null ? "—" : hms(p.tachiaiT)
    }  result ${hms(p.endT)} ${p.kind}${p.winner ? ` winner ${p.winner}` : ""}${p.note ? `  [${p.note}]` : ""}`,
);
const report = `${input}\n${plans.length} clips from ${events.length} result highlights\n\n${lines.join("\n")}\n`;
writeFileSync(path.join(outDir, "report.txt"), report);
writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ input, events, plans }, null, 2));
console.log(`\n${report}`);

if (cut) {
  for (const [i, p] of plans.entries()) {
    const file = path.join(outDir, `${String(i + 1).padStart(3, "0")}-${hms(p.endT).replace(/:/g, "")}${p.note ? `-${p.note}` : ""}.mp4`);
    // Re-encode (fast preset) so the clip starts exactly at the planned frame, not the previous keyframe.
    await new Promise<void>((resolve) => {
      const ff = spawn(FFMPEG, [
        "-v", "error", "-ss", String(p.startT), "-to", String(p.stopT), "-i", input,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-y", file,
      ], { stdio: ["ignore", "inherit", "inherit"] });
      ff.on("close", () => resolve());
    });
    console.log(`  cut ${file}`);
  }
}
console.log(`\nDone: ${outDir}`);
