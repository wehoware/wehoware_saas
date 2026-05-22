import { BaseSocialClient } from "./base-client.js";

const TWITTER_API_BASE = "https://api.twitter.com/2";
const TWITTER_UPLOAD_BASE = "https://upload.twitter.com/1.1";

export class TwitterClient extends BaseSocialClient {
  async refreshAccessToken() {
    const clientId = process.env.TWITTER_API_KEY;
    const clientSecret = process.env.TWITTER_API_SECRET;
    if (!clientId || !clientSecret || !this.refreshToken) {
      throw new Error("Twitter OAuth credentials or refresh token not configured");
    }
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(`${TWITTER_API_BASE}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
      }).toString(),
    });
    if (!res.ok) throw new Error(`Twitter token refresh failed: ${res.status}`);
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    };
  }

  async createPost(content, mediaIds = [], _options = {}) {
    const body = { text: content };
    if (mediaIds.length > 0) {
      body.media = { media_ids: mediaIds.slice(0, 4) };
    }
    const data = await this._fetch(`${TWITTER_API_BASE}/tweets`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return data.data?.id;
  }

  async uploadMedia(fileUrl, mimeType) {
    const imageRes = await fetch(fileUrl);
    const buffer = await imageRes.arrayBuffer();
    const bytes = Buffer.from(buffer);
    const total = bytes.length;

    // Initialize upload
    const init = await this._fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        command: "INIT",
        total_bytes: total.toString(),
        media_type: mimeType || "image/jpeg",
      }).toString(),
    });
    const mediaId = init.media_id_string;

    // Append in 5MB chunks
    const CHUNK = 5 * 1024 * 1024;
    let segment = 0;
    for (let offset = 0; offset < total; offset += CHUNK, segment++) {
      const chunk = bytes.slice(offset, offset + CHUNK);
      const fd = new FormData();
      fd.append("command", "APPEND");
      fd.append("media_id", mediaId);
      fd.append("segment_index", segment.toString());
      fd.append("media", new Blob([chunk], { type: mimeType || "image/jpeg" }));
      await fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: fd,
      });
    }

    // Finalize
    await this._fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ command: "FINALIZE", media_id: mediaId }).toString(),
    });
    return mediaId;
  }

  async getPostMetrics(platformPostId) {
    try {
      const data = await this._fetch(
        `${TWITTER_API_BASE}/tweets/${platformPostId}?tweet.fields=public_metrics`
      );
      return data.data?.public_metrics || {};
    } catch {
      return {};
    }
  }
}
