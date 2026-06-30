/**
 * /api/v1/invoice-settings
 *
 * Per-tenant invoice configuration.
 *
 * GET — fetch invoice settings for the active client (creates row with
 *       defaults on first read so the UI always has something to bind to).
 * PUT — partial update of any settings field. Validates invoice_format
 *       and clamps next_invoice_number to a positive integer.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";
import {
  DEFAULT_INVOICE_FORMAT,
  isValidInvoiceFormat,
} from "@/lib/invoiceNumber";
import {
  INVOICE_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  sanitizeTemplateConfig,
} from "@/lib/invoiceTemplates";
import { deleteThumbnailByUrl } from "@/lib/storage";

const VALID_TEMPLATE_IDS = new Set(INVOICE_TEMPLATES.map((t) => t.id));

const MAX_TAX_RATE = 100;
const MIN_TAX_RATE = 0;
const MAX_FORMAT_LENGTH = 100;
const MAX_TEXT_LENGTH = 5000;
const MAX_VARCHAR_LENGTH = 500;

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serialize(settings) {
  if (!settings) return null;
  return {
    id: settings.id,
    client_id: settings.clientId,
    company_name: settings.companyName ?? "",
    company_email: settings.companyEmail ?? "",
    company_phone: settings.companyPhone ?? "",
    company_address: settings.companyAddress ?? "",
    tax_number: settings.taxNumber ?? "",
    logo_url: settings.logoUrl ?? "",
    invoice_format: settings.invoiceFormat || DEFAULT_INVOICE_FORMAT,
    next_invoice_number: settings.nextInvoiceNumber ?? 1,
    default_currency: settings.defaultCurrency || "CAD",
    default_tax_rate: Number(settings.defaultTaxRate ?? 0),
    default_notes: settings.defaultNotes ?? "",
    template_id: settings.templateId || DEFAULT_TEMPLATE_ID,
    template_config: settings.templateConfig ?? null,
    created_at: settings.createdAt,
    updated_at: settings.updatedAt,
  };
}

async function getOrCreateSettings(prisma, clientId) {
  let settings = await prisma.wehowareInvoiceSettings.findUnique({
    where: { clientId },
  });
  if (!settings) {
    settings = await prisma.wehowareInvoiceSettings.create({
      data: { clientId },
    });
  }
  return settings;
}

// -----------------------------------------------------------------
// GET — read settings (auto-creates with defaults if missing)
// -----------------------------------------------------------------
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

      const settings = await getOrCreateSettings(prisma, clientId);
      return NextResponse.json(serialize(settings));
    } catch (err) {
      console.error("[GET /api/v1/invoice-settings] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch invoice settings" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin"], allowedClientRoles: ["client"] }
);

// -----------------------------------------------------------------
// PUT — partial update
// -----------------------------------------------------------------
function trimOrNull(value, max) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) return trimmed.slice(0, max);
  return trimmed;
}

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

      if (body.company_name !== undefined) {
        data.companyName = trimOrNull(body.company_name, 255);
      }
      if (body.company_email !== undefined) {
        data.companyEmail = trimOrNull(body.company_email, 255);
      }
      if (body.company_phone !== undefined) {
        data.companyPhone = trimOrNull(body.company_phone, 50);
      }
      if (body.company_address !== undefined) {
        data.companyAddress = trimOrNull(body.company_address, MAX_TEXT_LENGTH);
      }
      if (body.tax_number !== undefined) {
        data.taxNumber = trimOrNull(body.tax_number, 100);
      }
      if (body.logo_url !== undefined) {
        const next = trimOrNull(body.logo_url, MAX_VARCHAR_LENGTH);
        // If logo URL changes, delete the previous file (best-effort).
        const existing = await prisma.wehowareInvoiceSettings.findUnique({
          where: { clientId },
          select: { logoUrl: true },
        });
        if (existing?.logoUrl && existing.logoUrl !== next) {
          deleteThumbnailByUrl(existing.logoUrl).catch((err) =>
            console.warn(
              "[invoice-settings] failed to delete prior logo:",
              err?.message
            )
          );
        }
        data.logoUrl = next;
      }
      if (body.invoice_format !== undefined) {
        const format = String(body.invoice_format ?? "").trim();
        if (format && !isValidInvoiceFormat(format)) {
          return NextResponse.json(
            {
              error:
                "invoice_format must be 1-100 chars and contain at least one {X+} placeholder (e.g. INV-{YYYY}-{XXXX})",
            },
            { status: 400 }
          );
        }
        // If format is empty, don't update it (keep existing or use default)
        if (format) {
          data.invoiceFormat = format.slice(0, MAX_FORMAT_LENGTH);
        }
      }
      if (body.next_invoice_number !== undefined) {
        const seq = Number(body.next_invoice_number);
        if (!Number.isFinite(seq) || seq < 1 || seq > 2147483647) {
          return NextResponse.json(
            { error: "next_invoice_number must be a positive integer" },
            { status: 400 }
          );
        }
        data.nextInvoiceNumber = Math.floor(seq);
      }
      if (body.default_currency !== undefined) {
        const currency = trimOrNull(body.default_currency, 10);
        if (!currency) {
          return NextResponse.json(
            { error: "default_currency cannot be empty" },
            { status: 400 }
          );
        }
        data.defaultCurrency = currency;
      }
      if (body.default_tax_rate !== undefined) {
        const taxRate = Number(body.default_tax_rate);
        if (
          !Number.isFinite(taxRate) ||
          taxRate < MIN_TAX_RATE ||
          taxRate > MAX_TAX_RATE
        ) {
          return NextResponse.json(
            { error: `default_tax_rate must be between ${MIN_TAX_RATE} and ${MAX_TAX_RATE}` },
            { status: 400 }
          );
        }
        data.defaultTaxRate = taxRate;
      }
      if (body.default_notes !== undefined) {
        data.defaultNotes = trimOrNull(body.default_notes, MAX_TEXT_LENGTH);
      }
      if (body.template_id !== undefined) {
        const tid = String(body.template_id || "").trim();
        if (!tid || !VALID_TEMPLATE_IDS.has(tid)) {
          return NextResponse.json(
            { error: `template_id must be one of: ${[...VALID_TEMPLATE_IDS].join(", ")}` },
            { status: 400 }
          );
        }
        data.templateId = tid;
      }
      if (body.template_config !== undefined) {
        // null clears, object overrides; anything else rejects.
        if (body.template_config === null) {
          data.templateConfig = null;
        } else if (typeof body.template_config === "object") {
          data.templateConfig = sanitizeTemplateConfig(body.template_config);
        } else {
          return NextResponse.json(
            { error: "template_config must be an object or null" },
            { status: 400 }
          );
        }
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      const settings = await prisma.wehowareInvoiceSettings.upsert({
        where: { clientId },
        update: data,
        create: { clientId, ...data },
      });

      return NextResponse.json(serialize(settings));
    } catch (err) {
      console.error("[PUT /api/v1/invoice-settings] error:", err);
      return NextResponse.json(
        { error: "Failed to update invoice settings" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
