// tests/mocks/invoice-templates.mjs — minimal stand-in for the real module.
export const INVOICE_TEMPLATES = [
  { id: "classic", label: "Classic" },
  { id: "modern", label: "Modern" },
];
export const DEFAULT_TEMPLATE_ID = "classic";
export function sanitizeTemplateConfig(config) {
  if (!config || typeof config !== "object") return null;
  return { ...config };
}
