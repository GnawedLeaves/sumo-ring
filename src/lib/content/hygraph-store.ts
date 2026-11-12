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

const STREAM = "id name url platform order note";
const CLIP = "id title boutId bashoId day eastId westId eastShikona westShikona source videoUrl startSec endSec streamId createdAt";
const NEWS = "id slug title summary body tags sources imageUrl publishedAt";

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
    return d.createStream;
  },
  async updateStream(id, input) {
    const d = await gql<{ updateStream: Stream }>(
      `mutation($id: ID!, $data: StreamUpdateInput!) { updateStream(where: { id: $id }, data: $data) { ${STREAM} } }`,
      { id, data: input },
    );
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
    return d.createClip;
  },
  async deleteClip(id) {
    await gql(`mutation($id: ID!) { deleteClip(where: { id: $id }) { id } }`, { id });
  },
  async createUpload(fileName): Promise<UploadTarget | null> {
    // Hygraph asset upload: create the asset, then POST the file to the returned presigned S3 form.
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

  async listNews() {
    const d = await gql<{ newsArticles: NewsArticle[] }>(`{ newsArticles(orderBy: publishedAt_DESC, first: 500) { ${NEWS} } }`);
    return d.newsArticles.map(clean);
  },
  async getNews(slug) {
    const d = await gql<{ newsArticle: NewsArticle | null }>(
      `query($slug: String!) { newsArticle(where: { slug: $slug }) { ${NEWS} } }`,
      { slug },
    );
    return d.newsArticle ? clean(d.newsArticle) : null;
  },

  async listPortraits(): Promise<Portrait[]> {
    const d = await gql<{ rikishiPortraits: { rikishiId: number; image?: { url: string } | null }[] }>(
      `{ rikishiPortraits(first: 1000) { rikishiId image { url } } }`,
    );
    return d.rikishiPortraits.filter((p) => p.image?.url).map((p) => ({ rikishiId: p.rikishiId, imageUrl: p.image!.url }));
  },
};
