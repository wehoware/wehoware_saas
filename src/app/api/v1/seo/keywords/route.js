/**
 * /api/v1/seo/keywords
 *
 * Prisma/MySQL-backed handler. Keywords are stored one row per
 * (client_id, employee_id) pair in wehoware_client_keywords — this route
 * returns / upserts the row belonging to the caller's active client context
 * and the caller themselves.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

function serialize(r) {
  return {
    id: r.id,
    client_id: r.clientId,
    employee_id: r.employeeId,
    keywords: r.keywords,
    sections: r.keywords?.sections ?? [],
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = user.activeClientId;
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required." },
          { status: 400 }
        );
      }

      const row = await prisma.wehowareClientKeyword.findUnique({
        where: {
          clientId_employeeId: { clientId, employeeId: user.id },
        },
      });

      if (row) {
        return NextResponse.json({ data: serialize(row) });
      }
      // No row yet — return an empty skeleton so the UI can start fresh.
      return NextResponse.json({
        data: {
          client_id: clientId,
          employee_id: user.id,
          sections: [],
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/seo/keywords] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);

// -------------------------------------------------------------------
// POST  — upsert
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const body = await request.json();

      if (!Array.isArray(body?.sections)) {
        return NextResponse.json(
          { error: "Sections array is required and must be an array." },
          { status: 400 }
        );
      }

      const clientId = user.activeClientId;
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required." },
          { status: 400 }
        );
      }

      const keywords = { sections: body.sections };

      const existing = await prisma.wehowareClientKeyword.findUnique({
        where: {
          clientId_employeeId: { clientId, employeeId: user.id },
        },
        select: { id: true },
      });

      const upserted = await prisma.wehowareClientKeyword.upsert({
        where: {
          clientId_employeeId: { clientId, employeeId: user.id },
        },
        update: { keywords },
        create: { clientId, employeeId: user.id, keywords },
      });

      return NextResponse.json(
        { data: serialize(upserted) },
        { status: existing ? 200 : 201 }
      );
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      console.error("[POST /api/v1/seo/keywords] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
