/**
 * Shared server-side utilities for social media API routes.
 * These functions require Prisma post objects with specific includes.
 */

/**
 * Shape a Prisma WehowareSocialPost into a consistent JSON response object.
 * @param {object} p - Prisma post record (must include accountPosts.account.platform)
 * @returns {object}
 */
export function shapePost(p) {
  return {
    id: p.id,
    client_id: p.clientId,
    title: p.title,
    content: p.content,
    media_urls: p.mediaUrls,
    hashtags: p.hashtags,
    scheduled_for: p.scheduledFor,
    published_at: p.publishedAt,
    status: p.status,
    post_type: p.postType,
    target_accounts: p.targetAccounts,
    publish_results: p.publishResults,
    error_details: p.errorDetails,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    created_by: p.createdBy,
    platforms: (p.accountPosts || [])
      .map((ap) => ap.account?.platform?.platformCode)
      .filter(Boolean),
    account_posts: (p.accountPosts || []).map((ap) => ({
      id: ap.id,
      account_id: ap.accountId,
      platform_post_id: ap.platformPostId,
      platform_url: ap.platformUrl,
      status: ap.status,
      published_at: ap.publishedAt,
      error_details: ap.errorDetails,
      metrics: ap.metrics,
      account: ap.account
        ? {
            id: ap.account.id,
            account_name: ap.account.accountName,
            platform: ap.account.platform,
          }
        : null,
    })),
  };
}

/**
 * Standard include for Prisma post queries to ensure shapePost has all data.
 */
export const POST_INCLUDE = {
  accountPosts: {
    include: {
      account: {
        include: {
          platform: {
            select: { id: true, name: true, platformCode: true, logoUrl: true },
          },
        },
      },
    },
  },
};
