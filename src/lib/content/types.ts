// Content models stored in Hygraph (or the local JSON fallback). Schema: docs/HYGRAPH.md

export type Platform = "youtube" | "twitch";

export type Stream = {
  id: string;
  name: string;
  url: string;
  platform: Platform;
  order: number;
  note?: string;
};

export type StreamInput = Omit<Stream, "id">;

/** How a clip's video is sourced. `upload` = Hygraph asset; the rest point into an existing video. */
export type ClipSource = "upload" | "youtube" | "twitch" | "url";

export type Clip = {
  id: string;
  title: string;
  /** Torikumi bout id: `${bashoId}-${day}-${matchNo}-${eastId}-${westId}` */
  boutId: string;
  bashoId: string;
  day: number;
  eastId: number;
  westId: number;
  eastShikona: string;
  westShikona: string;
  source: ClipSource;
  videoUrl: string;
  /** Clip window inside a longer video (stream VODs). Groundwork for in-app clipping (spec 1.1). */
  startSec?: number;
  endSec?: number;
  streamId?: string;
  createdAt: string;
};

export type ClipInput = Omit<Clip, "id" | "createdAt">;

export type NewsSource = { title: string; url: string; publisher?: string };

export type NewsArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  /** Markdown */
  body: string;
  tags: string[];
  sources: NewsSource[];
  imageUrl?: string;
  publishedAt: string;
};

export type Portrait = { rikishiId: number; imageUrl: string };

export interface ContentStore {
  readonly kind: "hygraph" | "local";
  listStreams(): Promise<Stream[]>;
  createStream(input: StreamInput): Promise<Stream>;
  updateStream(id: string, input: Partial<StreamInput>): Promise<Stream>;
  deleteStream(id: string): Promise<void>;

  listClips(filter?: { bashoId?: string; boutId?: string }): Promise<Clip[]>;
  createClip(input: ClipInput): Promise<Clip>;
  deleteClip(id: string): Promise<void>;
  /** Returns a presigned upload target for a clip video, or null when uploads aren't supported. */
  createUpload(fileName: string): Promise<UploadTarget | null>;
  /** Processing state of an uploaded asset; its URL only serves once status is "complete". */
  getUploadStatus(assetId: string): Promise<UploadStatus | null>;

  listNews(): Promise<NewsArticle[]>;
  getNews(slug: string): Promise<NewsArticle | null>;
  createNews(input: Omit<NewsArticle, "id">): Promise<NewsArticle>;

  listPortraits(): Promise<Portrait[]>;
}

export type UploadStatus = { status: "pending" | "complete" | "error"; url: string; error?: string };

export type UploadTarget = {
  assetId: string;
  /** Final public URL of the asset once the upload completes. */
  assetUrl: string;
  postUrl: string;
  fields: Record<string, string>;
};
