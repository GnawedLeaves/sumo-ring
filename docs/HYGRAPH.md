# Hygraph setup

Hygraph stores the content the Sumo API doesn't have: streams, clips, news articles and rikishi portraits.
Code: `src/lib/content/hygraph-store.ts`. Without `HYGRAPH_ENDPOINT`, the app falls back to a local JSON file
(`.data/content.json`) — fine for development, not for Render (ephemeral disk).

## Environment

| Var | Value |
|---|---|
| `HYGRAPH_ENDPOINT` | Project settings → Endpoints → **High performance Content API** |
| `HYGRAPH_TOKEN` | Permanent Auth Token (server-only). Default stage **DRAFT**; content permissions: Read/Create/Update/Delete on the models below, plus Asset Create/Read |

The app reads and writes the **DRAFT** stage (`gcms-stage: DRAFT` header), so nothing needs publishing.

## Models

Field API IDs must match exactly. "Text" = single-line text unless noted.

### Stream
| Field | Type | Notes |
|---|---|---|
| `name` | Text | required |
| `url` | Text | required — YouTube or Twitch URL |
| `platform` | Text | `youtube` or `twitch` |
| `order` | Int | list order |
| `note` | Text | optional |

### Clip
| Field | Type | Notes |
|---|---|---|
| `title` | Text | required |
| `boutId` | Text | `${bashoId}-${day}-${matchNo}-${eastId}-${westId}` (same as the Sumo API torikumi id) |
| `bashoId` | Text | `YYYYMM` |
| `day` | Int | |
| `eastId`, `westId` | Int | Sumo API rikishi ids |
| `eastShikona`, `westShikona` | Text | |
| `source` | Text | `upload`, `youtube`, `twitch` or `url` |
| `videoUrl` | Text | asset URL for uploads, otherwise the VOD/stream URL |
| `startSec`, `endSec` | Int | optional clip window inside `videoUrl` (groundwork for in-stream clipping) |
| `streamId` | Text | optional — the Stream it was clipped from |

Uploaded clip videos are Hygraph Assets; the file goes straight from the browser to Hygraph's presigned S3 form
(`createAsset` → `upload.requestPostData`), so large files never pass through the Next.js server.

### NewsArticle
| Field | Type | Notes |
|---|---|---|
| `slug` | Text | required, **unique** |
| `title` | Text | required |
| `summary` | Multi-line text | |
| `body` | Multi-line text | paragraphs separated by blank lines |
| `tags` | Text, **allow multiple values** | |
| `sources` | JSON | `[{ "title": "…", "url": "…", "publisher": "…" }]` |
| `imageUrl` | Text | optional |
| `publishedAt` | Date & time | original publication time; >90 days old is shown in the archive |

### RikishiPortrait
| Field | Type | Notes |
|---|---|---|
| `rikishiId` | Int | Sumo API id, **unique** |
| `image` | Asset | portrait photo |

The Sumo API has no images; rikishi without a portrait get a generated kanji monogram.
