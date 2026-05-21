"use client";

/**
 * InvoiceTemplate - universal config-driven invoice renderer.
 * Used by view page, print page, and settings preview.
 */
import React from "react";
import { formatInvoiceDate } from "@/lib/invoiceFormat";
import { TEMPLATE_LAYOUTS, TABLE_STYLES, resolveTemplateConfig } from "@/lib/invoiceTemplates";

const SPACING = {
  compact: { section: 16, cell: 8 },
  normal: { section: 24, cell: 12 },
  relaxed: { section: 36, cell: 16 },
};

const PLACEHOLDER = "\u2014";
const DARK_BG_HEX = ["#000000", "#0f3057", "#7c3aed"];

const safe = (v, fb = PLACEHOLDER) => (v == null || v === "" ? fb : v);
const fmtAmount = (n, currency = "") =>
  `${currency} ${Number(n || 0).toFixed(2)}`.trim();

function CompanyBlock({ settings, config, align = "left", inverted = false }) {
  const textColor = inverted ? config.colors.headerText : config.colors.text;
  const mutedColor = inverted ? config.colors.headerText : config.colors.textMuted;
  const opacity = inverted ? 0.85 : 1;

  return (
    <div style={{ textAlign: align }}>
      {settings?.company_name ? (
        <div style={{ fontSize: 18, fontWeight: 700, color: textColor }}>
          {settings.company_name}
        </div>
      ) : null}
      {settings?.company_address ? (
        <div
          style={{
            fontSize: 11,
            color: mutedColor,
            whiteSpace: "pre-line",
            marginTop: 4,
            opacity,
          }}
        >
          {settings.company_address}
        </div>
      ) : null}
      {settings?.company_email || settings?.company_phone ? (
        <div style={{ fontSize: 11, color: mutedColor, marginTop: 2, opacity }}>
          {settings.company_email}
          {settings.company_email && settings.company_phone ? " \u00B7 " : ""}
          {settings.company_phone}
        </div>
      ) : null}
      {settings?.tax_number ? (
        <div style={{ fontSize: 11, color: mutedColor, marginTop: 2, opacity }}>
          Tax #: {settings.tax_number}
        </div>
      ) : null}
    </div>
  );
}

function Logo({ settings, config, size = 64, inverted = false }) {
  if (!config.layout.showLogo || !settings?.logo_url) return null;
  return (
    <img
      src={settings.logo_url}
      alt={settings.company_name || "Company logo"}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        background: inverted ? "#ffffff" : "transparent",
        borderRadius: 8,
        padding: inverted ? 4 : 0,
      }}
    />
  );
}

function InvoiceTitleBlock({ invoice, config, fontSize = 28, inverted = false }) {
  const { layout, colors } = config;
  const color = inverted ? colors.headerText : colors.primary;
  return (
    <div style={{ textAlign: "right" }}>
      <div
        style={{
          fontFamily: config.fonts.heading,
          fontSize,
          fontWeight: 800,
          letterSpacing: layout.uppercaseHeading ? 2 : 0,
          textTransform: layout.uppercaseHeading ? "uppercase" : "none",
          color,
          lineHeight: 1.1,
        }}
      >
        INVOICE
      </div>
      <div style={{ fontSize: 13, color, opacity: 0.85, marginTop: 4 }}>
        #{safe(invoice.invoice_number)}
      </div>
    </div>
  );
}

