/**
 * /api/v1/seo/settings
 *
 * Prisma/MySQL-backed handler. Thin wrapper over wehoware_settings with a
 * default group of `seo_global`. Use /api/v1/settings for the generic API.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

const DEFAULT_GROUP = "seo_global";

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

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required for employee/admin." },
          { status: 400 }
        );
      }

      const url = new URL(request.url);
      const group = url.searchParams.get("group");
      const key = url.searchParams.get("key");
      const format = url.searchParams.get("format");

      const where = { clientId };
      if (group) where.settingGroup = group;
      if (key) where.settingKey = key;

      const rows = await prisma.wehowareSetting.findMany({ where });

      if (format === "keyValue") {
        const keyValueFormat = {};
        for (const r of rows) {
          keyValueFormat[r.settingKey] = r.settingValue;
        }
        return NextResponse.json({ data: keyValueFormat });
      }

      return NextResponse.json({ data: rows.map(toLegacy) });
    } catch (err) {
      console.error("[GET /api/v1/seo/settings] error:", err);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// POST  — upsert single or batch
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const body = await request.json();

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required for employee/admin." },
          { status: 400 }
        );
      }

      let toUpsert = [];

      if (Array.isArray(body?.settings)) {
        for (const s of body.settings) {
          if (!s?.setting_key || s.setting_value === undefined) {
            return NextResponse.json(
              {
                error:
                  "Each setting in the batch must have setting_key and setting_value.",
              },
              { status: 400 }
            );
          }
          toUpsert.push({
            settingKey: s.setting_key,
            settingValue: String(s.setting_value ?? ""),
            settingGroup: s.setting_group || DEFAULT_GROUP,
          });
        }
      } else if (body?.setting_key && body.setting_value !== undefined) {
        toUpsert.push({
          settingKey: body.setting_key,
          settingValue: String(body.setting_value ?? ""),
          settingGroup: body.setting_group || DEFAULT_GROUP,
        });
      } else {
        return NextResponse.json(
          {
            error:
              "Invalid request format. Provide either a settings array or a single setting object with setting_key and setting_value.",
          },
          { status: 400 }
        );
      }

      if (toUpsert.length === 0) {
        return NextResponse.json(
          { error: "No valid settings provided for update." },
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
      console.error("[POST /api/v1/seo/settings] error:", err);
      return NextResponse.json(
        { error: `An unexpected error occurred: ${err.message}` },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
