# Sumo Hub

Next.js app for following professional sumo — live streams, basho results, rikishi stats, news and a calendar.

- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Sumo API reference: [docs/API.md](docs/API.md)
- Design system: [docs/DESIGN.md](docs/DESIGN.md)

## Getting started

```bash
cp .env.example .env.local   # fill in Hygraph / Firebase keys
npm install
npm run dev
```

Open http://localhost:3000.

## Structure

```
src/app/           routes: streams, basho, rikishi, news, calendar, login
src/components/    shared UI (header, footer)
src/lib/sumo-api.ts  typed Sumo API client
docs/              spec, API and design references
```
