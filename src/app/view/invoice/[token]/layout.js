/**
 * Public invoice view layout — minimal, no admin shell, noindex meta.
 */
export const metadata = {
  title: "View Invoice",
  robots: { index: false, follow: false },
};

export default function PublicInvoiceLayout({ children }) {
  return (
    <div className="public-invoice-layout" style={{ minHeight: "100vh", background: "#f5f5f7" }}>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .public-toolbar {
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
