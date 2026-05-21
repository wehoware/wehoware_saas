/**
 * src/lib/invoiceTemplates.js
 *
 * Pre-defined invoice template presets + customization schema.
 * Each preset provides a complete configuration object that drives the
 * universal `<InvoiceTemplate />` renderer. Users can pick a preset and
 * optionally override any field to create a custom template that gets
 * persisted in WehowareInvoiceSettings.templateConfig.
 *
 * Pure JS — no React, no Node-only APIs. Safe to import on client + server.
 */

export const TEMPLATE_LAYOUTS = {
  HEADER_BANNER: "banner", // colored full-width banner at top
  HEADER_MINIMAL: "minimal", // logo + title only, plain background
  HEADER_CENTERED: "centered", // everything centered, formal feel
  HEADER_SPLIT: "split", // logo left, big invoice title right
  HEADER_SIDEBAR: "sidebar", // accent strip down the left edge
};

export const TABLE_STYLES = {
  STRIPED: "striped",
  BORDERED: "bordered",
  MINIMAL: "minimal",
  MODERN: "modern", // bold header bar, no inner borders
};

export const FONT_STACKS = {
  SANS: '"Inter", "Helvetica Neue", Arial, system-ui, -apple-system, sans-serif',
  SERIF: '"Source Serif Pro", Georgia, "Times New Roman", serif',
  MONO: '"JetBrains Mono", "Courier New", monospace',
  ROUNDED: '"Nunito", "Quicksand", system-ui, sans-serif',
  ELEGANT: '"Playfair Display", Georgia, serif',
  MODERN: '"Montserrat", "Inter", sans-serif',
};

/**
 * Default config keys — every preset must declare every field so a
 * customization merge is predictable.
 */
const BASE_CONFIG = Object.freeze({
  colors: {
    primary: "#1e40af",
    secondary: "#64748b",
    accent: "#dbeafe",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
    background: "#ffffff",
    headerBg: "#1e40af",
    headerText: "#ffffff",
    tableHeaderBg: "#f1f5f9",
    tableHeaderText: "#0f172a",
    totalBg: "#f1f5f9",
  },
  fonts: {
    heading: FONT_STACKS.SANS,
    body: FONT_STACKS.SANS,
  },
  layout: {
    headerStyle: TEMPLATE_LAYOUTS.HEADER_BANNER,
    tableStyle: TABLE_STYLES.STRIPED,
    cornerRadius: "8px",
    spacing: "normal", // 'compact' | 'normal' | 'relaxed'
    accentBar: false, // additional decorative accent bar
    uppercaseHeading: false,
    showLogo: true,
  },
});

const P = { ...BASE_CONFIG.colors };

/**
 * Helper to compose a preset by overriding fields on top of base.
 */
function preset(overrides) {
  return {
    colors: { ...BASE_CONFIG.colors, ...(overrides.colors || {}) },
    fonts: { ...BASE_CONFIG.fonts, ...(overrides.fonts || {}) },
    layout: { ...BASE_CONFIG.layout, ...(overrides.layout || {}) },
  };
}

/**
 * 10 curated templates inspired by best-in-class invoice designs from
 * Stripe, FreshBooks, Wave, Invoice Ninja, Zoho, etc. Each preset is a
 * fully-formed config that can be rendered standalone or further
 * customized by the user.
 */
