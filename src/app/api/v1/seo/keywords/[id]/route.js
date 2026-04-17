/**
 * /api/v1/seo/keywords/[id]
 *
 * Prisma/MySQL-backed handler for a single wehoware_client_keywords row.
 * Access rules: admins get full access within the active client; employees
 * can only read/delete their own row.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

function serialize(r) {
  return {
    id: r.id,
    client_id: r.clientId,
    employee_id: r.employeeId,
    keywords: r.keywords,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

async function loadAndAuthorize(prisma, user, id) {
  if (!id) {
    return { status: 400, body: { error: "Keywords ID is required" } };
  }
  const activeClientId = user.activeClientId;
  if (!activeClientId) {
    return { status: 400, body: { error: "Active client context required." } };
  }

  const row = await prisma.wehowareClientKeyword.findUnique({
    where: { id },
  });
  if (!row) {
    return {
      status: 404,
      body: { error: "Keywords record not found or not accessible." },
    };
  }
  if (row.clientId !== activeClientId) {
    return {
      status: 403,
      body: {
        error: "Forbidden: Record does not belong to your active client context.",
      },
    };
  }
  if (user.role !== "admin" && row.employeeId !== user.id) {
    return {
      status: 403,
      body: {
        error:
          "Forbidden: You do not have permission to access this keywords record.",
      },
    };
  }
  return { status: 200, data: row };
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const { status, body, data } = await loadAndAuthorize(prisma, user, id);
      if (status !== 200) return NextResponse.json(body, { status });
      return NextResponse.json({ data: serialize(data) });
    } catch (err) {
      console.error("[GET /api/v1/seo/keywords/[id]] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const auth = await loadAndAuthorize(prisma, user, id);
      if (auth.status !== 200) {
        return NextResponse.json(auth.body, { status: auth.status });
      }
      await prisma.wehowareClientKeyword.delete({ where: { id } });
      return NextResponse.json({
        message: "Keywords record deleted successfully",
      });
    } catch (err) {
      console.error("[DELETE /api/v1/seo/keywords/[id]] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
