# Sumo Hub — Product Spec

Next.js (App Router) app for following professional sumo: live streams, basho results, rikishi stats, news and a calendar.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript, Tailwind v4) |
| Video / content storage | Hygraph (clips, stream list, news articles) |
| Auth | Firebase Auth (users + single admin) |
| Server / jobs (if needed) | Render (news scraper / translation cron, proxy) |
| Sumo data | Sumo API (see [API.md](API.md)) |
| Design | "Handsome Frank" style — see [DESIGN.md](DESIGN.md) |

## 1. Streams page

- List of embedded streams (YouTube or Twitch); pick one to watch in an in-app player.
- Admin can add / remove / edit streams (name, URL, platform, order). Stored in Hygraph.
- Stream list to be provided later.
- **1.1 (future, lay groundwork)** Clip a sumo match from the stream. Keep a `Clip` model with `source`, `startSec`, `endSec` so in-stream clipping can be added later.
- **1.2** Admin can upload clips tied to a specific match, e.g. *Kyushu 2026, Day 3, Hoshoryu vs Ura*. Clips are viewable from the Basho History page.
- **1.3** Sidebar next to the player: stats of the two rikishi currently fighting, head-to-head record, who won by which kimarite. Updates as bouts change.

## 2. Access control

- All features readable without logging in.
- Users may sign up / log in (Firebase); only extra feature for now is a profile page.
- One **admin** account (owner) — only admin can upload clips or edit content. Everyone else is read-only.
- Enforce admin via Firebase custom claim (`admin: true`) checked server-side on every mutation route.
- Rikishi search history stored in `localStorage` per browser and shown as suggestions in the Rikishi search (feature 4).

## 3. Basho page (tabs)

### 3.1 Current Basho
- If a basho is active: hero shows the bout in progress — one rikishi each side with portrait and current basho record. Click → head-to-head details.
- Sidebar with the day's torikumi (like sumostats.com/live). Clicking a bout shows: who is fighting, their head-to-head history, winning techniques, basho record, etc.
- Completed bouts are faded out in the sidebar with the result shown.
- *(The original wheel / date-picker idea was dropped in favour of the sidebar.)*

### 3.2 History
- List of past basho: yusho winner + 3 runners-up (portrait, English name, Japanese name).
- Basho detail page:
  - Hero: winner + 3 runners-up; smaller section listing sansho / awards.
  - Below: day tabs sidebar (Day 1 … Day 15, playoffs). Selecting a day lists that day's bouts beside it.
  - Bout click → same bout details page as 3.1. Show a video player if a clip exists.
  - Rikishi names link to the Rikishi detail page (4.3).

### 3.3 No active basho
- Show the most recent basho winners instead.

## 4. Rikishi page (tabs)

- **Active** (default) and **Inactive** tabs.
- Grouped/sorted by rank: Yokozuna, Ozeki, Sekiwake, Komusubi, Maegashira, Juryo (then lower divisions). Inactive tab sorted by highest rank achieved.
- **4.1 Search** at top: by shikona (English or Japanese), heya, or rank. Debounced autocomplete — query fires shortly after the last keystroke, results shown live. Past searches (localStorage) shown as suggestions.
- **4.2 Pagination**: infinite scroll — load next page only when the user reaches the bottom of the list.
- **4.3 Rikishi detail**: large portrait and name, then all stats the API provides (career wins/losses, yusho, top kimarite, rank history, measurements…). Listed neatly first; charts decided later.

## 5. News page

- Scrape sumo news from Japanese news sites, translate into English article form with tags.
- News home sorted newest first; article page with links to original sources.
- Articles older than 3 months are archived — reachable via an "Archive" button/section.
- Likely runs as a scheduled job on Render writing articles into Hygraph.

## 6. Calendar

- Calendar of upcoming basho with countdowns.
- Six honbasho per year: Hatsu (Jan, Tokyo), Haru (Mar, Osaka), Natsu (May, Tokyo), Nagoya (Jul), Aki (Sep, Tokyo), Kyushu (Nov, Fukuoka).

## Open items

- Stream list (from owner).
- History page extra details (from owner).
- Rikishi card "most important details" — to be confirmed.
- Source for rikishi portraits (API has none — likely NSK site images or Hygraph uploads).
- Japanese news sources and translation provider.
