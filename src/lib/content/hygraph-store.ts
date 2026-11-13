// Hygraph-backed content store. Schema: docs/HYGRAPH.md
// Reads and writes use the DRAFT stage so edits are visible immediately without a publish step.
import "server-only";
import type { Clip, ContentStore, NewsArticle, Portrait, Stream, UploadTarget } from "./types";

const ENDPOINT = process.env.HYGRAPH_ENDPOINT ?? "";
const TOKEN = process.env.HYGRAPH_TOKEN ?? "";

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "gcms-stage": "DRAFT",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || json.errors?.length) {
    throw new Error(`Hygraph: ${json.errors?.map((e) => e.message).join("; ") ?? res.status}`);
  }
  return json.data as T;
}

/**
 * Publish an entry right after a create/update so it doesn't sit as a draft. (We read DRAFT, which always holds
 * the latest version, but PUBLISHED is what Hygraph treats as live.) Needs the token's Publish permission.
 */
async function publish(model: "Stream" | "Clip" | "NewsArticle" | "Asset" | "RikishiPortrait", id: string) {
  await gql(`mutation($id: ID!) { publish${model}(where: { id: $id }, to: PUBLISHED) { id } }`, { id });
}

const STREAM = "id name url platform order note";
const CLIP = "id title boutId bashoId day eastId westId eastShikona westShikona source videoUrl startSec endSec streamId createdAt";
// Hygraph reserves `publishedAt` (system field), so the model stores it as `publishedOn`; aliased back here.
const NEWS = "id slug title summary body tags sources imageUrl publishedAt: publishedOn";

const clean = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) as T;

