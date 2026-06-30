/**
 * /api/v1/accounting-settings
 *
 * GET — fetch accounting settings for active client (auto-creates default)
 * PUT — update accounting settings
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

const ALLOWED_FORMAT_TOKENS = ["{YYYY}", "{MM}", "{XXXX}", "{XXX}", "{XXXXX}"];
const MIN_NEXT_NUMBER = 1;
const MAX_NEXT_NUMBER = 999999;

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serializeSettings(s) {
  return {
    id: s.id,
    client_id: s.clientId,
    default_currency: s.defaultCurrency,
    default_tax_rate: s.defaultTaxRate,
    fiscal_year_start: s.fiscalYearStart,
    bill_number_format: s.billNumberFormat,
    next_bill_number: s.nextBillNumber,
    expense_categories_json: s.expenseCategoriesJson,
    reminder_enabled: s.reminderEnabled,
    reminder_days_before: s.reminderDaysBefore,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }
      let settings = await prisma.wehowareAccountingSettings.findUnique({
        where: { clientId },
      });
      if (!settings) {
        settings = await prisma.wehowareAccountingSettings.create({
          data: { clientId },
        });
      }
      return NextResponse.json(serializeSettings(settings));
    } catch (err) {
      console.error("[GET /api/v1/accounting-settings] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch accounting settings" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "client"], allowedClientRoles: ["client"] }
);

export const PUT = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
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

      const data = {};
      if (body.default_currency !== undefined) {
        data.defaultCurrency = String(body.default_currency).slice(0, 10);
      }
      if (body.default_tax_rate !== undefined) {
        const rate = Number(body.default_tax_rate);
        if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
          return NextResponse.json(
            { error: "default_tax_rate must be 0–100" },
            { status: 400 }
          );
        }
        data.defaultTaxRate = rate;
      }
      if (body.fiscal_year_start !== undefined) {
        const month = Number(body.fiscal_year_start);
        if (!Number.isInteger(month) || month < 1 || month > 12) {
          return NextResponse.json(
            { error: "fiscal_year_start must be 1–12" },
            { status: 400 }
          );
        }
        data.fiscalYearStart = month;
      }
      if (body.bill_number_format !== undefined) {
        const fmt = String(body.bill_number_format).trim();
        if (!fmt) {
          return NextResponse.json(
            { error: "bill_number_format cannot be empty" },
            { status: 400 }
          );
        }
        const hasSequenceToken = /\{X+\}/.test(fmt);
        if (!hasSequenceToken) {
          return NextResponse.json(
            { error: "bill_number_format must contain {XXXX} for sequence" },
            { status: 400 }
          );
        }
        data.billNumberFormat = fmt;
      }
      if (body.next_bill_number !== undefined) {
        const next = Number(body.next_bill_number);
        if (
          !Number.isInteger(next) ||
          next < MIN_NEXT_NUMBER ||
          next > MAX_NEXT_NUMBER
        ) {
          return NextResponse.json(
            {
              error: `next_bill_number must be ${MIN_NEXT_NUMBER}–${MAX_NEXT_NUMBER}`,
            },
            { status: 400 }
          );
        }
        data.nextBillNumber = next;
      }
      if (body.reminder_enabled !== undefined) {
        data.reminderEnabled = Boolean(body.reminder_enabled);
      }
      if (body.reminder_days_before !== undefined) {
        const days = Number(body.reminder_days_before);
        if (!Number.isInteger(days) || days < 0 || days > 90) {
          return NextResponse.json(
            { error: "reminder_days_before must be 0–90" },
            { status: 400 }
          );
        }
        data.reminderDaysBefore = days;
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      const settings = await prisma.wehowareAccountingSettings.upsert({
        where: { clientId },
        update: data,
        create: { clientId, ...data },
      });

      return NextResponse.json(serializeSettings(settings));
    } catch (err) {
      console.error("[PUT /api/v1/accounting-settings] error:", err);
      return NextResponse.json(
        { error: "Failed to update accounting settings" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
