import { BaseSocialClient } from "./base-client.js";

const GRAPH_API_BASE = "https://graph.facebook.com/v18.0";

export class FacebookClient extends BaseSocialClient {
  constructor(account) {
    super(account);
    this.pageId = account.profileData?.pageId || null;
  }

  async refreshAccessToken() {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) throw new Error("Facebook App credentials not configured");

    const url = `${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${this.accessToken}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Facebook token refresh failed: ${res.status}`);
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    };
  }

  async getPages() {
    const data = await this._fetch(`${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token&access_token=${this.accessToken}`);
    return data.data || [];
  }

  async createPost(content, mediaIds = [], options = {}) {
    const pageId = options.pageId || this.pageId;
    if (!pageId) throw new Error("Facebook Page ID required");
    const pageToken = options.pageAccessToken || this.accessToken;

    const body = { message: content, access_token: pageToken };
    if (mediaIds.length === 1) {
      body.attached_media = [{ media_fbid: mediaIds[0] }];
    } else if (mediaIds.length > 1) {
      body.attached_media = mediaIds.map((id) => ({ media_fbid: id }));
    }

    const data = await this._fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return data.id;
  }

  async uploadMedia(fileUrl, mimeType) {
    const pageId = this.pageId;
    if (!pageId) throw new Error("Facebook Page ID required for media upload");
    const isVideo = mimeType?.startsWith("video/");
    const endpoint = isVideo
      ? `${GRAPH_API_BASE}/${pageId}/videos`
      : `${GRAPH_API_BASE}/${pageId}/photos`;

    const body = isVideo
      ? { file_url: fileUrl, published: false, access_token: this.accessToken }
      : { url: fileUrl, published: false, access_token: this.accessToken };

    const data = await this._fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return data.id;
  }

  async getPostMetrics(platformPostId) {
    try {
      const data = await this._fetch(
        `${GRAPH_API_BASE}/${platformPostId}/insights?metric=post_reactions_by_type_total,post_clicks,post_impressions,post_engaged_users&access_token=${this.accessToken}`
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
