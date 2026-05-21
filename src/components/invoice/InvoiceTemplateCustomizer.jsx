"use client";

/**
 * InvoiceTemplateCustomizer
 *
 * Lets the user override colors of the chosen template. Live updates a
 * `customConfig` object that the parent persists in invoice settings.
 *
 * Props:
 *   templateId   — selected base template
 *   value        — current custom overrides (or null)
 *   onChange(next) — fires whenever overrides change
 */
import React from "react";
import { RotateCcw } from "lucide-react";
import { resolveTemplateConfig } from "@/lib/invoiceTemplates";

const COLOR_FIELDS = [
  { key: "primary", label: "Primary" },
  { key: "headerBg", label: "Header background" },
  { key: "headerText", label: "Header text" },
  { key: "accent", label: "Accent" },
  { key: "totalBg", label: "Total background" },
  { key: "tableHeaderBg", label: "Table header bg" },
  { key: "tableHeaderText", label: "Table header text" },
  { key: "text", label: "Body text" },
  { key: "border", label: "Borders" },
];

const FONT_OPTIONS = [
  { value: "", label: "Use template default" },
  {
    value: '"Inter", system-ui, sans-serif',
    label: "Inter (Sans)",
  },
  {
    value: '"Montserrat", "Inter", sans-serif',
    label: "Montserrat (Modern)",
  },
  {
    value: '"Nunito", system-ui, sans-serif',
    label: "Nunito (Rounded)",
  },
  {
    value: '"Source Serif Pro", Georgia, serif',
    label: "Source Serif (Serif)",
  },
  {
    value: '"Playfair Display", Georgia, serif',
    label: "Playfair (Elegant)",
  },
];

export default function InvoiceTemplateCustomizer({ templateId, value, onChange }) {
  const baseConfig = resolveTemplateConfig(templateId, null);
  const merged = resolveTemplateConfig(templateId, value);

  const setColor = (key, color) => {
    const nextColors = { ...(value?.colors || {}) };
    if (!color || color === baseConfig.colors[key]) {
      delete nextColors[key];
    } else {
      nextColors[key] = color;
    }
    const next = { ...(value || {}) };
    if (Object.keys(nextColors).length > 0) {
      next.colors = nextColors;
    } else {
      delete next.colors;
    }
    onChange(Object.keys(next).length > 0 ? next : null);
  };

  const setFont = (which, font) => {
    const nextFonts = { ...(value?.fonts || {}) };
    if (!font) {
      delete nextFonts[which];
    } else {
      nextFonts[which] = font;
    }
    const next = { ...(value || {}) };
    if (Object.keys(nextFonts).length > 0) {
      next.fonts = nextFonts;
    } else {
      delete next.fonts;
    }
    onChange(Object.keys(next).length > 0 ? next : null);
  };

  const reset = () => onChange(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Override any colors or fonts to make the template your own.
        </div>
        <button
          type="button"
          onClick={reset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: "#dc2626",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <RotateCcw className="h-3 w-3" /> Reset to defaults
        </button>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>
          Colors
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 8,
          }}
        >
          {COLOR_FIELDS.map(({ key, label }) => {
            const colorValue = merged.colors[key] || "#000000";
            const isOverridden = Boolean(value?.colors?.[key]);
            return (
              <label
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: 6,
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  background: "#ffffff",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                <input
                  type="color"
                  value={colorValue}
                  onChange={(e) => setColor(key, e.target.value)}
                  style={{
                    width: 28,
                    height: 28,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{label}</div>
                  <div style={{ color: "#64748b", fontSize: 10 }}>
                    {colorValue.toUpperCase()}
                    {isOverridden ? " (custom)" : ""}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>
          Fonts
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>Heading</span>
            <select
              value={value?.fonts?.heading || ""}
              onChange={(e) => setFont("heading", e.target.value)}
              style={{
                padding: 6,
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                fontSize: 12,
                background: "#ffffff",
              }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>Body</span>
            <select
              value={value?.fonts?.body || ""}
              onChange={(e) => setFont("body", e.target.value)}
              style={{
                padding: 6,
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                fontSize: 12,
                background: "#ffffff",
              }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
