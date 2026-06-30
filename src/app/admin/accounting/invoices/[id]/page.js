"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, Edit3, Share2, Download } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import InvoiceTemplate from '@/components/invoice/InvoiceTemplate';
import toast from 'react-hot-toast';
import { useAuth } from "@/contexts/auth-context";

const fetchInvoiceById = async (id) => {
  const res = await fetch(`/api/v1/invoices/${id}`);
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Invoice not found");
  }
  const json = await res.json();
  return json.data ?? json;
};

async function fetchInvoiceSettings() {
  try {
    const res = await fetch(`/api/v1/invoice-settings`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function ViewInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const { activeClient } = useAuth();
  const invoiceId = params.id;
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!invoiceId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchInvoiceById(invoiceId), fetchInvoiceSettings()])
      .then(([inv, set]) => {
        if (cancelled) return;
        setInvoice(inv);
        setSettings(set);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error fetching invoice:", err);
        setError(err.message || "Failed to load invoice data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId, activeClient?.id]);

  const openPrintView = useCallback(() => {
    if (!invoiceId) return;
    // New tab so the admin session is preserved and the print layout is clean.
    window.open(`/print/invoice/${invoiceId}`, '_blank', 'noopener,noreferrer');
  }, [invoiceId]);

  const handleShare = useCallback(async () => {
    if (!invoice) return;
    const url = `${window.location.origin}/print/invoice/${invoiceId}`;
    const shareData = {
      title: `Invoice ${invoice.invoice_number || ''}`,
      text: `Invoice ${invoice.invoice_number || ''} for ${invoice.client_name || ''}`,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Invoice link copied to clipboard');
        return;
      } catch {
        /* fallthrough */
      }
    }
    window.prompt('Copy this invoice link:', url);
  }, [invoice, invoiceId]);

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 flex justify-center items-center min-h-[calc(100vh-200px)]">
        <p className="text-gray-600 text-lg">Loading invoice details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 text-center">
        <p className="text-red-600 text-lg">Error: {error}</p>
        <Button asChild variant="link" className="mt-4 text-lg">
          <Link href="/admin/accounting/invoices">Go back to Invoices</Link>
        </Button>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 text-center">
        <p className="text-gray-600 text-lg">Invoice not found.</p>
        <Button asChild variant="link" className="mt-4 text-lg">
          <Link href="/admin/accounting/invoices">Go back to Invoices</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 bg-gray-50 min-h-screen">
      <AdminPageHeader
        title={invoice.invoice_number ?? `Invoice #${invoiceId}`}
        description={`Details for invoice sent to ${invoice.client_name}.`}
        backLink="/admin/accounting/invoices"
        backIcon={<ArrowLeft className="mr-2 h-4 w-4" />}
        actionLabel="Edit Invoice"
        actionIcon={<Edit3 className="mr-2 h-4 w-4" />}
        onAction={() => router.push(`/admin/accounting/invoices/edit/${invoice.id}`)}
      />

      <div className="flex flex-wrap gap-2 justify-end mb-4">
        <Button variant="outline" onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
        <Button variant="outline" onClick={openPrintView}>
          <Download className="mr-2 h-4 w-4" /> Save as PDF
        </Button>
        <Button onClick={openPrintView}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      <Card className="mt-2 shadow-lg p-4 md:p-6">
        <InvoiceTemplate invoice={invoice} settings={settings} />
      </Card>
    </div>
  );
}
