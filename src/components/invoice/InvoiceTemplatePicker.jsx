"use client";

/**
 * InvoiceTemplatePicker
 *
 * Visual picker showing thumbnail previews of all 10 templates.
 * Selecting a template calls onChange(templateId).
 */
import React from "react";
import { Check } from "lucide-react";
import { INVOICE_TEMPLATES, resolveTemplateConfig } from "@/lib/invoiceTemplates";

function TemplateThumb({ template }) {
  const config = resolveTemplateConfig(template.id, null);
  const { colors, layout } = config;
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "210 / 297",
        background: colors.background,
        borderRadius: 4,
        overflow: "hidden",
        border: `1px solid ${colors.border}`,
        position: "relative",
        fontFamily: config.fonts.body,
      }}
    >
      {/* Header strip */}
      <div
        style={{
          height: layout.headerStyle === "minimal" ? "12%" : "20%",
          background:
            layout.headerStyle === "minimal" || layout.headerStyle === "centered"
              ? colors.background
              : colors.headerBg,
          color: colors.headerText,
          padding: "4px 6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${colors.border}`,
          position: "relative",
        }}
      >
        {layout.headerStyle === "sidebar" ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              background: colors.primary,
            }}
          />
        ) : null}
        <div
          style={{
            width: "30%",
            height: 6,
            background:
              layout.headerStyle === "minimal" || layout.headerStyle === "centered"
                ? colors.text
                : colors.headerText,
            opacity: 0.7,
            borderRadius: 1,
          }}
        />
        <div
          style={{
            width: "20%",
            height: 6,
            background: colors.primary,
            borderRadius: 1,
          }}
        />
      </div>
      {/* Body lines */}
      <div style={{ padding: 6 }}>
        <div style={{ height: 4, background: colors.textMuted, opacity: 0.4, borderRadius: 1, marginBottom: 4, width: "60%" }} />
        <div style={{ height: 4, background: colors.textMuted, opacity: 0.3, borderRadius: 1, marginBottom: 8, width: "40%" }} />
        {/* Table */}
        <div
          style={{
            background: colors.tableHeaderBg,
            height: 8,
            borderRadius: 1,
            marginBottom: 2,
          }}
        />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 5,
              borderBottom: `1px solid ${colors.border}`,
              background: i % 2 === 1 && layout.tableStyle === "striped" ? colors.accent : "transparent",
            }}
          />
        ))}
        {/* Total */}
        <div
          style={{
            marginTop: 8,
            height: 8,
            width: "40%",
            marginLeft: "auto",
            background: colors.totalBg,
            borderRadius: layout.cornerRadius === "0px" ? 0 : 2,
          }}
        />
      </div>
    </div>
  );
}

export default function InvoiceTemplatePicker({ value, onChange }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 12,
      }}
    >
      {INVOICE_TEMPLATES.map((template) => {
        const selected = value === template.id;
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onChange(template.id)}
            style={{
              padding: 8,
              border: selected ? "2px solid #2563eb" : "1px solid #e2e8f0",
              borderRadius: 8,
              background: "#ffffff",
              cursor: "pointer",
              textAlign: "left",
              position: "relative",
            }}
          >
            {selected ? (
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  background: "#2563eb",
                  color: "#ffffff",
                  borderRadius: "50%",
                  width: 20,
                  height: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1,
                }}
              >
                <Check className="h-3 w-3" />
              </div>
            ) : null}
            <TemplateThumb template={template} />
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                {template.name}
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, lineHeight: 1.3 }}>
                {template.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
