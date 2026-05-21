/**
 * Print-only layout — completely outside the admin shell.
 * Provides print-specific CSS so only the invoice itself is printed.
 */
export const metadata = {
  title: "Invoice Print",
};

export default function PrintInvoiceLayout({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f7" }}>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-toolbar {
            display: none !important;
          }
          .invoice-template {
            box-shadow: none !important;
            margin: 0 auto !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
      {children}
    </div>
  );
}