export const INVOICE_TEMPLATES = Object.freeze([
  {
    id: "classic",
    name: "Classic Professional",
    description: "Timeless black & white layout with crisp typography.",
    config: preset({
      colors: {
        primary: "#111827",
        accent: "#f3f4f6",
        headerBg: "#ffffff",
        headerText: "#111827",
        tableHeaderBg: "#f9fafb",
        tableHeaderText: "#111827",
        totalBg: "#f9fafb",
      },
      fonts: { heading: FONT_STACKS.SANS, body: FONT_STACKS.SANS },
      layout: {
        headerStyle: TEMPLATE_LAYOUTS.HEADER_MINIMAL,
        tableStyle: TABLE_STYLES.BORDERED,
        accentBar: true,
        cornerRadius: "0px",
      },
    }),
  },
  {
    id: "modern-blue",
    name: "Modern Blue",
    description: "Vibrant blue accent header — popular SaaS look.",
    config: preset({
      colors: {
        primary: "#2563eb",
        accent: "#eff6ff",
        headerBg: "#2563eb",
        headerText: "#ffffff",
        tableHeaderBg: "#eff6ff",
        tableHeaderText: "#1e40af",
        totalBg: "#eff6ff",
      },
      fonts: { heading: FONT_STACKS.MODERN, body: FONT_STACKS.SANS },
      layout: {
        headerStyle: TEMPLATE_LAYOUTS.HEADER_BANNER,
        tableStyle: TABLE_STYLES.MODERN,
        cornerRadius: "12px",
      },
    }),
  },
  {
    id: "minimal",
    name: "Minimalist",
    description: "Lots of whitespace, hairline rules, calm hierarchy.",
    config: preset({
      colors: {
        primary: "#0f172a",
        accent: "#f8fafc",
        border: "#e5e7eb",
        headerBg: "#ffffff",
        headerText: "#0f172a",
        tableHeaderBg: "#ffffff",
        tableHeaderText: "#64748b",
        totalBg: "#ffffff",
      },
      fonts: { heading: FONT_STACKS.SANS, body: FONT_STACKS.SANS },
      layout: {
        headerStyle: TEMPLATE_LAYOUTS.HEADER_MINIMAL,
        tableStyle: TABLE_STYLES.MINIMAL,
        spacing: "relaxed",
        cornerRadius: "0px",
        uppercaseHeading: true,
      },
    }),
  },
  {
    id: "corporate",
    name: "Corporate",
    description: "Bold colored band + structured grid layout.",
    config: preset({
      colors: {
        primary: "#0f3057",
        accent: "#e8f0fc",
        headerBg: "#0f3057",
        headerText: "#ffffff",
        tableHeaderBg: "#0f3057",
        tableHeaderText: "#ffffff",
        totalBg: "#e8f0fc",
      },
      fonts: { heading: FONT_STACKS.SANS, body: FONT_STACKS.SANS },
      layout: {
        headerStyle: TEMPLATE_LAYOUTS.HEADER_SPLIT,
        tableStyle: TABLE_STYLES.MODERN,
        cornerRadius: "4px",
        uppercaseHeading: true,
      },
    }),
  },
  {
    id: "elegant",
    name: "Elegant",
    description: "Refined serif typography with burgundy accents.",
    config: preset({
      colors: {
        primary: "#7f1d1d",
        accent: "#fef2f2",
        headerBg: "#ffffff",
        headerText: "#7f1d1d",
        tableHeaderBg: "#fef2f2",
        tableHeaderText: "#7f1d1d",
        totalBg: "#fef2f2",
      },
      fonts: { heading: FONT_STACKS.ELEGANT, body: FONT_STACKS.SERIF },
      layout: {
        headerStyle: TEMPLATE_LAYOUTS.HEADER_CENTERED,
        tableStyle: TABLE_STYLES.MINIMAL,
        spacing: "relaxed",
        cornerRadius: "0px",
      },
    }),
  },
  {
    id: "creative",
    name: "Creative",
    description: "Vibrant color blocks for design-led brands.",
    config: preset({
      colors: {
        primary: "#7c3aed",
        accent: "#f5f3ff",
        headerBg: "#7c3aed",
        headerText: "#ffffff",
        tableHeaderBg: "#f5f3ff",
        tableHeaderText: "#5b21b6",
        totalBg: "#7c3aed",
      },
      fonts: { heading: FONT_STACKS.MODERN, body: FONT_STACKS.SANS },
      layout: {
        headerStyle: TEMPLATE_LAYOUTS.HEADER_SIDEBAR,
        tableStyle: TABLE_STYLES.STRIPED,
        cornerRadius: "16px",
      },
    }),
  },
  {
    id: "compact",
    name: "Compact",
    description: "Dense layout — ideal when invoices have many line items.",
    config: preset({
      colors: {
        primary: "#0e7490",
        accent: "#ecfeff",
        headerBg: "#ffffff",
        headerText: "#0e7490",
        tableHeaderBg: "#ecfeff",
        tableHeaderText: "#0e7490",
        totalBg: "#ecfeff",
      },
      fonts: { heading: FONT_STACKS.SANS, body: FONT_STACKS.SANS },
      layout: {
        headerStyle: TEMPLATE_LAYOUTS.HEADER_MINIMAL,
        tableStyle: TABLE_STYLES.STRIPED,
        spacing: "compact",
        cornerRadius: "4px",
      },
    }),
  },
  {
    id: "bold",
    name: "Bold",
    description: "Heavy typography, strong contrast, eye-catching totals.",
    config: preset({
      colors: {
        primary: "#000000",
        accent: "#fef3c7",
        headerBg: "#000000",
        headerText: "#fbbf24",
        tableHeaderBg: "#000000",
        tableHeaderText: "#fbbf24",
        totalBg: "#000000",
      },
      fonts: { heading: FONT_STACKS.MODERN, body: FONT_STACKS.SANS },
      layout: {
        headerStyle: TEMPLATE_LAYOUTS.HEADER_BANNER,
        tableStyle: TABLE_STYLES.MODERN,
        cornerRadius: "0px",
        uppercaseHeading: true,
      },
    }),
  },
  {
    id: "friendly",
    name: "Friendly",
    description: "Rounded corners, warm coral palette, approachable.",
    config: preset({
      colors: {
        primary: "#ea580c",
        accent: "#fff7ed",
        headerBg: "#fff7ed",
        headerText: "#9a3412",
        tableHeaderBg: "#fff7ed",
        tableHeaderText: "#9a3412",
        totalBg: "#fff7ed",
      },
      fonts: { heading: FONT_STACKS.ROUNDED, body: FONT_STACKS.ROUNDED },
      layout: {
        headerStyle: TEMPLATE_LAYOUTS.HEADER_CENTERED,
        tableStyle: TABLE_STYLES.STRIPED,
        cornerRadius: "20px",
      },
    }),
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Pure black & white. Print-perfect, no color ink needed.",
    config: preset({
      colors: {
        primary: "#000000",
        accent: "#f4f4f5",
        border: "#000000",
        headerBg: "#ffffff",
        headerText: "#000000",
        tableHeaderBg: "#ffffff",
        tableHeaderText: "#000000",
        totalBg: "#ffffff",
      },
      fonts: { heading: FONT_STACKS.SERIF, body: FONT_STACKS.SERIF },
      layout: {
        headerStyle: TEMPLATE_LAYOUTS.HEADER_SPLIT,
        tableStyle: TABLE_STYLES.BORDERED,
        cornerRadius: "0px",
      },
    }),
  },
]);

