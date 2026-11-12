# Sumo API reference

Base URL: `https://www.sumo-api.com`.

## Quirks found while building (Nov 2026)

- `shikonaEn` is an **exact** match — no partial search. Autocomplete uses a cached local index (`getActiveIndex` / `getRetiredIndex` in `src/lib/sumo-data.ts`).
- `GET /api/rikishis` with `ranks|measurements|shikonas=true` caps pages at **100 and ignores `skip`**. Bulk-list without those flags.
- `GET /api/ranks?bashoId=` returns max 100 rows per call, sorted by rank (`skip` works). Used to derive "highest rank reached" for retired rikishi.
- `POST /api/rikishis/matches` (bulk head-to-head) returned empty results for known pairs — use the per-pair endpoint.
- Undecided bouts in torikumi have `winnerId: 0` and empty `kimarite`. Torikumi for a day appears the day before.
- Empty lists come back as `records: null`.
- No images anywhere — portraits come from Hygraph (`RikishiPortrait`).
- `/api/basho/:id` has yūshō + sanshō only; "runners-up" are derived from the Makuuchi banzuke (best records after the winner).

## Rikishi

**GET /api/rikishis** — subset of rikishi, hard limit 1000; use `limit` & `skip`.
- `shikonaEn` — search by English shikona
- `heya` — full heya name in English, e.g. `Isegahama`
- `sumodbId` — e.g. `11927` = Terunofuji
- `nskId` — official NSK ID, e.g. `3321` = Terunofuji
- `intai` — if missing, only active rikishi; if `true`, retired rikishi included
- `measurements` / `ranks` / `shikonas` — `true` to include history
- `sortOrder` — `asc | desc` for embedded history (default `desc`); legacy `sortBy` alias
- `limit`, `skip`

**GET /api/rikishi/:rikishiId** — single rikishi. Same `measurements`, `ranks`, `shikonas`, `sortOrder` params.

**GET /api/rikishi/:rikishiId/stats** — overall performance stats.

**GET /api/rikishi/:rikishiId/matches** — all matches, most recent first. `bashoId` (YYYYMM) filter.

**GET /api/rikishi/:rikishiId/matches/:opponentId** — head-to-head matches, most recent first. `bashoId` filter.

**POST /api/rikishis/matches** — bulk head-to-head. Body: array of `{ key, ids: [a, b], limit, skip, sortOrder? }`.

## Basho

**GET /api/basho/:bashoId** — basho (YYYYMM) with yusho and sansho.

**GET /api/basho/:bashoId/banzuke/:division** — division banzuke. Divisions: `Makuuchi`, `Juryo`, `Makushita`, `Sandanme`, `Jonidan`, `Jonokuchi`.

**GET /api/basho/:bashoId/torikumi/:division/:day** — day's bouts; day 1–15 (or higher for playoffs).

## Kimarite

**GET /api/kimarite** — usage stats. `sortField` (`count | kimarite | lastUsage`), `sortOrder` (default `asc`), `limit`, `skip`. `lastUsage` is approximate.

**GET /api/kimarite/:kimarite** — matches using that kimarite. `sortOrder`, `limit` (max 1000), `skip`.

## History endpoints

**GET /api/measurements**, **GET /api/ranks**, **GET /api/shikonas** — changes by `rikishiId` OR `bashoId`. `sortOrder` (default `desc`), `limit`, `skip`.
