"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import InvoiceTemplate from "@/components/invoice/InvoiceTemplate";

export default function PublicInvoicePage() {
  const params = useParams();
  const token = params.token;

  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/invoices/public/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Invoice not found");
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setInvoice(data.invoice);
        setSettings(data.settings);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Failed to load invoice.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleDownloadPdf = () => {
    globalThis.open(`/api/v1/invoices/public/${token}/pdf`, "_blank");
  };

  const handlePrint = () => {
    globalThis.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600 text-lg">Invoice not found.</p>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="public-toolbar flex justify-end gap-2 mb-4 max-w-[880px] mx-auto">
        <Button variant="outline" onClick={handleDownloadPdf}>
          <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>
      <InvoiceTemplate invoice={invoice} settings={settings} />
    </div>
  );
}
