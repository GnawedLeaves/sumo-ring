// Uploads one saved clip to the app and attaches it to its bout (practice / manual step before the live worker
// does this on its own). Usage:
//   npm run upload -- <clip.mp4> --basho 202611 --day 12 --rikishi Shonannoumi [--winner east] [--note Rematch] [--dry]
// --winner (from clips.jsonl) is cross-checked against the Sumo API result; a mismatch stops the upload.
import { existsSync } from "node:fs";
import { APP_URL, saveClip, uploadVideo } from "./app-client.ts";
import { boutIdOf, dayBouts, findByRikishi, winnerSide } from "./match.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const file = args[0];
const bashoId = opt("basho");
const day = Number(opt("day"));
const rikishi = opt("rikishi");
if (!file || !existsSync(file) || !bashoId || !day || !rikishi) {
  console.error("usage: upload.ts <clip.mp4> --basho YYYYMM --day N --rikishi <shikona> [--winner east|west] [--note text] [--dry]");
  process.exit(1);
}

const bouts = await dayBouts(bashoId, day);
const bout = findByRikishi(bouts, rikishi);
if (!bout) throw new Error(`${rikishi} has no bout on day ${day} of ${bashoId}`);
const id = boutIdOf(bout);
const actual = winnerSide(bout);
console.log(`Bout ${id}: ${bout.eastShikona} (east) vs ${bout.westShikona} (west), ${bout.division} #${bout.matchNo}`);
console.log(`  Sumo API result: ${actual ? `${actual} wins by ${bout.kimarite}` : "not decided yet"}`);

const claimed = opt("winner");
if (claimed && actual && claimed !== actual) {
  throw new Error(`The clip's graphic says ${claimed} won but the Sumo API says ${actual}: wrong bout? Not uploading.`);
}
if (args.includes("--dry")) {
  console.log("Dry run: nothing uploaded.");
  process.exit(0);
}

console.log(`Uploading to ${APP_URL}…`);
const names = { boutId: id, eastShikona: bout.eastShikona, westShikona: bout.westShikona };
const assetId = await uploadVideo(file, names, (s) => console.log(`  ${s}`));
const saved = await saveClip({ ...names, assetId, note: opt("note") });
console.log(`Saved clip ${saved.clipId} -> ${APP_URL}/bout/${id}`);
