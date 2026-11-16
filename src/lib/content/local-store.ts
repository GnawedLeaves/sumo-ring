// Development fallback used when HYGRAPH_ENDPOINT is not set: content lives in .data/content.json.
// Not for production — Render's filesystem is ephemeral.
import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Clip, ContentStore, NewsArticle, Portrait, Stream } from "./types";

type Data = { streams: Stream[]; clips: Clip[]; news: NewsArticle[]; portraits: Portrait[] };

const FILE = path.join(process.cwd(), ".data", "content.json");
const EMPTY: Data = { streams: [], clips: [], news: [], portraits: [] };

async function load(): Promise<Data> {
  try {
    return { ...EMPTY, ...JSON.parse(await fs.readFile(FILE, "utf8")) };
  } catch {
    return structuredClone(EMPTY);
  }
}

async function save(data: Data) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

export const localStore: ContentStore = {
  kind: "local",

  async listStreams() {
    return (await load()).streams.sort((a, b) => a.order - b.order);
  },
  async createStream(input) {
    const data = await load();
    const stream = { ...input, id: randomUUID() };
    data.streams.push(stream);
    await save(data);
    return stream;
  },
  async updateStream(id, input) {
    const data = await load();
    const i = data.streams.findIndex((s) => s.id === id);
    if (i < 0) throw new Error("Stream not found");
    data.streams[i] = { ...data.streams[i], ...input };
    await save(data);
    return data.streams[i];
  },
  async deleteStream(id) {
    const data = await load();
    data.streams = data.streams.filter((s) => s.id !== id);
    await save(data);
  },

  async listClips(filter = {}) {
    return (await load()).clips
      .filter((c) => (!filter.bashoId || c.bashoId === filter.bashoId) && (!filter.boutId || c.boutId === filter.boutId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async createClip(input) {
    const data = await load();
    const clip = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    data.clips.push(clip);
    await save(data);
    return clip;
  },
  async deleteClip(id) {
    const data = await load();
    data.clips = data.clips.filter((c) => c.id !== id);
    await save(data);
  },
  async createUpload() {
    return null; // video uploads need Hygraph
  },
  async getUploadStatus() {
    return null;
  },
  async publishUpload() {
    // nothing to publish locally
  },
  async deleteUpload() {
    // nothing stored locally
  },

  async listNews() {
    return (await load()).news.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  },
  async getNews(slug) {
    return (await load()).news.find((n) => n.slug === slug) ?? null;
  },
  async createNews(input) {
    const data = await load();
    const article = { ...input, id: randomUUID() };
    data.news.push(article);
    await save(data);
    return article;
  },
  async updateNewsSources(id, sources) {
    const data = await load();
    const article = data.news.find((n) => n.id === id);
    if (article) article.sources = sources;
    await save(data);
  },

  async listPortraits() {
    return (await load()).portraits;
  },
  async setPortrait() {
    throw new Error("Portrait uploads need Hygraph — set HYGRAPH_ENDPOINT and HYGRAPH_TOKEN.");
  },
};
