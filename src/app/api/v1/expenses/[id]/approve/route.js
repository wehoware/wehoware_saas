/**
 * /api/v1/expenses/[id]/approve
 *
 * POST — admin-only endpoint that transitions an expense's status.
 *        Body: { action: "approve" | "reject" | "reimburse", reason?: string }
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

const VALID_ACTIONS = new Set(["approve", "reject", "reimburse"]);

function resolveClientId(user) {
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }

      const action = body?.action;
      if (!action || !VALID_ACTIONS.has(action)) {
        return NextResponse.json(
          {
            error: `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(", ")}`,
          },
          { status: 400 }
        );
      }

      const existing = await prisma.wehowareExpense.findFirst({
        where: { id, clientId },
        select: { id: true, status: true, submittedBy: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Expense not found" },
          { status: 404 }
        );
      }

      // Submitter cannot approve/reject their own expense.
      if (action !== "reimburse" && existing.submittedBy === user.id) {
        return NextResponse.json(
          { error: "You cannot approve or reject your own expense" },
          { status: 403 }
        );
      }

      let newStatus;
      const data = { approvedBy: user.id, approvedAt: new Date() };
      if (action === "approve") {
        if (existing.status !== "Pending") {
          return NextResponse.json(
            { error: "Only Pending expenses can be approved" },
            { status: 400 }
          );
        }
        newStatus = "Approved";
        data.rejectedReason = null;
      } else if (action === "reject") {
        if (existing.status !== "Pending") {
          return NextResponse.json(
            { error: "Only Pending expenses can be rejected" },
            { status: 400 }
          );
        }
        const reason =
          typeof body.reason === "string" ? body.reason.trim() : "";
        if (!reason) {
          return NextResponse.json(
            { error: "reason is required when rejecting" },
            { status: 400 }
          );
        }
        newStatus = "Rejected";
        data.rejectedReason = reason;
      } else {
        // reimburse
        if (existing.status !== "Approved") {
          return NextResponse.json(
            { error: "Only Approved expenses can be marked Reimbursed" },
            { status: 400 }
          );
        }
        newStatus = "Reimbursed";
        data.reimbursedAt = new Date();
      }
      data.status = newStatus;

      const updated = await prisma.wehowareExpense.update({
        where: { id },
        data,
        include: {
          submitter: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          approver: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        status: updated.status,
        approved_by: updated.approvedBy,
        approved_at: updated.approvedAt,
        reimbursed_at: updated.reimbursedAt,
        rejected_reason: updated.rejectedReason,
      });
    } catch (err) {
      console.error("[POST /api/v1/expenses/[id]/approve] error:", err);
      return NextResponse.json(
        { error: "Failed to update expense status" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