function InvoiceHeader({ invoice, settings, config }) {
  const { colors, layout } = config;
  const style = layout.headerStyle;

  if (style === TEMPLATE_LAYOUTS.HEADER_BANNER) {
    return (
      <div
        style={{
          background: colors.headerBg,
          color: colors.headerText,
          padding: "32px 40px",
          borderRadius: `${layout.cornerRadius} ${layout.cornerRadius} 0 0`,
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <Logo settings={settings} config={config} inverted />
          <CompanyBlock settings={settings} config={config} inverted />
        </div>
        <InvoiceTitleBlock invoice={invoice} config={config} fontSize={32} inverted />
      </div>
    );
  }

  if (style === TEMPLATE_LAYOUTS.HEADER_CENTERED) {
    return (
      <div
        style={{
          padding: "40px 40px 24px",
          textAlign: "center",
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {layout.showLogo && settings?.logo_url ? (
          <div style={{ marginBottom: 16 }}>
            <Logo settings={settings} config={config} size={72} />
          </div>
        ) : null}
        <CompanyBlock settings={settings} config={config} align="center" />
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontFamily: config.fonts.heading,
              fontSize: 36,
              fontWeight: 800,
              color: colors.primary,
              letterSpacing: layout.uppercaseHeading ? 2 : 0,
              textTransform: layout.uppercaseHeading ? "uppercase" : "none",
            }}
          >
            INVOICE
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
            #{safe(invoice.invoice_number)}
          </div>
        </div>
      </div>
    );
  }

  if (style === TEMPLATE_LAYOUTS.HEADER_SPLIT) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        <div
          style={{
            flex: "1 1 60%",
            padding: "32px 40px",
            background: colors.headerBg,
            color: colors.headerText,
            borderRadius: `${layout.cornerRadius} 0 0 0`,
            minWidth: 280,
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <Logo settings={settings} config={config} inverted />
            <CompanyBlock settings={settings} config={config} inverted />
          </div>
        </div>
        <div
          style={{
            flex: "1 1 40%",
            padding: "32px 40px",
            background: colors.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            borderRadius: `0 ${layout.cornerRadius} 0 0`,
            minWidth: 200,
          }}
        >
          <InvoiceTitleBlock invoice={invoice} config={config} fontSize={36} />
        </div>
      </div>
    );
  }

  if (style === TEMPLATE_LAYOUTS.HEADER_SIDEBAR) {
    return (
      <div
        style={{
          position: "relative",
          padding: "32px 40px 32px 56px",
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 16,
            background: colors.primary,
            borderRadius: `${layout.cornerRadius} 0 0 0`,
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <Logo settings={settings} config={config} />
            <CompanyBlock settings={settings} config={config} />
          </div>
          <InvoiceTitleBlock invoice={invoice} config={config} fontSize={32} />
        </div>
      </div>
    );
  }

  // HEADER_MINIMAL (default)
  return (
    <div
      style={{
        padding: "32px 40px 24px",
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <Logo settings={settings} config={config} size={56} />
          <CompanyBlock settings={settings} config={config} />
        </div>
        <InvoiceTitleBlock invoice={invoice} config={config} fontSize={28} />
      </div>
      {layout.accentBar ? (
        <div
          style={{
            marginTop: 24,
            height: 4,
            background: colors.primary,
            borderRadius: 2,
          }}
        />
      ) : null}
    </div>
  );
}

function InvoiceMeta({ invoice, config }) {
  const { colors } = config;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 32,
        padding: "24px 40px",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: colors.textMuted,
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Billed To
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>
          {safe(invoice.client_name)}
        </div>
        {invoice.client_email ? (
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            {invoice.client_email}
          </div>
        ) : null}
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: colors.textMuted,
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Invoice Details
        </div>
        <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
          <div>Invoice #: {safe(invoice.invoice_number)}</div>
          <div>Issue Date: {formatInvoiceDate(invoice.invoice_date)}</div>
          <div>Due Date: {formatInvoiceDate(invoice.due_date)}</div>
          <div>Status: {safe(invoice.status)}</div>
        </div>
      </div>
    </div>
  );
}

function getTableStyles(config) {
  const { colors, layout } = config;
  const cellPad = SPACING[layout.spacing]?.cell ?? SPACING.normal.cell;
  const baseTh = {
    padding: `${cellPad}px 12px`,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "left",
  };
  const baseTd = {
    padding: `${cellPad}px 12px`,
    fontSize: 13,
    color: colors.text,
  };

  if (layout.tableStyle === TABLE_STYLES.MODERN) {
    return {
      table: { width: "100%", borderCollapse: "collapse" },
      thead: { background: colors.tableHeaderBg, color: colors.tableHeaderText },
      th: baseTh,
      td: { ...baseTd, borderBottom: `1px solid ${colors.border}` },
      striped: false,
    };
  }
  if (layout.tableStyle === TABLE_STYLES.BORDERED) {
    return {
      table: {
        width: "100%",
        borderCollapse: "collapse",
        border: `1px solid ${colors.border}`,
      },
      thead: { background: colors.tableHeaderBg, color: colors.tableHeaderText },
      th: { ...baseTh, borderBottom: `2px solid ${colors.border}`, borderRight: `1px solid ${colors.border}` },
      td: { ...baseTd, border: `1px solid ${colors.border}` },
      striped: false,
    };
  }
  if (layout.tableStyle === TABLE_STYLES.MINIMAL) {
    return {
      table: { width: "100%", borderCollapse: "collapse" },
      thead: {
        borderBottom: `2px solid ${colors.border}`,
        color: colors.textMuted,
      },
      th: baseTh,
      td: { ...baseTd, borderBottom: `1px solid ${colors.border}` },
      striped: false,
    };
  }
  // STRIPED (default)
  return {
    table: { width: "100%", borderCollapse: "collapse" },
    thead: { background: colors.tableHeaderBg, color: colors.tableHeaderText },
    th: baseTh,
    td: { ...baseTd, borderBottom: `1px solid ${colors.border}` },
    striped: true,
  };
}

function LineItemsTable({ invoice, config }) {
  const styles = getTableStyles(config);
  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];

  return (
    <div style={{ padding: "0 40px", marginTop: 16 }}>
      <table style={styles.table}>
        <thead style={styles.thead}>
          <tr>
            <th style={styles.th}>Description</th>
            <th style={{ ...styles.th, width: 80, textAlign: "right" }}>Qty</th>
            <th style={{ ...styles.th, width: 120, textAlign: "right" }}>Unit Price</th>
            <th style={{ ...styles.th, width: 120, textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                style={{
                  ...styles.td,
                  textAlign: "center",
                  color: config.colors.textMuted,
                  padding: 32,
                }}
              >
                No line items
              </td>
            </tr>
          ) : (
            items.map((item, idx) => (
              <tr
                key={item.id || idx}
                style={
                  styles.striped && idx % 2 === 1
                    ? { background: config.colors.accent }
                    : undefined
                }
              >
                <td style={styles.td}>{safe(item.description)}</td>
                <td style={{ ...styles.td, textAlign: "right" }}>
                  {Number(item.quantity || 0)}
                </td>
                <td style={{ ...styles.td, textAlign: "right" }}>
                  {fmtAmount(item.unit_price, invoice.currency)}
                </td>
                <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>
                  {fmtAmount(item.total, invoice.currency)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Totals({ invoice, config }) {
  const { colors, layout } = config;
  const isDarkTotal =
    DARK_BG_HEX.includes(String(colors.totalBg).toLowerCase()) ||
    colors.totalBg === colors.headerBg;
  return (
    <div
      style={{
        padding: "24px 40px",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div style={{ minWidth: 320 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ color: colors.textMuted, fontSize: 13 }}>Subtotal</span>
          <span style={{ color: colors.text, fontSize: 13, fontWeight: 600 }}>
            {fmtAmount(invoice.subtotal, invoice.currency)}
          </span>
        </div>
        {Number(invoice.tax_amount || 0) > 0 ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <span style={{ color: colors.textMuted, fontSize: 13 }}>
              Tax ({Number(invoice.tax_rate || 0).toFixed(2)}%)
            </span>
            <span style={{ color: colors.text, fontSize: 13, fontWeight: 600 }}>
              {fmtAmount(invoice.tax_amount, invoice.currency)}
            </span>
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: 12,
            marginTop: 8,
            background: colors.totalBg,
            borderRadius: layout.cornerRadius,
            color: isDarkTotal ? colors.headerText : colors.text,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700 }}>Total</span>
          <span style={{ fontSize: 18, fontWeight: 800 }}>
            {fmtAmount(invoice.total, invoice.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

function NotesSection({ invoice, config }) {
  if (!invoice.notes) return null;
  const { colors, layout } = config;
  return (
    <div style={{ padding: "0 40px 24px" }}>
      <div
        style={{
          padding: 16,
          background: colors.accent,
          borderLeft: `4px solid ${colors.primary}`,
          borderRadius: layout.cornerRadius,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: colors.primary,
            marginBottom: 6,
          }}
        >
          Notes &amp; Terms
        </div>
        <div
          style={{
            fontSize: 12,
            color: colors.text,
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
          }}
        >
          {invoice.notes}
        </div>
      </div>
    </div>
  );
}

function Footer({ config }) {
  const { colors } = config;
  return (
    <div
      style={{
        padding: "24px 40px",
        textAlign: "center",
        borderTop: `1px solid ${colors.border}`,
        fontSize: 11,
        color: colors.textMuted,
      }}
    >
      Thank you for your business!
    </div>
  );
}

/**
 * Top-level renderer. Resolves the final config from templateId + custom
 * overrides (or settings.template_id / settings.template_config).
 */
function InvoiceTemplate({ invoice, settings, templateId, customConfig }) {
  if (!invoice) return null;
  const finalTemplateId = templateId ?? settings?.template_id;
  const finalCustom = customConfig ?? settings?.template_config;
  const config = resolveTemplateConfig(finalTemplateId, finalCustom);

  return (
    <div
      className="invoice-template"
      style={{
        background: config.colors.background,
        color: config.colors.text,
        fontFamily: config.fonts.body,
        borderRadius: config.layout.cornerRadius,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        maxWidth: 880,
        margin: "0 auto",
      }}
    >
      <InvoiceHeader invoice={invoice} settings={settings} config={config} />
      <InvoiceMeta invoice={invoice} config={config} />
      <LineItemsTable invoice={invoice} config={config} />
      <Totals invoice={invoice} config={config} />
      <NotesSection invoice={invoice} config={config} />
      <Footer config={config} />
    </div>
  );
}

export default InvoiceTemplate;
export { CompanyBlock, Logo, InvoiceTitleBlock, InvoiceHeader, InvoiceMeta, LineItemsTable, Totals, NotesSection, Footer };