export const hygraphStore: ContentStore = {
  kind: "hygraph",

  async listStreams() {
    const d = await gql<{ streams: Stream[] }>(`{ streams(orderBy: order_ASC, first: 200) { ${STREAM} } }`);
    return d.streams.map(clean);
  },
  async createStream(input) {
    const d = await gql<{ createStream: Stream }>(
      `mutation($data: StreamCreateInput!) { createStream(data: $data) { ${STREAM} } }`,
      { data: input },
    );
    await publish("Stream", d.createStream.id);
    return d.createStream;
  },
  async updateStream(id, input) {
    const d = await gql<{ updateStream: Stream }>(
      `mutation($id: ID!, $data: StreamUpdateInput!) { updateStream(where: { id: $id }, data: $data) { ${STREAM} } }`,
      { id, data: input },
    );
    await publish("Stream", id);
    return d.updateStream;
  },
  async deleteStream(id) {
    await gql(`mutation($id: ID!) { deleteStream(where: { id: $id }) { id } }`, { id });
  },

  async listClips(filter = {}) {
    const where = clean({ bashoId: filter.bashoId, boutId: filter.boutId });
    const d = await gql<{ clips: Clip[] }>(
      `query($where: ClipWhereInput) { clips(where: $where, orderBy: createdAt_DESC, first: 500) { ${CLIP} } }`,
      { where },
    );
    return d.clips.map(clean);
  },
  async createClip(input) {
    const d = await gql<{ createClip: Clip }>(
      `mutation($data: ClipCreateInput!) { createClip(data: $data) { ${CLIP} } }`,
      { data: clean(input) },
    );
    await publish("Clip", d.createClip.id);
    return d.createClip;
  },
  async deleteClip(id) {
    await gql(`mutation($id: ID!) { deleteClip(where: { id: $id }) { id } }`, { id });
  },
  async createUpload(fileName): Promise<UploadTarget | null> {
    // Hygraph asset upload (new asset system): create the asset, then the browser POSTs the file to the
    // returned presigned S3 form (all fields first, `file` last), then we poll getUploadStatus.
    const d = await gql<{
      createAsset: {
        id: string;
        url: string;
        upload: {
          requestPostData: {
            url: string;
            date: string;
            key: string;
            signature: string;
            algorithm: string;
            policy: string;
            credential: string;
            securityToken: string;
          };
        };
      };
    }>(
      `mutation($fileName: String!) {
        createAsset(data: { fileName: $fileName }) {
          id url
          upload { requestPostData { url date key signature algorithm policy credential securityToken } }
        }
      }`,
      { fileName },
    );
    const p = d.createAsset.upload.requestPostData;
    return {
      assetId: d.createAsset.id,
      assetUrl: d.createAsset.url,
      postUrl: p.url,
      fields: {
        "X-Amz-Date": p.date,
        key: p.key,
        "X-Amz-Signature": p.signature,
        "X-Amz-Algorithm": p.algorithm,
        policy: p.policy,
        "X-Amz-Credential": p.credential,
        "X-Amz-Security-Token": p.securityToken,
      },
    };
  },

  async getUploadStatus(assetId) {
    // Enum verified against a live project (Nov 2026): ASSET_CREATE_PENDING | ASSET_UPLOAD_COMPLETE |
    // ASSET_UPDATE_PENDING | ASSET_ERROR_UPLOAD.
    const d = await gql<{ asset: { url: string; upload: { status: string; error?: { message: string } | null } | null } | null }>(
      `query($id: ID!) { asset(where: { id: $id }) { url upload { status error { message } } } }`,
      { id: assetId },
    );
    if (!d.asset) return null;
    const s = d.asset.upload?.status;
    // Publish the uploaded video once it's complete so it's live alongside the published clip.
    if (s === "ASSET_UPLOAD_COMPLETE") await publish("Asset", assetId);
    const status = s === "ASSET_UPLOAD_COMPLETE" ? "complete" : s === "ASSET_ERROR_UPLOAD" ? "error" : "pending";
    return { status, url: d.asset.url, error: d.asset.upload?.error?.message };
  },

  async listNews() {
    const d = await gql<{ newsArticles: NewsArticle[] }>(`{ newsArticles(orderBy: publishedOn_DESC, first: 500) { ${NEWS} } }`);
    return d.newsArticles.map(clean);
  },
  async getNews(slug) {
    const d = await gql<{ newsArticle: NewsArticle | null }>(
      `query($slug: String!) { newsArticle(where: { slug: $slug }) { ${NEWS} } }`,
      { slug },
    );
    return d.newsArticle ? clean(d.newsArticle) : null;
  },

  async createNews(input) {
    const d = await gql<{ createNewsArticle: NewsArticle }>(
      `mutation($data: NewsArticleCreateInput!) { createNewsArticle(data: $data) { ${NEWS} } }`,
      { data: (({ publishedAt, ...rest }) => clean({ ...rest, publishedOn: publishedAt }))(input) },
    );
    await publish("NewsArticle", d.createNewsArticle.id);
    return d.createNewsArticle;
  },
  async updateNewsSources(id, sources) {
    await gql(`mutation($id: ID!, $sources: Json!) { updateNewsArticle(where: { id: $id }, data: { sources: $sources }) { id } }`, {
      id,
      sources,
    });
    await publish("NewsArticle", id);
  },

  async listPortraits(): Promise<Portrait[]> {
    const d = await gql<{ rikishiPortraits: { rikishiId: number; image?: { url: string } | null }[] }>(
      `{ rikishiPortraits(first: 1000) { rikishiId image { url } } }`,
    );
    return d.rikishiPortraits.filter((p) => p.image?.url).map((p) => ({ rikishiId: p.rikishiId, imageUrl: p.image!.url }));
  },
  async setPortrait(rikishiId, assetId) {
    // rikishiId isn't a unique field in the schema, so look the entry up rather than upserting on it.
    const found = await gql<{ rikishiPortraits: { id: string }[] }>(
      `query($rid: Int!) { rikishiPortraits(where: { rikishiId: $rid }, first: 1) { id } }`,
      { rid: rikishiId },
    );
    const existing = found.rikishiPortraits[0]?.id;
    let id: string;
    if (existing) {
      await gql(`mutation($id: ID!, $aid: ID!) { updateRikishiPortrait(where: { id: $id }, data: { image: { connect: { id: $aid } } }) { id } }`, {
        id: existing,
        aid: assetId,
      });
      id = existing;
    } else {
      const d = await gql<{ createRikishiPortrait: { id: string } }>(
        `mutation($rid: Int!, $aid: ID!) { createRikishiPortrait(data: { rikishiId: $rid, image: { connect: { id: $aid } } }) { id } }`,
        { rid: rikishiId, aid: assetId },
      );
      id = d.createRikishiPortrait.id;
    }
    await publish("RikishiPortrait", id);
  },
};
