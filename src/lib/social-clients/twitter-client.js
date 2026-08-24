import { BaseSocialClient } from "./base-client.js";

const TWITTER_API_BASE = "https://api.twitter.com/2";
const TWITTER_UPLOAD_BASE = "https://upload.twitter.com/1.1";
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

export class TwitterClient extends BaseSocialClient {
  get myUserId() { return this.profileData.userId || null; }

  // ── Profile ─────────────────────────────────────────────────────────────

  async getProfile() {
    if (!this.myUserId) throw new Error("Twitter User ID required in profileData");
    const data = await this._fetch(
      `${TWITTER_API_BASE}/users/${this.myUserId}?user.fields=name,username,public_metrics,profile_image_url`
    );
    const u = data.data || {};
    return {
      accountName: u.name || "Twitter User",
      accountHandle: u.username ? `@${u.username}` : null,
      followerCount: u.public_metrics?.followers_count || 0,
      profileData: { ...this.profileData, userId: this.myUserId, profileImageUrl: u.profile_image_url },
    };
  }

  // ── Token ────────────────────────────────────────────────────────────────

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

  // ── Publishing ───────────────────────────────────────────────────────────

  async createPost(content, mediaIds = [], _options = {}) {
    const body = { text: content };
    if (mediaIds.length > 0) body.media = { media_ids: mediaIds.slice(0, 4) };
    const data = await this._fetch(`${TWITTER_API_BASE}/tweets`, {
      method: "POST", body: JSON.stringify(body),
    });
    return data.data?.id;
  }

  async uploadMedia(fileUrl, mimeType) {
    const imageRes = await fetch(fileUrl);
    if (!imageRes.ok) throw new Error(`Failed to fetch media from URL: ${imageRes.status}`);
    const buffer = await imageRes.arrayBuffer();
    const bytes = Buffer.from(buffer);
    const total = bytes.length;

    const init = await this._fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        command: "INIT",
        total_bytes: String(total),
        media_type: mimeType || "image/jpeg",
      }).toString(),
    });
    const mediaId = init.media_id_string;

    let segment = 0;
    for (let offset = 0; offset < total; offset += CHUNK_SIZE, segment++) {
      const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
      const fd = new FormData();
      fd.append("command", "APPEND");
      fd.append("media_id", mediaId);
      fd.append("segment_index", String(segment));
      fd.append("media", new Blob([chunk], { type: mimeType || "image/jpeg" }));
      const appendRes = await fetch(`${TWITTER_UPLOAD_BASE}/media/upload.json`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: fd,
      });
      if (!appendRes.ok) {
        const body = await appendRes.text().catch(() => "");
        throw new Error(`Twitter media APPEND failed (segment ${segment}): ${appendRes.status} ${body}`);
      }
    }

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
    } catch { return {}; }
  }

  // ── Post Management ──────────────────────────────────────────────────────

  async deletePost(platformPostId) {
    await this._fetch(`${TWITTER_API_BASE}/tweets/${platformPostId}`, { method: "DELETE" });
    return true;
  }

  // ── Inbox — Twitter Direct Messages ──────────────────────────────────────

  async fetchConversations(since = null) {
    if (!this.myUserId) throw new Error("Twitter User ID required in profileData");
    let url = `${TWITTER_API_BASE}/users/${this.myUserId}/dm_conversations`
      + `?dm_event.fields=created_at,sender_id,text,attachments`
      + `&expansions=sender_id,participant_ids`
      + `&user.fields=name,username,profile_image_url`
      + `&max_results=50`;
    if (since) url += `&start_time=${new Date(since).toISOString()}`;

    const data = await this._fetch(url);
    const users = {};
    for (const u of data.includes?.users || []) users[u.id] = u;

    return (data.data || []).map((conv) => {
      const otherId = (conv.participant_ids || []).find((id) => id !== this.myUserId);
      const other = users[otherId] || {};
      const lastEvent = (conv.dm_events || [])[0];
      return {
        platformConversationId: conv.dm_conversation_id || conv.id,
        participantName: other.name || "Twitter User",
        participantHandle: other.username ? `@${other.username}` : null,
        participantAvatar: other.profile_image_url || null,
        participantId: otherId || "",
        lastMessageAt: lastEvent?.created_at ? new Date(lastEvent.created_at) : null,
        lastMessagePreview: lastEvent?.text?.slice(0, 100) || null,
        metadata: { conversationType: conv.conversation_type },
      };
    });
  }

  async fetchMessages(platformConversationId, since = null) {
    let url = `${TWITTER_API_BASE}/dm_conversations/${platformConversationId}/dm_events`
      + `?dm_event.fields=created_at,sender_id,text,attachments`
      + `&expansions=sender_id,attachments.media_keys`
      + `&user.fields=name,username,profile_image_url`
      + `&media.fields=url,preview_image_url`
      + `&max_results=100`;
    if (since) url += `&start_time=${new Date(since).toISOString()}`;

    const data = await this._fetch(url);
    const users = {};
    for (const u of data.includes?.users || []) users[u.id] = u;
    const media = {};
    for (const m of data.includes?.media || []) media[m.media_key] = m;

    return (data.data || [])
      .filter((e) => e.event_type === "MessageCreate")
      .map((event) => {
        const sender = users[event.sender_id] || {};
        const mediaUrls = (event.attachments?.media_keys || [])
          .map((key) => media[key]?.url || media[key]?.preview_image_url)
          .filter(Boolean);
        return {
          platformMessageId: event.id,
          direction: event.sender_id === this.myUserId ? "Outbound" : "Inbound",
          senderName: sender.name || "Twitter User",
          senderHandle: sender.username ? `@${sender.username}` : null,
          senderAvatar: sender.profile_image_url || null,
          content: event.text || "[Media message]",
          mediaUrls,
          sentAt: event.created_at ? new Date(event.created_at) : new Date(),
          metadata: {},
        };
      });
  }

  async sendReply(platformConversationId, _participantId, text) {
    const data = await this._fetch(
      `${TWITTER_API_BASE}/dm_conversations/${platformConversationId}/messages`,
      { method: "POST", body: JSON.stringify({ text }) }
    );
    return data.data?.dm_event_id;
  }
}
