# Sumo Ring recorder

Watches the sumo Twitch stream and cuts each bout into a clip (5 s before the tachiai → 5 s after the result).
Plan, decisions and dev log: Notion page "Auto-clipper plan" (under "Sumo Ring (app)").

Separate Node package (not part of the Next.js build). Needs Node 22.6+; ffmpeg comes from `ffmpeg-static`.

```bash
cd recorder
npm install
```

## Unattended: start it in the morning, leave it all day

```bash
npm run dev      # repo root, own window: the app the clips upload through
npm run daily    # recorder/, own window
```

`daily` waits until **13:20 SGT** on basho days, runs `watch` on https://www.twitch.tv/leodsumo until **17:20 SGT**
(restarting it a minute later if the stream drops, isn't live yet, or it crashes), then waits for the next day.
Non-basho days are skipped. Options: another stream URL, `--start HH:MM` / `--stop HH:MM` (Singapore time),
`--keep` (keep the full recording, ~2 GB/hour). Don't run `watch` yourself at the same time: only one watcher can run
(`.watch.lock`), so the daily one would keep waiting.

- Keep the PC awake while plugged in (Windows: Settings → System → Power → "When plugged in, put my device to
  sleep after" → Never) and both windows open. A Windows Update restart stops everything.
- If the app isn't reachable when a watcher starts, `daily` says so; clips are still saved in `clips/<date>/` and
  can be uploaded later with `npm run upload` (below).

## Live: watch, clip and upload every bout

```bash
npm run dev                                                    # repo root: the app the worker uploads through
npm run watch -- https://www.twitch.tv/leodsumo --keep --minutes 240   # recorder/
```

Watches the stream, cuts each bout as soon as it ends, and uploads it to the app exactly like "Upload clip" on
the bout page: the video goes to Hygraph as `Kyushu Basho 2026 Day 13: A vs B.mp4` and is saved as the bout's
clip (remarks "Auto clip"). Every clip is also kept in `recorder/clips/<date>/` (`001-<result time>-<winner
side>.mp4`), and `clips.jsonl` records each clip's times and its upload result.

- **Bout matching (live)**: today's basho/day comes from the Sumo API; it starts at the first bout without a
  result. Each clip goes to the next bout whose official winner side matches the side the graphic highlighted,
  waiting up to 20 min for the result to appear. Walkovers (fusen) are skipped; bouts whose result was already
  in more than 45 s before the clip's signal are skipped as missed bouts; a rematch reuses the previous bout.
  Anything that doesn't fit is logged "no bout matches" and kept locally only.
- **Start it just before Juryo** (~1:20pm SGT). The torikumi only has Juryo + Makuuchi, so a lower-division bout
  shown before Juryo could be matched to a Juryo bout.
- Not a basho day, app unreachable, or `--no-upload`: clips are only saved locally.
- Ctrl+C stops (the bout in progress is still cut and uploaded if its result was seen).

| Option | |
|---|---|
| `--out <folder>` | Save somewhere else, e.g. `--out "C:/Users/<you>/Desktop/sumo-clips"` |
| `--minutes N` | Stop after N minutes |
| `--keep` | Also keep the full recording (2 s pieces in `.pieces-<time>/`) for re-running `replay` later |
| (a video file instead of a URL) | Plays the file in real time as if it were live, for testing; add `--fast` to go as fast as possible |
| `--basho YYYYMM --day N --from <rikishi>` | Re-run or recording: match against that past day, starting at that rikishi's bout |
| `--no-upload` | Only save clips locally |
| `--match-only` | Match each clip and log the bout it would go to, without uploading |

## Step 2: upload a clip to its bout (manual, for practice)

```bash
npm run upload -- clips/2026-11-20/001-000056-east.mp4 --basho 202611 --day 12 --rikishi Shonannoumi --winner east
```

Finds the bout in that day's torikumi (Sumo API) by either rikishi's English shikona, checks `--winner` (the
side from `clips.jsonl`) against the official result and stops on a mismatch, then uploads through the app:
`POST /api/recorder/upload` (presigned Hygraph target) → the file goes straight to Hygraph storage → poll
`GET /api/recorder/upload?assetId=` → `POST /api/recorder/clip`. The clip is saved even if the bout already has
one, titled like manual clips ("Kyushu Basho 2026 Day 12: A vs B") with remarks "Auto clip". `--note Rematch`
adds to the remarks; `--dry` only finds and checks the bout.

| Env | |
|---|---|
| `APP_URL` | The app to talk to. Default `http://localhost:3000` (run `npm run dev` in the repo root) |
| `RECORDER_SECRET` | Must match the app's `RECORDER_SECRET`. Read from the repo root `.env.local` when not set |

`GET /api/recorder/config` returns the run settings and the Twitch streams from the app's Streams list, in order.

## Calibration kit (local)

| Command | What it does |
|---|---|
| `npm run record -- https://www.twitch.tv/leodickinsonsumo --minutes 120` | Records a live stream or re-run to `footage/<channel>-<time>.ts` (stream copy, ~0 CPU). Ctrl+C stops early; the file stays usable. |
| `npm run replay -- footage/<file>.ts` | Finds every result + tachiai and cuts one `.mp4` per bout into `out/<file>/`, with `report.txt` / `report.json`. `--no-cut` = report only. |
| `npm run probe -- <video> --every 0.25` | Prints the raw graphic readings and loudest audio moments (for tuning thresholds). |

Twitch must be reachable: corporate web filters (e.g. Zscaler) block it, and `record` then says so.

## How detection works

- **Result**: the ABEMA graphic (top-left). The winner's name box gets a thick red-orange border + pink fill
  (`src/graphic.ts`, `ENDS` in `src/bouts.ts`). Yellow = unsure result / rematch (threshold not yet tuned on
  real footage). The graphic updates ~5 s after the bout actually ends.
- **Tachiai**: audio (`src/tachiai.ts`). The hall goes near-silent in the final crouch (voice-band RMS ~1% of the
  bout level), then jumps at the tachiai. We take the first onset after the last near-silent stretch before the
  result. Mid-bout lulls stay ~8%+ of the bout level, so they don't count.
- **Rematch**: yellow → new tachiai → red = second clip with remarks "Rematch"; red without a new tachiai only
  confirms the first clip (`planClips` in `src/bouts.ts`).
