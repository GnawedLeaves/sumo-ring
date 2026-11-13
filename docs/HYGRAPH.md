# Hygraph setup

Hygraph stores the content the Sumo API doesn't have: streams, clips, news articles and rikishi portraits.
Code: `src/lib/content/hygraph-store.ts`. Without `HYGRAPH_ENDPOINT`, the app falls back to a local JSON file
(`.data/content.json`) — fine for development, not for Render (ephemeral disk).

## Environment

| Var | Value |
|---|---|
| `HYGRAPH_ENDPOINT` | Project settings → Endpoints → **High performance Content API** |
| `HYGRAPH_TOKEN` | Permanent Auth Token (server-only). Default stage **DRAFT**; content permissions: Read/Create/Update/Delete/**Publish** on the models below, plus Asset Read/Create/Publish |

The app reads the **DRAFT** stage (`gcms-stage: DRAFT` header) and publishes every entry it creates or updates (streams, clips, clip videos, news) straight away, so nothing is left sitting as a draft.

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
| `source` | Text | `upload` (clips are always uploaded video files) |
| `videoUrl` | Text | URL of the uploaded Hygraph asset |
| `startSec`, `endSec` | Int | optional, unused for now — reserved for future in-stream clipping |
| `streamId` | Text | optional, unused for now — reserved for future in-stream clipping |

Clip videos are Hygraph Assets (new asset system — projects created after Feb 2024):

1. `createAsset(data: { fileName })` returns `upload.requestPostData` (a presigned S3 form).
2. The browser POSTs the file straight to S3 (policy fields first, `file` last), so large files never pass
   through the Next.js server. Upload progress is shown.
3. The app polls the asset's `upload.status` until `ASSET_UPLOAD_COMPLETE` (other values: `ASSET_CREATE_PENDING`,
   `ASSET_UPDATE_PENDING`, `ASSET_ERROR_UPLOAD`) — the URL doesn't serve until then.
4. The clip is saved with the asset URL, which the server reads from Hygraph rather than trusting the browser.

Max file size depends on your Hygraph plan.

### NewsArticle
| Field | Type | Notes |
|---|---|---|
| `slug` | Text | required, **unique** |
| `title` | Text | required |
| `summary` | Multi-line text | translated lead |
| `body` | Multi-line text | optional (empty for ingested news); paragraphs separated by blank lines |
| `tags` | Text, **allow multiple values** | |
| `sources` | JSON | `[{ "title": "<Japanese headline>", "url": "…", "publisher": "…" }]` — every outlet that covered the story |
| `imageUrl` | Text | optional |
| `publishedOn` | Date & time | original publication time (`publishedAt` is reserved by Hygraph); >90 days old is shown in the archive |

### RikishiPortrait
| Field | Type | Notes |
|---|---|---|
| `rikishiId` | Int | Sumo API id, **unique** |
| `image` | Asset | portrait photo |

The Sumo API has no images; rikishi without a portrait get a generated kanji monogram.
