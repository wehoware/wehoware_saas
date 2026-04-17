/**
 * /api/v1/settings/[id]
 *
 * Prisma/MySQL-backed handlers for a single setting row.
 *
 * Note: `id` is a UUID (VARCHAR 36) in the migrated schema — the old
 * handler's `isNaN(parseInt(id))` guard was a leftover from an integer
 * schema and is intentionally dropped here.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

function toLegacy(row) {
  if (!row) return row;
  return {
    id: row.id,
    client_id: row.clientId,
    setting_key: row.settingKey,
    setting_value: row.settingValue,
    setting_group: row.settingGroup,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function resolveAllowedClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

/**
 * Fetch the setting and authorize it against the caller's tenant.
 * Returns { status, body, data } where `status` is 2xx on success.
 */
async function loadAndAuthorize(prisma, user, id) {
  if (!id) {
    return { status: 400, body: { error: "Setting ID is required." } };
  }
  const row = await prisma.wehowareSetting.findUnique({ where: { id } });
  if (!row) {
    return { status: 404, body: { error: "Setting not found." } };
  }
  const allowedClient = resolveAllowedClientId(user);
  if (!allowedClient || row.clientId !== allowedClient) {
    return {
      status: 403,
      body: {
        error: "Forbidden: You do not have permission to access this setting.",
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
      return NextResponse.json({ data: toLegacy(data) });
    } catch (err) {
      console.error("[GET /api/v1/settings/[id]] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT
// -------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const body = await request.json();

      if (body?.setting_value === undefined || body.setting_value === null) {
        return NextResponse.json(
          { error: "Setting value (setting_value) is required." },
          { status: 400 }
        );
      }

      const auth = await loadAndAuthorize(prisma, user, id);
      if (auth.status !== 200) {
        return NextResponse.json(auth.body, { status: auth.status });
      }

      const data = {
        settingValue: String(body.setting_value),
      };
      if (body.setting_group !== undefined) {
        data.settingGroup = body.setting_group;
      }

      const updated = await prisma.wehowareSetting.update({
        where: { id },
        data,
      });

      return NextResponse.json({ data: toLegacy(updated) });
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      console.error("[PUT /api/v1/settings/[id]] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
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

      await prisma.wehowareSetting.delete({ where: { id } });
      return NextResponse.json({ message: "Setting deleted successfully." });
    } catch (err) {
      console.error("[DELETE /api/v1/settings/[id]] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
