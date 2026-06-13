import { BaseSocialClient } from "./base-client.js";

const GRAPH_API_BASE = "https://graph.facebook.com/v18.0";

export class FacebookClient extends BaseSocialClient {
  get pageId() { return this.profileData.pageId || null; }
  get pageToken() { return this.profileData.pageAccessToken || this.accessToken; }

  // ── Token ────────────────────────────────────────────────────────────────

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

  // ── Publishing ───────────────────────────────────────────────────────────

  async createPost(content, mediaIds = [], options = {}) {
    const pageId = options.pageId || this.pageId;
    if (!pageId) throw new Error("Facebook Page ID required");
    const token = options.pageAccessToken || this.pageToken;
    const body = { message: content, access_token: token };
    if (mediaIds.length === 1) body.attached_media = [{ media_fbid: mediaIds[0] }];
    else if (mediaIds.length > 1) body.attached_media = mediaIds.map((id) => ({ media_fbid: id }));
    const data = await this._fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return data.id;
  }

  async uploadMedia(fileUrl, mimeType) {
    if (!this.pageId) throw new Error("Facebook Page ID required for media upload");
    const isVideo = mimeType?.startsWith("video/");
    const endpoint = isVideo
      ? `${GRAPH_API_BASE}/${this.pageId}/videos`
      : `${GRAPH_API_BASE}/${this.pageId}/photos`;
    const body = isVideo
      ? { file_url: fileUrl, published: false, access_token: this.pageToken }
      : { url: fileUrl, published: false, access_token: this.pageToken };
    const data = await this._fetch(endpoint, { method: "POST", body: JSON.stringify(body) });
    return data.id;
  }

  async getPostMetrics(platformPostId) {
    try {
      const data = await this._fetch(
        `${GRAPH_API_BASE}/${platformPostId}/insights?metric=post_reactions_by_type_total,post_clicks,post_impressions,post_engaged_users&access_token=${this.pageToken}`
      );
      const metrics = {};
      for (const item of data.data || []) metrics[item.name] = item.values?.[0]?.value || 0;
      return metrics;
    } catch { return {}; }
  }

  // ── Inbox — Facebook Messenger ───────────────────────────────────────────

  async fetchConversations(since = null) {
    if (!this.pageId) throw new Error("Facebook Page ID required");
    let url = `${GRAPH_API_BASE}/${this.pageId}/conversations?platform=messenger&fields=id,participants{name,email,id},updated_time,snippet&access_token=${this.pageToken}`;
    if (since) url += `&since=${Math.floor(new Date(since).getTime() / 1000)}`;

    const data = await this._fetch(url);
    return (data.data || []).map((conv) => {
      // Filter out the page itself to find the actual user
      const user = conv.participants?.data?.find((p) => p.id !== this.pageId) || {};
      return {
        platformConversationId: conv.id,
        participantName: user.name || "Messenger User",
        participantHandle: user.email || null,
        participantAvatar: null,
        participantId: user.id || conv.id,
        lastMessageAt: conv.updated_time ? new Date(conv.updated_time) : null,
        lastMessagePreview: conv.snippet || null,
        metadata: {},
      };
    });
  }

  async fetchMessages(platformConversationId, since = null) {
    let url = `${GRAPH_API_BASE}/${platformConversationId}/messages?fields=id,message,from,created_time,attachments{image_data,file_url}&access_token=${this.pageToken}`;
    if (since) url += `&since=${Math.floor(new Date(since).getTime() / 1000)}`;
    const data = await this._fetch(url);
    return (data.data || []).map((msg) => ({
      platformMessageId: msg.id,
      direction: msg.from?.id === this.pageId ? "Outbound" : "Inbound",
      senderName: msg.from?.name || "Unknown",
      senderHandle: null,
      senderAvatar: null,
      content: msg.message || "[Media message]",
      mediaUrls: (msg.attachments?.data || [])
        .map((a) => a.image_data?.url || a.file_url)
        .filter(Boolean),
      sentAt: msg.created_time ? new Date(msg.created_time) : new Date(),
      metadata: {},
    }));
  }

  async sendReply(_platformConversationId, participantId, text) {
    if (!this.pageId) throw new Error("Facebook Page ID required");
    const data = await this._fetch(`${GRAPH_API_BASE}/${this.pageId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        recipient: { id: participantId },
        message: { text },
        access_token: this.pageToken,
      }),
    });
    return data.message_id;
  }
}
