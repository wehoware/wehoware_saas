import { BaseSocialClient } from "./base-client.js";

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

export class TikTokClient extends BaseSocialClient {
  async refreshAccessToken() {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    if (!clientKey || !clientSecret || !this.refreshToken) {
      throw new Error("TikTok credentials or refresh token not configured");
    }
    const res = await fetch(`${TIKTOK_API_BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
      }).toString(),
    });
    if (!res.ok) throw new Error(`TikTok token refresh failed: ${res.status}`);
    const data = await res.json();
    return {
      accessToken: data.data?.access_token,
      refreshToken: data.data?.refresh_token || this.refreshToken,
      expiresAt: data.data?.access_token_expire_in
        ? new Date(Date.now() + data.data.access_token_expire_in * 1000)
        : null,
    };
  }

  async createPost(content, mediaIds = [], _options = {}) {
    if (mediaIds.length === 0) {
      throw new Error("TikTok requires at least one video");
    }
    const videoId = mediaIds[0];
    const body = {
      post_info: {
        title: content.slice(0, 150),
        privacy_level: "SELF_ONLY",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: videoId,
      },
    };
    const data = await this._fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return data.data?.publish_id;
  }

  async uploadMedia(fileUrl, _mimeType) {
    return fileUrl;
  }

  async getPostMetrics(platformPostId) {
    try {
      const data = await this._fetch(`${TIKTOK_API_BASE}/video/query/`, {
        method: "POST",
        body: JSON.stringify({
          filters: { video_ids: [platformPostId] },
          fields: ["like_count", "comment_count", "share_count", "view_count"],
        }),
      });
      return data.data?.videos?.[0] || {};
    } catch {
      return {};
    }
  }
}
