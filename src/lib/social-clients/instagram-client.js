import { BaseSocialClient } from "./base-client.js";

// Instagram API with Instagram Login uses graph.instagram.com (NOT graph.facebook.com).
// See: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/migration-guide/
const IG_API_BASE = "https://graph.instagram.com";
const IG_REFRESH_BASE = "https://graph.instagram.com";

export class InstagramClient extends BaseSocialClient {
  get igUserId() { return this.profileData.igUserId || null; }

  // Instagram API uses access_token in query/body, not Bearer header.
  // Override _fetch to avoid sending the Authorization header.
  async _fetch(url, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    // Remove Authorization header if present from base class
    delete headers.Authorization;
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`${this.platformCode} API error ${res.status}: ${body}`);
      err.statusCode = res.status;
      err.platformCode = this.platformCode;
      throw err;
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
  }

  // ── Profile ─────────────────────────────────────────────────────────────

  async getProfile() {
    if (!this.igUserId) throw new Error("Instagram User ID required");
    const data = await this._fetch(
      `${IG_API_BASE}/${this.igUserId}?fields=username,name,followers_count,media_count,profile_picture_url&access_token=${this.accessToken}`
    );
    return {
      accountName: data.name || data.username || "Instagram Account",
      accountHandle: data.username ? `@${data.username}` : null,
      followerCount: data.followers_count || 0,
      profileData: { ...this.profileData, igUserId: this.igUserId, mediaCount: data.media_count, profilePictureUrl: data.profile_picture_url },
    };
  }

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

  /**
   * Wait for a media container to become ready for publishing.
   * Instagram processes media asynchronously — publishing immediately after
   * container creation fails with "Media ID is not available".
   * Polls the container's status_code until it's ready or times out.
   */
  async _waitForContainerReady(containerId, { maxAttempts = 10, intervalMs = 3000 } = {}) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const data = await this._fetch(
          `${IG_API_BASE}/${containerId}?fields=status_code&access_token=${this.accessToken}`
        );
        const status = data.status_code;
        // status_code values: "IN_PROGRESS", "FINISHED", "ERROR"
        if (status === "FINISHED") return true;
        if (status === "ERROR") throw new Error(`Instagram media container ${containerId} processing failed`);
        // Still IN_PROGRESS — wait and retry
      } catch (err) {
        // If we can't check status, assume not ready yet
        if (err.message?.includes("processing failed")) throw err;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    // Timeout — try to publish anyway; the API will return a clear error if still not ready
    return false;
  }

  async createPost(content, mediaUrls = [], options = {}) {
    const igUserId = options.igUserId || this.igUserId;
    if (!igUserId) throw new Error("Instagram User ID required");
    if (mediaUrls.length === 0) throw new Error("Instagram requires at least one image or video");

    let containerId;
    const isCarousel = mediaUrls.length > 1;

    if (!isCarousel) {
      const url = mediaUrls[0];
      const isVideo = url.endsWith(".mp4") || url.endsWith(".mov");
      const body = { caption: content, access_token: this.accessToken };
      if (isVideo) { body.media_type = "REELS"; body.video_url = url; }
      else { body.image_url = url; }
      console.log(`[instagram createPost] Creating container for ${igUserId}, url: ${url}`);
      const res = await this._fetch(`${IG_API_BASE}/${igUserId}/media`, {
        method: "POST", body: JSON.stringify(body),
      });
      containerId = res.id;
      console.log(`[instagram createPost] Container created: ${containerId}`);
    } else {
      const itemIds = [];
      for (const url of mediaUrls) {
        const isVideo = url.endsWith(".mp4") || url.endsWith(".mov");
        const itemBody = { is_carousel_item: true, access_token: this.accessToken };
        if (isVideo) { itemBody.media_type = "VIDEO"; itemBody.video_url = url; }
        else { itemBody.image_url = url; }
        const res = await this._fetch(`${IG_API_BASE}/${igUserId}/media`, {
          method: "POST", body: JSON.stringify(itemBody),
        });
        itemIds.push(res.id);
      }
      const carouselRes = await this._fetch(`${IG_API_BASE}/${igUserId}/media`, {
        method: "POST",
        body: JSON.stringify({
          media_type: "CAROUSEL", caption: content,
          children: itemIds.join(","), access_token: this.accessToken,
        }),
      });
      containerId = carouselRes.id;
    }

    // Wait for the media container to be processed before publishing.
    // Instagram processes media asynchronously; publishing too early fails with
    // "Media ID is not available" (error code 9007).
    console.log(`[instagram createPost] Waiting for container ${containerId} to be ready...`);
    await this._waitForContainerReady(containerId);
    console.log(`[instagram createPost] Container ${containerId} ready, publishing...`);

    const publish = await this._fetch(`${IG_API_BASE}/${igUserId}/media_publish`, {
      method: "POST",
      body: JSON.stringify({ creation_id: containerId, access_token: this.accessToken }),
    });
    console.log(`[instagram createPost] Published successfully: ${publish.id}`);
    return publish.id;
  }

  async getPostMetrics(platformPostId) {
    try {
      const data = await this._fetch(
        `${IG_API_BASE}/${platformPostId}/insights?metric=likes,comments,reach,impressions,saved&access_token=${this.accessToken}`
      );
      const metrics = {};
      for (const item of data.data || []) metrics[item.name] = item.values?.[0]?.value || 0;
      return metrics;
    } catch { return {}; }
  }

  // ── Post Management ──────────────────────────────────────────────────────

  /**
   * Delete a post from Instagram.
   * Note: Instagram's Graph API does NOT support deleting published posts/media.
   * Only unpublished media containers can be deleted. Once published, a post
   * must be deleted manually from the Instagram app.
   * This method attempts deletion but returns true silently if the API rejects it
   * (since published posts simply can't be deleted via API).
   */
  async deletePost(platformPostId) {
    try {
      await this._fetch(`${IG_API_BASE}/${platformPostId}?access_token=${this.accessToken}`, {
        method: "DELETE",
      });
      return true;
    } catch (err) {
      // Instagram API doesn't support deleting published posts — silently succeed
      console.warn(`[instagram deletePost] Cannot delete via API (expected for published posts): ${err.message}`);
      return true;
    }
  }

  // ── Comments ─────────────────────────────────────────────────────────────

  async fetchComments(platformPostId) {
    const data = await this._fetch(
      `${IG_API_BASE}/${platformPostId}/comments?fields=id,text,username,timestamp,like_count,media&access_token=${this.accessToken}`
    );
    return (data.data || []).map((c) => ({
      commentId: c.id,
      authorName: c.username || "Instagram User",
      authorHandle: c.username ? `@${c.username}` : null,
      authorAvatar: null,
      text: c.text || "",
      createdAt: c.timestamp ? new Date(c.timestamp) : new Date(),
      likeCount: c.like_count || 0,
      metadata: { mediaId: c.media || null },
    }));
  }

  async replyToComment(platformPostId, commentId, text) {
    // Instagram replies are posted to the comment's /replies endpoint.
    // If commentId is null, post a top-level comment on the media.
    const endpoint = commentId
      ? `${IG_API_BASE}/${commentId}/replies`
      : `${IG_API_BASE}/${platformPostId}/comments`;
    const data = await this._fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ message: text, access_token: this.accessToken }),
    });
    return data.id;
  }

  // ── Inbox — Instagram Business DMs ───────────────────────────────────────

  async fetchConversations(since = null) {
    if (!this.igUserId) throw new Error("Instagram User ID required");
    let url = `${IG_API_BASE}/${this.igUserId}/conversations?platform=instagram&fields=id,participants{username,name,id},updated_time,snippet&access_token=${this.accessToken}`;
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
    let url = `${IG_API_BASE}/${platformConversationId}/messages?fields=id,text,from,timestamp,attachments&access_token=${this.accessToken}`;
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
    const data = await this._fetch(`${IG_API_BASE}/${this.igUserId}/messages`, {
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
