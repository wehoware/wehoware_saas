/**
 * Base social media client — all platform clients extend this.
 * Provides a common interface for publishing, media upload,
 * token refresh, metric fetching, and inbox management.
 */

export class BaseSocialClient {
  constructor(account) {
    this.accountId = account.id;
    this.platformCode = account.platform?.platformCode;
    this.accessToken = account.accessToken;
    this.refreshToken = account.refreshToken;
    this.tokenExpiresAt = account.tokenExpiresAt;
    this.profileData = account.profileData || {};
  }

  // ── Profile ─────────────────────────────────────────────────────────────

  /**
   * Fetch the current profile data from the platform.
   * @returns {{ accountName, accountHandle, profileData, followerCount }}
   */
  async getProfile() {
    throw new Error(`getProfile not implemented for ${this.platformCode}`);
  }

  // ── Publishing ──────────────────────────────────────────────────────────

  async refreshAccessToken() {
    throw new Error(`refreshAccessToken not implemented for ${this.platformCode}`);
  }

  async uploadMedia(_fileUrl, _mimeType) {
    throw new Error(`uploadMedia not implemented for ${this.platformCode}`);
  }

  async createPost(_content, _mediaIds, _options) {
    throw new Error(`createPost not implemented for ${this.platformCode}`);
  }

  async getPostMetrics(_platformPostId) {
    throw new Error(`getPostMetrics not implemented for ${this.platformCode}`);
  }

  /**
   * Delete a post from the platform.
   * @param {string} platformPostId - the platform's ID for the post
   * @returns {boolean} true if deletion succeeded
   */
  async deletePost(_platformPostId) {
    throw new Error(`deletePost not implemented for ${this.platformCode}`);
  }

  /**
   * Fetch comments on a post.
   * @param {string} platformPostId - the platform's ID for the post
   * @returns {Array<{commentId, authorName, authorHandle, authorAvatar, text, createdAt, likeCount}>}
   */
  async fetchComments(_platformPostId) {
    throw new Error(`fetchComments not implemented for ${this.platformCode}`);
  }

  /**
   * Reply to a comment on a post.
   * @param {string} platformPostId - the platform's ID for the post
   * @param {string} commentId - the comment to reply to (null = top-level comment on post)
   * @param {string} text - the reply text
   * @returns {string} the new comment's platform ID
   */
  async replyToComment(_platformPostId, _commentId, _text) {
    throw new Error(`replyToComment not implemented for ${this.platformCode}`);
  }

  // ── Inbox ───────────────────────────────────────────────────────────────

  /**
   * Fetch conversations from the platform.
   * @param {Date|null} since - only return conversations updated after this date
   * @returns {Array<{platformConversationId, participantName, participantHandle,
   *   participantAvatar, participantId, lastMessageAt, lastMessagePreview, metadata}>}
   */
  async fetchConversations(_since) {
    throw new Error(`fetchConversations not implemented for ${this.platformCode}`);
  }

  /**
   * Fetch messages for a given conversation.
   * @param {string} platformConversationId
   * @param {Date|null} since - only return messages after this date
   * @returns {Array<{platformMessageId, direction, senderName, senderHandle,
   *   senderAvatar, content, mediaUrls, sentAt, metadata}>}
   */
  async fetchMessages(_platformConversationId, _since) {
    throw new Error(`fetchMessages not implemented for ${this.platformCode}`);
  }

  /**
   * Send a reply in a conversation.
   * @param {string} platformConversationId
   * @param {string} participantId - the other party's platform user ID
   * @param {string} text
   * @returns {string} platform message ID
   */
  async sendReply(_platformConversationId, _participantId, _text) {
    throw new Error(`sendReply not implemented for ${this.platformCode}`);
  }

  // ── Shared helpers ──────────────────────────────────────────────────────

  /** Authenticated JSON fetch; throws on non-2xx with full error detail. */
  async _fetch(url, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`,
      ...options.headers,
    };
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
}
