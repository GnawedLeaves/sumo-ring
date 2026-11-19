// Decodes a video (file, URL or HLS playlist) into small rgb24 frames of the graphic strip plus an audio
// loudness track, using the ffmpeg binary from ffmpeg-static.
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { STRIP } from "./graphic.ts";

export const FFMPEG = ffmpegPath as unknown as string;

/** Yields [timeSec, frame] for the graphic strip at `fps`, scaled from a 1280x720 frame. */
export async function* stripFrames(input: string, fps = 4, extraArgs: string[] = []): AsyncGenerator<[number, Buffer]> {
  const size = STRIP.w * STRIP.h * 3;
  const ff = spawn(FFMPEG, [
    "-v", "error", ...extraArgs, "-i", input,
    "-an",
    "-vf", `fps=${fps},scale=1280:720,crop=${STRIP.w}:${STRIP.h}:${STRIP.x}:${STRIP.y}`,
    "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
  ]);
  ff.stderr.on("data", (d) => process.stderr.write(d));
  let pending = Buffer.alloc(0);
  let n = 0;
  for await (const chunk of ff.stdout) {
    pending = Buffer.concat([pending, chunk as Buffer]);
    while (pending.length >= size) {
      yield [n++ / fps, pending.subarray(0, size)];
      pending = pending.subarray(size);
    }
  }
}

/** Loudness per `stepMs` window: RMS (0-1) of the mono mix, and of a voice-band (300-3000 Hz) filtered copy. */
export async function loudness(input: string, stepMs = 100, extraArgs: string[] = []): Promise<{ t: number; rms: number; voice: number }[]> {
  const rate = 16000;
  const read = (filter: string) =>
    new Promise<Float64Array>((resolve, reject) => {
      const ff = spawn(FFMPEG, ["-v", "error", ...extraArgs, "-i", input, "-vn", "-ac", "1", "-ar", String(rate), "-af", filter, "-f", "s16le", "pipe:1"]);
      const chunks: Buffer[] = [];
      ff.stdout.on("data", (c: Buffer) => chunks.push(c));
      ff.stderr.on("data", (d) => process.stderr.write(d));
      ff.on("error", reject);
      ff.on("close", () => {
        const pcm = Buffer.concat(chunks);
        const per = Math.round((rate * stepMs) / 1000);
        const out = new Float64Array(Math.floor(pcm.length / 2 / per));
        for (let w = 0; w < out.length; w++) {
          let sq = 0;
          for (let i = 0; i < per; i++) {
            const s = pcm.readInt16LE((w * per + i) * 2) / 32768;
            sq += s * s;
          }
          out[w] = Math.sqrt(sq / per);
        }
        resolve(out);
      });
    });
  const [all, voice] = await Promise.all([read("anull"), read("highpass=f=300,lowpass=f=3000")]);
  return Array.from(all, (rms, i) => ({ t: (i * stepMs) / 1000, rms, voice: voice[i] ?? 0 }));
}
