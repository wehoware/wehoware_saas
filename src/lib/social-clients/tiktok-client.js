import { BaseSocialClient } from "./base-client.js";

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

export class TikTokClient extends BaseSocialClient {
  // ── Profile ─────────────────────────────────────────────────────────────

  async getProfile() {
    const data = await this._fetch(
      `${TIKTOK_API_BASE}/user/info/?fields=open_id,union_id,avatar_url,display_name,follower_count,likes_count`
    );
    const u = data.data?.user || {};
    return {
      accountName: u.display_name || "TikTok Account",
      accountHandle: u.open_id || null,
      followerCount: u.follower_count || 0,
      profileData: { ...this.profileData, openId: u.open_id, unionId: u.union_id, avatarUrl: u.avatar_url, likesCount: u.likes_count },
    };
  }

  // ── Token ────────────────────────────────────────────────────────────────

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

  // ── Publishing ───────────────────────────────────────────────────────────

  async createPost(content, mediaIds = [], _options = {}) {
    if (mediaIds.length === 0) throw new Error("TikTok requires at least one video");
    const tagString = content.match(/#\w+/g)?.join(" ") || "";
    const body = {
      post_info: {
        title: content.replace(/#\w+/g, "").trim().slice(0, 150),
        privacy_level: "SELF_ONLY",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
        ...(tagString ? { brand_content_toggle: false } : {}),
      },
      source_info: { source: "PULL_FROM_URL", video_url: mediaIds[0] },
    };
    const data = await this._fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
      method: "POST", body: JSON.stringify(body),
    });
    return data.data?.publish_id;
  }

  async uploadMedia(fileUrl, _mimeType) { return fileUrl; }

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
    } catch { return {}; }
  }

  // ── Inbox — TikTok Video Comments ────────────────────────────────────────
  // TikTok does not provide a third-party DM API. The inbox uses video
  // comment threads as conversations instead.

  async fetchConversations(since = null) {
    // Fetch the account's videos to treat each as a "conversation"
    const res = await this._fetch(
      `${TIKTOK_API_BASE}/video/list/?fields=id,title,create_time,share_url&max_count=20`
    );
    const videos = res.data?.videos || [];
    return videos
      .filter((v) => !since || new Date(v.create_time * 1000) > new Date(since))
      .map((v) => ({
        platformConversationId: v.id,
        participantName: v.title?.slice(0, 60) || `Video ${v.id}`,
        participantHandle: null,
        participantAvatar: null,
        participantId: v.id,
        lastMessageAt: v.create_time ? new Date(v.create_time * 1000) : null,
        lastMessagePreview: null,
        metadata: { videoId: v.id, shareUrl: v.share_url, type: "comments" },
      }));
  }

  async fetchMessages(videoId, since = null) {
    const res = await this._fetch(`${TIKTOK_API_BASE}/video/comment/list/`, {
      method: "POST",
      body: JSON.stringify({ video_id: videoId, max_count: 100, cursor: 0 }),
    });
    const comments = res.data?.comments || [];
    return comments
      .filter((c) => !since || new Date(c.create_time * 1000) > new Date(since))
      .map((c) => ({
        platformMessageId: c.cid,
        direction: "Inbound",
        senderName: c.user?.nickname || "TikTok User",
        senderHandle: null,
        senderAvatar: c.user?.avatar_thumb?.url_list?.[0] || null,
        content: c.text || "",
        mediaUrls: [],
        sentAt: c.create_time ? new Date(c.create_time * 1000) : new Date(),
        metadata: { likes: c.digg_count || 0 },
      }));
  }

  async sendReply(videoId, _participantId, text) {
    // Reply to the most recent comment on the video; TikTok requires a comment_id
    // for nested replies, so this posts a top-level comment on the video.
    const data = await this._fetch(`${TIKTOK_API_BASE}/video/comment/create/`, {
      method: "POST",
      body: JSON.stringify({ video_id: videoId, text }),
    });
    return data.data?.comment?.cid;
  }
}
