# Sumo Ring

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
- **Admin features are locked** to the emails in `ADMIN_EMAILS`. For local testing only, `ADMIN_OPEN=true`
  opens them to everyone — never set it in production.

## Admin account

Admin = a signed-in user whose **verified** email is listed in `ADMIN_EMAILS` (comma-separated, server-only).
Google sign-in counts as verified; email/password accounts must click the verification email first.

- Needs the Firebase Admin service account (`FIREBASE_ADMIN_*`) so the server can verify sessions.
- Every mutation (server actions in `src/lib/actions.ts`) re-checks the list server-side on each request.
- On sign-in, `/api/session` also sets the Firebase `admin` custom claim to match the list; `firestore.rules`
  uses that claim (e.g. deleting any comment). Remove an email from the list and the claim is cleared at that
  user's next sign-in; their server-side admin access ends immediately.

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
   Tokyo Sports and Sponichi (filtered to sumo by keyword). Ingest reads feeds only; article pages are fetched
   one at a time, on demand, for the full-text view (step 5).
2. **Groups the same story** across outlets (`cluster.ts`): similar headlines, the same two rikishi on the same
   day, or the same rikishi + event (金星, 優勝, 休場, 引退…) on the same day. One article, several source links.
   Outlets that report a stored story later are added to its sources.
3. **Tags by rules** (`tags.ts`): topic keywords (休場 → Injury, 優勝 → Yusho race…) plus the rikishi named,
   matched against the Sumo API's kanji shikona (old/new kanji forms like 琴櫻/琴桜 are folded together).
4. **Translates with DeepL** (`translate.ts`): the headline and a ~150-character lead only. Shikona are swapped
   for their official romanisation first, so 豊昇龍 becomes "Hoshoryu" rather than a literal reading.
   These are what's stored and shown publicly — we don't republish whole translated articles.
5. **Full article for signed-in users** (`fulltext.ts`): the story page fetches one source article page
   (Nikkan Sports or Yahoo! News — Google News links can't be resolved), translates every paragraph with DeepL and
   shows it to signed-in viewers only. Nothing is stored; the translation is cached on the server for a day per URL.
   Stories with a readable outlet are picked first.

- Needs `DEEPL_API_KEY` ([free API key](https://www.deepl.com/pro-api): 500,000 characters/month; free keys end
  in `:fx`), `CRON_SECRET`, and the `NewsArticle` model in Hygraph (docs/HYGRAPH.md).
- Usage: max 5 stories per run at ~200 Japanese characters each (~30k characters a month), plus ~1–3k characters
  each time a signed-in user opens a full article that isn't cached yet (capped at 6,000) — inside the free tier for
  personal use.
- Requests must send `Authorization: Bearer $CRON_SECRET`. Add `?dry=1` to list the stories it would create,
  with tags and every grouped headline, without calling DeepL or writing anything.
- **Schedule on Vercel:** `vercel.json` registers a Vercel Schedule `news-ingest` that runs daily at 12:00 UTC
  (21:00 JST, after the day's Makuuchi bouts) as a `GET` to this route. Set `CRON_SECRET` in the Vercel project's
  env vars — Vercel sends it as the Bearer token automatically. Hobby runs within a 15-minute jitter window and at most
  every 15 minutes; for hourly, change `schedule` to `0 * * * *`. Trigger a run now with `vercel schedules invoke news-ingest`
  or **Run Schedule** under the project's **Schedules** tab.
- **Schedule on Render:** create a Cron Job (e.g. `0 * * * *`, hourly) with the command
  `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.onrender.com/api/cron/news`
  and set `CRON_SECRET` on both the web service and the cron job.
- Articles older than 90 days move to the News archive automatically.

## Telegram bot

Sends a clip's video to any Telegram chat as one message with the bout title as its caption
(the phone share sheet sends the video and the text separately on iOS). Code: `src/lib/telegram.ts`,
webhook `src/app/api/telegram/route.ts`.

- **In any chat:** type `@<bot>` for the newest clips, or `@<bot> hoshoryu` to search by shikona; tap one to send it.
- **Standings and app link:** `@<bot>` also offers "📊 Current standings" (Makuuchi, fewest losses first, then by
  rank; between basho, the last winner and runners-up) and "📱 Link to Sumo Ring". `@<bot> standings` / `@<bot> app`
  narrow to them. In a chat with the bot: `/standings`, `/app`.
- Telegram fetches the video from Hygraph itself, which only works for MP4 files up to 20 MB. Larger (or non-MP4)
  clips still appear in the inline list, marked 🔗, and send a link to the bout instead; "Share video" (phone share
  sheet) still sends the file itself.

**Auto-post to your channel:** when the auto-clipper saves a clip (`recorder/`, not clips uploaded by hand), the
bot posts it to `TELEGRAM_CHANNEL_ID` if either wrestler is on the whitelist. Manage the whitelist under
Others → **Telegram auto-post** (`/telegram`, admins only). Same caption as inline mode; each clip is posted once
(Firestore `telegramPosts/{clipId}`). Clips over 20 MB are uploaded by the server (Telegram's bot limit is 50 MB);
bigger ones are posted as a link to the bout. Setup: add the bot to the channel as an **admin** that can post
messages, then set `TELEGRAM_CHANNEL_ID` (`@channelname`, or `-100…` for a private channel) wherever the app runs
(`.env.local` while the recorder uploads through the local app, Vercel env vars for production).

Setup:

1. In Telegram, message **@BotFather**: `/newbot` (name + a username ending in `bot`) → copy the token.
   Then `/setinline` → pick the bot → placeholder text (e.g. `Search clips…`) to enable inline mode.
2. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (no @) and `TELEGRAM_WEBHOOK_SECRET` (random string) in the
   host's env vars, and deploy.
3. Register the webhook once by opening
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-domain>/api/telegram&secret_token=<SECRET>`
   (expect `"Webhook was set"`). `getWebhookInfo` in place of `setWebhook` shows the last delivery error, if any.
