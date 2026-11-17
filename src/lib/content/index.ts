// Cached read accessors for app content + the store used by admin mutations.
//
// Cached functions never throw (an error inside `use cache` during the build's prerender fails the build).
// A failed read (e.g. Hygraph down, model not created yet) is cached for only ~2 minutes and shown as empty,
// so it recovers on its own instead of sticking for hours.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { hygraphStore } from "./hygraph-store";
import { localStore } from "./local-store";
import type { Clip, ContentStore, NewsArticle, Stream } from "./types";

export * from "./types";

export const store: ContentStore = process.env.HYGRAPH_ENDPOINT ? hygraphStore : localStore;

export const TAGS = { streams: "streams", clips: "clips", news: "news", portraits: "portraits", stars: "stars" } as const;

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const FAILED_LIFE = { stale: 30, revalidate: 60, expire: 120 };

async function attempt<T>(p: Promise<T>, okLife: "hours" | "days"): Promise<Result<T>> {
  try {
    const data = await p;
    if (okLife === "days") cacheLife("days");
    else cacheLife("hours");
    return { ok: true, data };
  } catch (e) {
    cacheLife(FAILED_LIFE);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function unwrap<A extends unknown[], T, F>(fn: (...args: A) => Promise<Result<T>>, fallback: F) {
  return async (...args: A): Promise<T | F> => {
    const r = await fn(...args);
    if (r.ok) return r.data;
    console.error(`[content] ${fn.name}: ${r.error}`);
    return fallback;
  };
}

async function cachedStreams() {
  "use cache";
  cacheTag(TAGS.streams);
  return attempt(store.listStreams(), "hours");
}

async function cachedClips(filter: { bashoId?: string; boutId?: string } = {}) {
  "use cache";
  cacheTag(TAGS.clips);
  return attempt(store.listClips(filter), "hours");
}

async function cachedNewsArticles() {
  "use cache";
  cacheTag(TAGS.news);
  return attempt(store.listNews(), "hours");
}

async function cachedNewsArticle(slug: string) {
  "use cache";
  cacheTag(TAGS.news);
  return attempt(store.getNews(slug), "hours");
}

/** rikishiId -> portrait URL. The Sumo API has no images, so portraits are uploaded to Hygraph. */
async function cachedPortraitMap() {
  "use cache";
  cacheTag(TAGS.portraits);
  return attempt(
    store.listPortraits().then((list) => Object.fromEntries(list.map((p) => [p.rikishiId, p.imageUrl])) as Record<number, string>),
    "days",
  );
}

/** Bout ids an admin starred as exciting in this basho. */
async function cachedStarredBouts(bashoId: string) {
  "use cache";
  cacheTag(TAGS.stars);
  return attempt(store.listStars(bashoId).then((list) => list.map((s) => s.boutId)), "hours");
}

export const getStreams = unwrap(cachedStreams, [] as Stream[]);
export const getClips = unwrap(cachedClips, [] as Clip[]);
export const getNewsArticles = unwrap(cachedNewsArticles, [] as NewsArticle[]);
export const getNewsArticle = unwrap(cachedNewsArticle, null);
export const getPortraitMap = unwrap(cachedPortraitMap, {} as Record<number, string>);
export const getStarredBouts = unwrap(cachedStarredBouts, [] as string[]);
