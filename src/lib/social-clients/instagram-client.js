import { BaseSocialClient } from "./base-client.js";

const GRAPH_API_BASE = "https://graph.facebook.com/v18.0";
const IG_REFRESH_BASE = "https://graph.instagram.com";

export class InstagramClient extends BaseSocialClient {
  get igUserId() { return this.profileData.igUserId || null; }

  // ── Token ────────────────────────────────────────────────────────────────

  async refreshAccessToken() {
    const url = `${IG_REFRESH_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${this.accessToken}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Instagram token refresh failed: ${res.status}`);
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    };
  }

  // ── Publishing ───────────────────────────────────────────────────────────

  // uploadMedia returns the URL unchanged; container creation happens in createPost.
  async uploadMedia(fileUrl, _mimeType) { return fileUrl; }

  async createPost(content, mediaUrls = [], options = {}) {
    const igUserId = options.igUserId || this.igUserId;
    if (!igUserId) throw new Error("Instagram User ID required");
    if (mediaUrls.length === 0) throw new Error("Instagram requires at least one image or video");

    let containerId;
    if (mediaUrls.length === 1) {
      const url = mediaUrls[0];
      const isVideo = url.endsWith(".mp4") || url.endsWith(".mov");
      const body = { caption: content, access_token: this.accessToken };
      if (isVideo) { body.media_type = "REELS"; body.video_url = url; }
      else { body.image_url = url; }
      const res = await this._fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
        method: "POST", body: JSON.stringify(body),
      });
      containerId = res.id;
    } else {
      const itemIds = [];
      for (const url of mediaUrls) {
        const isVideo = url.endsWith(".mp4") || url.endsWith(".mov");
        const itemBody = { is_carousel_item: true, access_token: this.accessToken };
        if (isVideo) { itemBody.media_type = "VIDEO"; itemBody.video_url = url; }
        else { itemBody.image_url = url; }
        const res = await this._fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
          method: "POST", body: JSON.stringify(itemBody),
        });
        itemIds.push(res.id);
      }
      const carouselRes = await this._fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
        method: "POST",
        body: JSON.stringify({
          media_type: "CAROUSEL", caption: content,
          children: itemIds.join(","), access_token: this.accessToken,
        }),
      });
      containerId = carouselRes.id;
    }

    const publish = await this._fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
      method: "POST",
      body: JSON.stringify({ creation_id: containerId, access_token: this.accessToken }),
    });
    return publish.id;
  }

  async getPostMetrics(platformPostId) {
    try {
      const data = await this._fetch(
        `${GRAPH_API_BASE}/${platformPostId}/insights?metric=likes,comments,reach,impressions,saved&access_token=${this.accessToken}`
      );
      const metrics = {};
      for (const item of data.data || []) metrics[item.name] = item.values?.[0]?.value || 0;
      return metrics;
    } catch { return {}; }
  }

  // ── Inbox — Instagram Business DMs ───────────────────────────────────────

  async fetchConversations(since = null) {
    if (!this.igUserId) throw new Error("Instagram User ID required");
    let url = `${GRAPH_API_BASE}/${this.igUserId}/conversations?platform=instagram&fields=id,participants{username,name,id},updated_time,snippet&access_token=${this.accessToken}`;
    if (since) url += `&since=${Math.floor(new Date(since).getTime() / 1000)}`;

    const data = await this._fetch(url);
    return (data.data || []).map((conv) => {
      const user = conv.participants?.data?.find((p) => p.id !== this.igUserId) || {};
      return {
        platformConversationId: conv.id,
        participantName: user.name || user.username || "Instagram User",
        participantHandle: user.username ? `@${user.username}` : null,
        participantAvatar: null,
        participantId: user.id || conv.id,
        lastMessageAt: conv.updated_time ? new Date(conv.updated_time) : null,
        lastMessagePreview: conv.snippet || null,
        metadata: {},
      };
    });
  }

  async fetchMessages(platformConversationId, since = null) {
    let url = `${GRAPH_API_BASE}/${platformConversationId}/messages?fields=id,text,from,timestamp,attachments&access_token=${this.accessToken}`;
    if (since) url += `&since=${Math.floor(new Date(since).getTime() / 1000)}`;
    const data = await this._fetch(url);
    return (data.data || []).map((msg) => ({
      platformMessageId: msg.id,
      direction: msg.from?.id === this.igUserId ? "Outbound" : "Inbound",
      senderName: msg.from?.username || msg.from?.name || "Unknown",
      senderHandle: msg.from?.username ? `@${msg.from.username}` : null,
      senderAvatar: null,
      content: msg.text || "[Media message]",
      mediaUrls: (msg.attachments?.data || [])
        .map((a) => a.image_data?.url || a.video_data?.url)
        .filter(Boolean),
      sentAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      metadata: {},
    }));
  }

  async sendReply(_platformConversationId, participantId, text) {
    if (!this.igUserId) throw new Error("Instagram User ID required");
    const data = await this._fetch(`${GRAPH_API_BASE}/${this.igUserId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        recipient: { id: participantId },
        message: { text },
        access_token: this.accessToken,
      }),
    });
    return data.message_id;
  }
}
