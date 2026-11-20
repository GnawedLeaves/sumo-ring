// Calibration helper: prints the graphic features over time for a video, one row per frame where something
// changes (or every `--every` seconds), plus the loudest audio moments. Usage:
//   node --experimental-strip-types src/probe.ts <video> [--fps 4] [--every 2]
import { readGraphic, type SideFeatures } from "./graphic.ts";
import { loudness, stripFrames } from "./frames.ts";

const args = process.argv.slice(2);
const input = args[0];
if (!input) throw new Error("usage: probe.ts <video> [--fps 4] [--every 2]");
const opt = (name: string, def: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const fps = opt("fps", 4);
const every = opt("every", 2);

const f = (s: SideFeatures) =>
  `scoreRed ${(s.scoreRed * 100).toFixed(1).padStart(5)}%  border ${(s.borderRed * 100).toFixed(1).padStart(5)}%  pink ${s.fillPink.toFixed(0).padStart(4)}  yellow ${(s.yellow * 100).toFixed(1).padStart(5)}%`;

let lastPrinted = -Infinity;
for await (const [t, frame] of stripFrames(input, fps)) {
  const g = readGraphic(frame);
  if (t - lastPrinted >= every) {
    console.log(`${t.toFixed(2).padStart(7)}s  E: ${f(g.east)}  |  W: ${f(g.west)}`);
    lastPrinted = t;
  }
}

const loud = await loudness(input);
const top = [...loud].sort((a, b) => b.voice - a.voice).slice(0, 8).sort((a, b) => a.t - b.t);
const median = [...loud].map((l) => l.voice).sort((a, b) => a - b)[Math.floor(loud.length / 2)] ?? 0;
console.log(`\naudio: median voice-band RMS ${median.toFixed(4)}; loudest windows:`);
for (const l of top) console.log(`  ${l.t.toFixed(1).padStart(6)}s  voice ${l.voice.toFixed(4)}  (x${(l.voice / (median || 1)).toFixed(1)})  all ${l.rms.toFixed(4)}`);
