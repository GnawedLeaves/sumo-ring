// Cached read accessors for app content + the store used by admin mutations.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { hygraphStore } from "./hygraph-store";
import { localStore } from "./local-store";
import type { ContentStore } from "./types";

export * from "./types";

export const store: ContentStore = process.env.HYGRAPH_ENDPOINT ? hygraphStore : localStore;

export const TAGS = { streams: "streams", clips: "clips", news: "news", portraits: "portraits" } as const;

export async function getStreams() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.streams);
  return store.listStreams().catch(() => []);
}

export async function getClips(filter: { bashoId?: string; boutId?: string } = {}) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.clips);
  return store.listClips(filter).catch(() => []);
}

export async function getNewsArticles() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.news);
  return store.listNews().catch(() => []);
}

export async function getNewsArticle(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.news);
  return store.getNews(slug).catch(() => null);
}

/** rikishiId -> portrait URL. The Sumo API has no images, so portraits are uploaded to Hygraph. */
export async function getPortraitMap(): Promise<Record<number, string>> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.portraits);
  const list = await store.listPortraits().catch(() => []);
  return Object.fromEntries(list.map((p) => [p.rikishiId, p.imageUrl]));
}
