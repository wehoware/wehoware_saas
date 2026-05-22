import { BaseSocialClient } from "./base-client.js";

const GRAPH_API_BASE = "https://graph.facebook.com/v18.0";

export class InstagramClient extends BaseSocialClient {
  constructor(account) {
    super(account);
    this.igUserId = account.profileData?.igUserId || null;
  }

  async refreshAccessToken() {
    const url = `${GRAPH_API_BASE}/oauth/access_token?grant_type=ig_refresh_token&access_token=${this.accessToken}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Instagram token refresh failed: ${res.status}`);
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    };
  }

  async createPost(content, mediaIds = [], options = {}) {
    const igUserId = options.igUserId || this.igUserId;
    if (!igUserId) throw new Error("Instagram User ID required");

    let containerId;
    if (mediaIds.length === 0) {
      const res = await this._fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
        method: "POST",
        body: JSON.stringify({ caption: content, media_type: "TEXT", access_token: this.accessToken }),
      });
      containerId = res.id;
    } else if (mediaIds.length === 1) {
      containerId = mediaIds[0];
      // Update caption on the existing container
      await this._fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
        method: "POST",
        body: JSON.stringify({ caption: content, image_url: options.firstMediaUrl, access_token: this.accessToken }),
      });
    } else {
      const children = mediaIds.join(",");
      const res = await this._fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
        method: "POST",
        body: JSON.stringify({ caption: content, media_type: "CAROUSEL", children, access_token: this.accessToken }),
      });
      containerId = res.id;
    }

    // Publish container
    const publish = await this._fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
      method: "POST",
      body: JSON.stringify({ creation_id: containerId, access_token: this.accessToken }),
    });
    return publish.id;
  }

  async uploadMedia(fileUrl, mimeType) {
    const igUserId = this.igUserId;
    if (!igUserId) throw new Error("Instagram User ID required for media upload");
    const isVideo = mimeType?.startsWith("video/");
    const res = await this._fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
      method: "POST",
      body: JSON.stringify({
        [isVideo ? "video_url" : "image_url"]: fileUrl,
        media_type: isVideo ? "REELS" : "IMAGE",
        is_carousel_item: true,
        access_token: this.accessToken,
      }),
    });
    return res.id;
  }

  async getPostMetrics(platformPostId) {
    try {
      const data = await this._fetch(
        `${GRAPH_API_BASE}/${platformPostId}/insights?metric=likes,comments,reach,impressions,saved&access_token=${this.accessToken}`
      );
      const metrics = {};
      for (const item of data.data || []) {
        metrics[item.name] = item.values?.[0]?.value || 0;
      }
      return metrics;
    } catch {
      return {};
    }
  }
}
