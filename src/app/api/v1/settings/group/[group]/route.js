/**
 * /api/v1/settings/group/[group]
 *
 * Prisma/MySQL-backed handlers for settings scoped to a named group.
 *
 *  - GET     — list settings in the group (default paginated OR keyValue map)
 *  - PUT     — bulk upsert settings in the group
 *  - DELETE  — delete every setting in the group for the caller's client
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

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

function resolveReadClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function resolveWriteClientId(user, body) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return body?.client_id || user.activeClientId || null;
  }
  return null;
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { group } = await params;
      if (!group) {
        return NextResponse.json(
          { error: "Group name parameter is required." },
          { status: 400 }
        );
      }

      const clientId = resolveReadClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required for employee/admin." },
          { status: 400 }
        );
      }

      const url = new URL(request.url);
      const format = url.searchParams.get("format") || "default";
      const page = Math.max(
        1,
        parseInt(url.searchParams.get("page") || "1", 10)
      );
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(
          1,
          parseInt(
            url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE),
            10
          )
        )
      );

      const where = { clientId, settingGroup: group };

      if (format === "keyValue") {
        const rows = await prisma.wehowareSetting.findMany({ where });
        const keyValueFormat = {};
        for (const r of rows) {
          keyValueFormat[r.settingKey] = r.settingValue;
        }
        return NextResponse.json({ data: keyValueFormat });
      }

      const [items, totalItems] = await Promise.all([
        prisma.wehowareSetting.findMany({
          where,
          orderBy: { settingKey: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareSetting.count({ where }),
      ]);

      return NextResponse.json({
        data: items.map(toLegacy),
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/settings/group/[group]] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT  (bulk upsert)
// -------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { group } = await params;
      if (!group) {
        return NextResponse.json(
          { error: "Group name parameter is required." },
          { status: 400 }
        );
      }

      const body = await request.json();
      if (!body?.settings && !body?.keyValues) {
        return NextResponse.json(
          {
            error:
              "Invalid request format. Provide `settings` array or `keyValues` object.",
          },
          { status: 400 }
        );
      }

      const clientId = resolveWriteClientId(user, body);
      if (!clientId) {
        return NextResponse.json(
          {
            error:
              "Client ID must be provided in the request body for employee/admin updates.",
          },
          { status: 400 }
        );
      }

      let toUpsert = [];
      if (Array.isArray(body.settings)) {
        toUpsert = body.settings
          .map((s) => ({
            settingKey: s.setting_key,
            settingValue: String(s.setting_value ?? ""),
            settingGroup: group,
          }))
          .filter((s) => s.settingKey);
      } else if (body.keyValues && typeof body.keyValues === "object") {
        toUpsert = Object.entries(body.keyValues).map(([key, value]) => ({
          settingKey: key,
          settingValue: String(value ?? ""),
          settingGroup: group,
        }));
      }

      if (toUpsert.length === 0) {
        return NextResponse.json(
          { warning: "No valid settings to update were provided." },
          { status: 400 }
        );
      }
      if (toUpsert.some((s) => !s.settingKey)) {
        return NextResponse.json(
          {
            error:
              "One or more settings are missing the required `setting_key`.",
          },
          { status: 400 }
        );
      }

      const results = await Promise.all(
        toUpsert.map((s) =>
          prisma.wehowareSetting.upsert({
            where: {
              clientId_settingKey: { clientId, settingKey: s.settingKey },
            },
            update: {
              settingValue: s.settingValue,
              settingGroup: s.settingGroup,
            },
            create: {
              clientId,
              settingKey: s.settingKey,
              settingValue: s.settingValue,
              settingGroup: s.settingGroup,
            },
          })
        )
      );

      return NextResponse.json({ data: results.map(toLegacy) });
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      console.error("[PUT /api/v1/settings/group/[group]] error:", err);
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
      const { group } = await params;
      if (!group) {
        return NextResponse.json(
          { error: "Group name parameter is required." },
          { status: 400 }
        );
      }

      const clientId = resolveReadClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required for employee/admin." },
          { status: 400 }
        );
      }

      const result = await prisma.wehowareSetting.deleteMany({
        where: { clientId, settingGroup: group },
      });

      return NextResponse.json({
        message: `Successfully deleted settings in group: ${group}`,
        deleted: result.count,
      });
    } catch (err) {
      console.error("[DELETE /api/v1/settings/group/[group]] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
