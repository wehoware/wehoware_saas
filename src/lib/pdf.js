/**
 * src/lib/pdf.js
 *
 * Server-side PDF generation using @react-pdf/renderer.
 * Renders the InvoicePdf React component to a PDF buffer using React's
 * native PDF primitives — no browser binary required.
 *
 * Works in any serverless environment (Vercel, AWS Lambda, etc.) since
 * it doesn't need Chromium/Playwright/Puppeteer.
 */

import "server-only";

/**
 * Generate a PDF Buffer for the given invoice + settings.
 *
 * @param {object} invoice  Serialized invoice (snake_case, with line_items)
 * @param {object} settings Invoice settings (company name, logo, template config)
 * @returns {Promise<Buffer>}
 */
export async function generateInvoicePdf(invoice, settings) {
  if (!invoice) throw new Error("generateInvoicePdf: invoice is required");

  const React = await import("react");
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { default: InvoicePdfDocument } = await import("@/components/invoice/InvoicePdf.jsx");

  const element = React.createElement(InvoicePdfDocument, {
    invoice,
    settings,
  });

  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}

/**
 * No-op for backward compatibility (no browser to close).
 */
export async function closeBrowser() {}
