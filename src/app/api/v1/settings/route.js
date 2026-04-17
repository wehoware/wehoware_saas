/**
 * /api/v1/settings
 *
 * Prisma/MySQL-backed replacement for the old Supabase handler.
 *
 * GET  — list settings for the caller's active client (filters, pagination, formats)
 * POST — upsert settings (single, batch array, or keyValues object)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const SORTABLE_FIELDS = new Set([
  "setting_key",
  "setting_group",
  "created_at",
  "updated_at",
]);
const FIELD_MAP = {
  setting_key: "settingKey",
  setting_group: "settingGroup",
  created_at: "createdAt",
  updated_at: "updatedAt",
};

function resolveClientIdForRead(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function resolveClientIdForWrite(user, body) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return body?.client_id || user.activeClientId || null;
  }
  return null;
}

// Map Prisma row (camelCase) back to legacy snake_case response shape
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

// -------------------------------------------------------------------
// GET /api/v1/settings
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientIdForRead(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required for employee/admin." },
          { status: 400 }
        );
      }

      const url = new URL(request.url);
      const group = url.searchParams.get("group");
      const keys = url.searchParams.get("keys");
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
      const sortByRaw = url.searchParams.get("sortBy") || "setting_key";
      const sortOrder =
        url.searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
      const sortBy = SORTABLE_FIELDS.has(sortByRaw)
        ? FIELD_MAP[sortByRaw]
        : "settingKey";

      const where = { clientId };
      if (group) where.settingGroup = group;
      if (keys) {
        const keyArray = keys
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
        if (keyArray.length > 0) {
          where.settingKey = { in: keyArray };
        }
      }

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
          orderBy: { [sortBy]: sortOrder },
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
      console.error("[GET /api/v1/settings] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// POST /api/v1/settings  (upsert single / batch / keyValues)
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const body = await request.json();

      const clientId = resolveClientIdForWrite(user, body);
      if (!clientId) {
        return NextResponse.json(
          {
            error:
              "Client ID must be provided in the request body for employee/admin updates.",
          },
          { status: 400 }
        );
      }

      let settingsToUpdate = [];
      const defaultGroup = "general";

      if (Array.isArray(body.settings)) {
        settingsToUpdate = body.settings
          .map((s) => ({
            settingKey: s.setting_key,
            settingValue: String(s.setting_value ?? ""),
            settingGroup: s.setting_group || defaultGroup,
          }))
          .filter((s) => s.settingKey);
      } else if (body.setting_key) {
        settingsToUpdate = [
          {
            settingKey: body.setting_key,
            settingValue: String(body.setting_value ?? ""),
            settingGroup: body.setting_group || defaultGroup,
          },
        ];
      } else if (body.keyValues && typeof body.keyValues === "object") {
        const group = body.group || defaultGroup;
        settingsToUpdate = Object.entries(body.keyValues).map(
          ([key, value]) => ({
            settingKey: key,
            settingValue: String(value ?? ""),
            settingGroup: group,
          })
        );
      } else {
        return NextResponse.json(
          {
            error:
              "Invalid request format. Provide `settings` array, single setting fields (`setting_key`, etc.), or `keyValues` object.",
          },
          { status: 400 }
        );
      }

      if (settingsToUpdate.length === 0) {
        return NextResponse.json(
          { warning: "No valid settings to update were provided." },
          { status: 400 }
        );
      }
      if (settingsToUpdate.some((s) => !s.settingKey)) {
        return NextResponse.json(
          {
            error:
              "One or more settings are missing the required `setting_key`.",
          },
          { status: 400 }
        );
      }

      const results = await Promise.all(
        settingsToUpdate.map((s) =>
          prisma.wehowareSetting.upsert({
            where: {
              clientId_settingKey: {
                clientId,
                settingKey: s.settingKey,
              },
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

      return NextResponse.json(
        { data: results.map(toLegacy) },
        { status: 200 }
      );
    } catch (err) {
      console.error("[POST /api/v1/settings] error:", err);
      return NextResponse.json(
        { error: `An unexpected error occurred: ${err.message}` },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
