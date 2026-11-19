# Sumo Ring recorder

Watches the sumo Twitch stream and cuts each bout into a clip (5 s before the tachiai → 5 s after the result).
Plan, decisions and dev log: Notion page "Auto-clipper plan" (under "Sumo Ring (app)").

Separate Node package (not part of the Next.js build). Needs Node 22.6+; ffmpeg comes from `ffmpeg-static`.

```bash
cd recorder
npm install
```

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
