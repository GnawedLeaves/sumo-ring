# Sumo Hub

Next.js app for following professional sumo — live streams, basho results, rikishi stats, news and a calendar.

- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Sumo API reference + quirks: [docs/API.md](docs/API.md)
- Hygraph content models: [docs/HYGRAPH.md](docs/HYGRAPH.md)
- Design system: [docs/DESIGN.md](docs/DESIGN.md)

## Getting started

```bash
cp .env.example .env.local   # fill in Hygraph / Firebase keys (both optional for local dev)
npm install
npm run dev
```

Open http://localhost:3000.

- **No Hygraph?** Streams/clips/news are stored in `.data/content.json` instead.
- **Admin restrictions are temporarily OFF everywhere (dev and production).** Anyone can add/edit streams and
  upload clips. Set `ADMIN_RESTRICTED=true` (in `.env.local` and on Render) to require the Firebase admin claim.

## Admin account

Admin = a Firebase user with the `admin: true` custom claim. After creating your account on `/login`:

```bash
node --env-file=.env.local scripts/set-admin.mjs you@example.com
```

Then sign out and back in. Every mutation (server actions in `src/lib/actions.ts`) re-checks the claim server-side.

## Structure

```
src/app/                 routes: streams, basho (current / history / [bashoId]), bout/[boutId],
                         rikishi (+ [id]), news (+ [slug]), calendar, login, profile
src/app/api/             rikishi list + search (infinite scroll / autocomplete), session cookie
src/components/          UI — bout/bout-detail.tsx is the shared head-to-head view
src/lib/sumo-api.ts      raw Sumo API client (typed)
src/lib/sumo-data.ts     cached data layer (`use cache`) + roster search index
src/lib/live.ts          active basho / today's bouts / bout on the dohyō
src/lib/content/         Hygraph store + local JSON fallback
src/lib/auth/            Firebase admin/client, session cookie, requireAdmin()
scripts/set-admin.mjs    grant the admin claim
```

## Deploying on Render

Run as a long-lived Node web service (`npm run build` / `npm start`) — the in-memory `use cache` store
then persists between requests, which keeps load on the Sumo API low. The retired-rikishi index takes
~20s to build once a week (first visit to the Inactive tab or first search after a deploy).
