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

## News ingest

`GET /api/cron/news` builds the news page without any AI. Each run it:

1. **Reads feeds** (`src/lib/news/feeds.ts`): Nikkan Sports' sumo Atom feed, a Google News search for 大相撲
   (last 7 days, ~100 headlines across Jiji, NHK, Sponichi, Hochi, Yomiuri…), and Yahoo! News feeds for
   Tokyo Sports and Sponichi (filtered to sumo by keyword). Feeds only — article pages are never crawled.
2. **Groups the same story** across outlets (`cluster.ts`): similar headlines, the same two rikishi on the same
   day, or the same rikishi + event (金星, 優勝, 休場, 引退…) on the same day. One article, several source links.
   Outlets that report a stored story later are added to its sources.
3. **Tags by rules** (`tags.ts`): topic keywords (休場 → Injury, 優勝 → Yusho race…) plus the rikishi named,
   matched against the Sumo API's kanji shikona (old/new kanji forms like 琴櫻/琴桜 are folded together).
4. **Translates with DeepL** (`translate.ts`): the headline and a ~150-character lead only. Shikona are swapped
   for their official romanisation first, so 豊昇龍 becomes "Hoshoryu" rather than a literal reading.
   Readers follow "Read the full story" to the outlet — we don't republish whole translated articles.

- Needs `DEEPL_API_KEY` ([free API key](https://www.deepl.com/pro-api): 500,000 characters/month; free keys end
  in `:fx`), `CRON_SECRET`, and the `NewsArticle` model in Hygraph (docs/HYGRAPH.md).
- Usage: ~200 Japanese characters per new story, max 30 stories per run. A busy basho day is ~40–60 new
  stories, so roughly 250–350k characters a month — inside the free tier.
- Requests must send `Authorization: Bearer $CRON_SECRET`. Add `?dry=1` to list the stories it would create,
  with tags and every grouped headline, without calling DeepL or writing anything.
- **Schedule on Render:** create a Cron Job (e.g. `0 * * * *`, hourly) with the command
  `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.onrender.com/api/cron/news`
  and set `CRON_SECRET` on both the web service and the cron job.
- Articles older than 90 days move to the News archive automatically.
