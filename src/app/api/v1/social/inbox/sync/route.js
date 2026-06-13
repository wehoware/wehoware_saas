/**
 * POST /api/v1/social/inbox/sync
 * Triggers a full inbox sync for all active accounts of the current client.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";
import { syncAllInboxes } from "@/lib/social-inbox-sync";

export const POST = withAuth(
  async (request) => {
    try {
      const { user } = request;
      const clientId = user.activeClientId || user.clientId;
      if (!clientId) return NextResponse.json({ error: "No active client" }, { status: 400 });

      const results = await syncAllInboxes(clientId);

      const totalConversations = results.reduce((s, r) => s + (r.conversationsSynced || 0), 0);
      const totalMessages = results.reduce((s, r) => s + (r.messagesSynced || 0), 0);
      const totalErrors = results.flatMap((r) => r.errors || []);

      return NextResponse.json({
        success: true,
        accounts_synced: results.length,
        conversations_synced: totalConversations,
        messages_synced: totalMessages,
        errors: totalErrors,
        results,
      });
    } catch (err) {
      console.error("[POST /api/v1/social/inbox/sync]", err);
      return NextResponse.json({ error: "Inbox sync failed" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
