# Sumo API reference

Base URL: `https://sumo-api.com` (confirm before use).

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
