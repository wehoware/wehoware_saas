/**
 * src/lib/pdf.js
 *
 * Server-side PDF generation using Playwright (headless Chromium).
 * Renders the InvoiceTemplate React component to static HTML, wraps it in
 * print-specific CSS, then uses Chromium's PDF engine to produce a Buffer.
 *
 * A singleton browser instance is reused across requests for performance.
 *
 * NOTE: react-dom/server, React, and InvoiceTemplate are dynamically imported
 * inside buildInvoiceHtml to prevent Turbopack from statically detecting
 * react-dom/server at the module level (which breaks the client bundle).
 */

import "server-only";

let _browser = null;

async function getBrowser() {
  if (_browser) return _browser;
  const { chromium } = await import("playwright");
  _browser = await chromium.launch({ headless: true });
  return _browser;
}

const PRINT_CSS = `
  @page { size: A4; margin: 0; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .invoice-template {
    box-shadow: none !important;
    margin: 0 auto !important;
    border-radius: 0 !important;
    max-width: none !important;
  }
`;

/**
 * Build a full HTML document string wrapping the rendered InvoiceTemplate.
 * Uses dynamic imports to keep react-dom/server out of the static module graph.
 */
async function buildInvoiceHtml(invoice, settings) {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: InvoiceTemplate } = await import("@/components/invoice/InvoiceTemplate");

  const markup = renderToStaticMarkup(
    React.createElement(InvoiceTemplate, { invoice, settings })
  );
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${PRINT_CSS}</style>
</head>
<body>
${markup}
</body>
</html>`;
}

/**
 * Generate a PDF Buffer for the given invoice + settings.
 *
 * @param {object} invoice  Serialized invoice (snake_case, with line_items)
 * @param {object} settings Invoice settings (company name, logo, template config)
 * @returns {Promise<Buffer>}
 */
export async function generateInvoicePdf(invoice, settings) {
  if (!invoice) throw new Error("generateInvoicePdf: invoice is required");

  const html = await buildInvoiceHtml(invoice, settings);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle", timeout: 30000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/**
 * Close the singleton browser instance (useful for graceful shutdown / tests).
 */
export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}
