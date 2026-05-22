/**
 * Base social media client — all platform clients extend this.
 * Provides a common interface for publishing, media upload,
 * token refresh, and metric fetching.
 */

export const PLATFORM_CHAR_LIMITS = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  tiktok: 2200,
};

export class BaseSocialClient {
  constructor(account) {
    this.accountId = account.id;
    this.platformCode = account.platform?.platformCode;
    this.accessToken = account.accessToken;
    this.refreshToken = account.refreshToken;
    this.tokenExpiresAt = account.tokenExpiresAt;
  }

  /** Override in platform subclass: exchange refresh token for new access token */
  async refreshAccessToken() {
    throw new Error(`refreshAccessToken not implemented for ${this.platformCode}`);
  }

  /** Override in platform subclass: upload media, return platform media ID */
  async uploadMedia(_fileUrl, _mimeType) {
    throw new Error(`uploadMedia not implemented for ${this.platformCode}`);
  }

  /** Override in platform subclass: publish a post, return platform post ID */
  async createPost(_content, _mediaIds, _options) {
    throw new Error(`createPost not implemented for ${this.platformCode}`);
  }

  /** Override in platform subclass: fetch engagement metrics for a post */
  async getPostMetrics(_platformPostId) {
    throw new Error(`getPostMetrics not implemented for ${this.platformCode}`);
  }

  /** Shared: make authenticated fetch with Authorization header */
  async _fetch(url, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`,
      ...(options.headers || {}),
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
