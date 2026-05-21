"use client";

/**
 * Print-only invoice page.
 *
 * Auto-triggers print dialog on load. Toolbar is hidden during print.
 * Uses Web Share API for native sharing on mobile, with fallback for
 * unsupported browsers.
 */
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Printer, Share2, Download, ArrowLeft } from "lucide-react";
import InvoiceTemplate from "@/components/invoice/InvoiceTemplate";

async function fetchInvoice(id) {
  const res = await fetch(`/api/v1/invoices/${id}`);
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Failed to load invoice");
  }
  const json = await res.json();
  return json.data ?? json;
}

async function fetchSettings() {
  try {
    const res = await fetch(`/api/v1/invoice-settings`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function PrintInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.id;

  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoPrinted, setAutoPrinted] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchInvoice(invoiceId), fetchSettings()])
      .then(([inv, set]) => {
        if (!cancelled) {
          setInvoice(inv);
          setSettings(set);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load invoice");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  // Auto-trigger print after content settles. Wrapped in setTimeout so
  // images (logo) get a chance to load before the print dialog opens.
  useEffect(() => {
    if (!invoice || autoPrinted || loading) return;
    const t = setTimeout(() => {
      try {
        window.print();
        setAutoPrinted(true);
      } catch {
        /* user can still click Print */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [invoice, autoPrinted, loading]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const title = `Invoice ${invoice?.invoice_number || ""}`;
    const text = `Invoice ${invoice?.invoice_number || ""} for ${invoice?.client_name || ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        /* user cancelled */
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        alert("Invoice link copied to clipboard");
      } catch {
        prompt("Copy this link:", url);
      }
    } else {
      prompt("Copy this link:", url);
    }
  }, [invoice]);

  const handleDownload = useCallback(() => {
    // Browser print dialog includes "Save as PDF" — use that path.
    window.print();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: 16,
          textAlign: "center",
        }}
      >
        <p style={{ color: "#b91c1c", marginBottom: 12 }}>
          {error || "Invoice not found"}
        </p>
        <button
          type="button"
          onClick={() => router.push("/admin/accounting/invoices")}
          style={{
            padding: "8px 16px",
            background: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Back to invoices
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 16px" }}>
      <div
        className="print-toolbar"
        style={{
          maxWidth: 880,
          margin: "0 auto 16px",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => router.push(`/admin/accounting/invoices/${invoiceId}`)}
          style={{
            padding: "8px 14px",
            background: "#ffffff",
            color: "#0f172a",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
          }}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleShare}
            style={{
              padding: "8px 14px",
              background: "#ffffff",
              color: "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
          <button
            type="button"
            onClick={handleDownload}
            style={{
              padding: "8px 14px",
              background: "#ffffff",
              color: "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <Download className="h-4 w-4" /> Save as PDF
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              padding: "8px 14px",
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      <InvoiceTemplate invoice={invoice} settings={settings} />
    </div>
  );
}
