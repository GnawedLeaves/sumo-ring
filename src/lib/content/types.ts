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
  /** Optional note shown under the video, e.g. "Rematch (torinaoshi)". */
  remarks?: string;
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

/** A bout an admin marked as exciting (shown with a star in the bout lists). */
export type BoutStar = { boutId: string; bashoId: string };

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
  /** Publishes an uploaded asset (once, when the clip that uses it is saved). */
  publishUpload(assetId: string): Promise<void>;
  /** Deletes an uploaded asset (e.g. a replaced avatar). */
  deleteUpload(assetId: string): Promise<void>;

  listNews(): Promise<NewsArticle[]>;
  getNews(slug: string): Promise<NewsArticle | null>;
  createNews(input: Omit<NewsArticle, "id">): Promise<NewsArticle>;
  /** Replaces an article's source list (the ingest job adds outlets that reported the same story later). */
  updateNewsSources(id: string, sources: NewsSource[]): Promise<void>;

  listPortraits(): Promise<Portrait[]>;
  /** Point a rikishi's portrait at an uploaded image asset (creates or replaces it). */
  setPortrait(rikishiId: number, assetId: string): Promise<void>;

  listStars(bashoId: string): Promise<BoutStar[]>;
  /** Stars or un-stars a bout (idempotent). */
  setStar(star: BoutStar, starred: boolean): Promise<void>;
}

export type UploadStatus = { status: "pending" | "complete" | "error"; url: string; error?: string; mimeType?: string; size?: number };

export type UploadTarget = {
  assetId: string;
  /** Final public URL of the asset once the upload completes. */
  assetUrl: string;
  postUrl: string;
  fields: Record<string, string>;
};