export const DEFAULT_TEMPLATE_ID = "classic";

/**
 * Look up a preset by id; falls back to the default when missing.
 */
export function getTemplateById(templateId) {
  return (
    INVOICE_TEMPLATES.find((t) => t.id === templateId) ||
    INVOICE_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID) ||
    INVOICE_TEMPLATES[0]
  );
}

/**
 * Resolve a final, ready-to-render config given the chosen templateId
 * and (optional) user-defined overrides. Override structure mirrors the
 * config tree (colors / fonts / layout) so partial changes are merged.
 *
 * @param {string} templateId
 * @param {object|null} customConfig
 * @returns {object}
 */
export function resolveTemplateConfig(templateId, customConfig) {
  const base = getTemplateById(templateId).config;
  if (!customConfig || typeof customConfig !== "object") {
    return base;
  }
  return {
    colors: { ...base.colors, ...(customConfig.colors || {}) },
    fonts: { ...base.fonts, ...(customConfig.fonts || {}) },
    layout: { ...base.layout, ...(customConfig.layout || {}) },
  };
}

/**
 * Validate a custom config object — throws nothing, just filters out
 * unknown keys so we never persist garbage. Returns a normalized copy or
 * null when nothing valid was supplied.
 */
export function sanitizeTemplateConfig(input) {
  if (!input || typeof input !== "object") return null;
  const out = {};
  if (input.colors && typeof input.colors === "object") {
    const allowed = Object.keys(BASE_CONFIG.colors);
    out.colors = {};
    for (const key of allowed) {
      if (typeof input.colors[key] === "string") {
        const trimmed = input.colors[key].trim();
        if (trimmed) out.colors[key] = trimmed.slice(0, 50);
      }
    }
    if (Object.keys(out.colors).length === 0) delete out.colors;
  }
  if (input.fonts && typeof input.fonts === "object") {
    const allowed = ["heading", "body"];
    out.fonts = {};
    for (const key of allowed) {
      if (typeof input.fonts[key] === "string") {
        const trimmed = input.fonts[key].trim();
        if (trimmed) out.fonts[key] = trimmed.slice(0, 200);
      }
    }
    if (Object.keys(out.fonts).length === 0) delete out.fonts;
  }
  if (input.layout && typeof input.layout === "object") {
    const allowedKeys = Object.keys(BASE_CONFIG.layout);
    out.layout = {};
    for (const key of allowedKeys) {
      const value = input.layout[key];
      if (typeof value === "string" || typeof value === "boolean") {
        out.layout[key] = typeof value === "string" ? value.slice(0, 50) : value;
      }
    }
    if (Object.keys(out.layout).length === 0) delete out.layout;
  }
  return Object.keys(out).length === 0 ? null : out;
}

// re-exported defaults exposed for tests / Storybook usage.
export const __testing = { BASE_CONFIG, P };
