// Real adapter against the free YouTube Data API v3 (10,000 quota
// units/day, no billing required — console.cloud.google.com → enable
// "YouTube Data API v3" → Credentials → API key).
//
// Quota budget per full account refresh: channels.list (1 unit) +
// playlistItems.list (1 unit) + videos.list (1 unit) = 3 units. Deliberately
// avoids search.list (100 units/call) — see the build plan's Phase 2 note.

import type { AccountSnapshot, ContentItem, ExternalAccount, PlatformAdapter } from "./types";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const CACHE_TTL_MS = 60_000; // dedupe fetchAccount + fetchRecentContent calls for the same creator within one orchestrator pass
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

interface YouTubeChannelItem {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    publishedAt?: string;
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
  contentDetails?: {
    relatedPlaylists?: { uploads?: string };
  };
}

interface YouTubeVideoItem {
  id: string;
  snippet?: { title?: string; publishedAt?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

interface CachedChannel {
  item: YouTubeChannelItem;
  fetchedAt: number;
}

interface CachedContent {
  videos: ContentItem[];
  fetchedAt: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YouTube API request failed (${res.status}): ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform = "youtube" as const;
  private readonly apiKey: string;
  private readonly channelCache = new Map<string, CachedChannel>();
  private readonly contentCache = new Map<string, CachedContent>();

  constructor(apiKey: string | undefined = process.env.YOUTUBE_API_KEY) {
    if (!apiKey) {
      throw new Error(
        "YouTubeAdapter requires YOUTUBE_API_KEY. Get a free key at console.cloud.google.com (enable YouTube Data API v3).",
      );
    }
    this.apiKey = apiKey;
  }

  /** Accepts an @handle, a legacy /c/ custom name, or a raw channel id
   * (starts with "UC", 24 chars). 1 quota unit. */
  async resolveHandle(handleOrId: string): Promise<ExternalAccount | null> {
    const trimmed = handleOrId.trim();
    const isChannelId = /^UC[\w-]{22}$/.test(trimmed);

    const params = new URLSearchParams({ part: "snippet,statistics", key: this.apiKey });
    if (isChannelId) {
      params.set("id", trimmed);
    } else {
      params.set("forHandle", trimmed.replace(/^@/, ""));
    }

    const data = await fetchJson<{ items?: YouTubeChannelItem[] }>(
      `${API_BASE}/channels?${params.toString()}`,
    );
    const item = data.items?.[0];
    if (!item) return null;

    const description = item.snippet?.description ?? "";
    const emailMatch = description.match(EMAIL_REGEX);

    return {
      externalId: item.id,
      handle: item.snippet?.customUrl ?? trimmed,
      url: `https://www.youtube.com/channel/${item.id}`,
      createdYear: item.snippet?.publishedAt
        ? new Date(item.snippet.publishedAt).getFullYear()
        : null,
      publicBusinessEmail: emailMatch ? emailMatch[0] : null,
    };
  }

  /** Cached, combined snippet+statistics+contentDetails lookup so
   * fetchAccount/fetchRecentContent share one channels.list call. */
  private async loadChannel(externalId: string): Promise<YouTubeChannelItem> {
    const cached = this.channelCache.get(externalId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.item;

    const params = new URLSearchParams({
      part: "snippet,statistics,contentDetails",
      id: externalId,
      key: this.apiKey,
    });
    const data = await fetchJson<{ items?: YouTubeChannelItem[] }>(
      `${API_BASE}/channels?${params.toString()}`,
    );
    const item = data.items?.[0];
    if (!item) throw new Error(`YouTube channel not found: ${externalId}`);

    this.channelCache.set(externalId, { item, fetchedAt: Date.now() });
    return item;
  }

  /** playlistItems.list (1 unit) + videos.list (1 unit), cached per
   * externalId so a fetchAccount + fetchRecentContent pair costs 2 units
   * total, not 4. */
  private async loadRecentVideos(externalId: string, limit: number): Promise<ContentItem[]> {
    const cached = this.contentCache.get(externalId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.videos.slice(0, limit);
    }

    const channel = await this.loadChannel(externalId);
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      this.contentCache.set(externalId, { videos: [], fetchedAt: Date.now() });
      return [];
    }

    const playlistParams = new URLSearchParams({
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(Math.max(limit, 1), 50)),
      key: this.apiKey,
    });
    const playlistData = await fetchJson<{
      items?: { contentDetails?: { videoId?: string } }[];
    }>(`${API_BASE}/playlistItems?${playlistParams.toString()}`);
    const videoIds = (playlistData.items ?? [])
      .map((i) => i.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id));

    if (videoIds.length === 0) {
      this.contentCache.set(externalId, { videos: [], fetchedAt: Date.now() });
      return [];
    }

    const videosParams = new URLSearchParams({
      part: "snippet,statistics",
      id: videoIds.join(","),
      key: this.apiKey,
    });
    const videosData = await fetchJson<{ items?: YouTubeVideoItem[] }>(
      `${API_BASE}/videos?${videosParams.toString()}`,
    );

    const videos: ContentItem[] = (videosData.items ?? []).map((v) => ({
      externalId: v.id,
      title: v.snippet?.title ?? "",
      publishedAt: v.snippet?.publishedAt ?? new Date().toISOString(),
      views: Number(v.statistics?.viewCount ?? 0),
      likes: Number(v.statistics?.likeCount ?? 0),
      comments: Number(v.statistics?.commentCount ?? 0),
    }));

    this.contentCache.set(externalId, { videos, fetchedAt: Date.now() });
    return videos.slice(0, limit);
  }

  async fetchAccount(externalId: string): Promise<AccountSnapshot> {
    const channel = await this.loadChannel(externalId);
    const stats = channel.statistics;
    if (!stats) throw new Error(`YouTube channel has no statistics: ${externalId}`);

    const recentVideos = await this.loadRecentVideos(externalId, 10);
    const n = recentVideos.length || 1;
    const avgViews = Math.round(recentVideos.reduce((s, v) => s + v.views, 0) / n);
    const avgLikes = Math.round(recentVideos.reduce((s, v) => s + v.likes, 0) / n);
    const avgComments = Math.round(recentVideos.reduce((s, v) => s + v.comments, 0) / n);

    return {
      followers: Number(stats.subscriberCount ?? 0),
      totalViews: Number(stats.viewCount ?? 0),
      avgViews,
      likes: avgLikes,
      comments: avgComments,
      // The public Data API doesn't expose channel-level watch-time; only
      // available to the channel owner via YouTube Analytics API (OAuth).
      watchHours: 0,
      uploadCount: Number(stats.videoCount ?? 0),
    };
  }

  async fetchRecentContent(externalId: string, limit: number): Promise<ContentItem[]> {
    return this.loadRecentVideos(externalId, limit);
  }
}
