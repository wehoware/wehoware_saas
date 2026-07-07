"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, Edit3, Share2, Download, Send, Mail, Copy, Loader2, X } from 'lucide-react';
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
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [shareResult, setShareResult] = useState(null);

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

  const handleDownloadPdf = useCallback(() => {
    if (!invoiceId) return;
    window.open(`/api/v1/invoices/${invoiceId}/pdf`, '_blank');
  }, [invoiceId]);

  const handleShare = useCallback(async () => {
    if (!invoice) return;
    setSending(true);
    setShareResult(null);
    let shareUrl = null;
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ send_email: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate share link');
      }
      shareUrl = data.share_url;
      setShareResult(data);
    } catch (err) {
      toast.error(err.message || 'Failed to generate share link');
      setSending(false);
      return;
    }
    setSending(false);
    const shareData = {
      title: `Invoice ${invoice.invoice_number || ''}`,
      text: `Invoice ${invoice.invoice_number || ''} for ${invoice.client_name || ''}`,
      url: shareUrl,
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
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Public invoice link copied to clipboard');
        return;
      } catch {
        /* fallthrough */
      }
    }
    window.prompt('Copy this invoice link:', shareUrl);
  }, [invoice, invoiceId]);

  const openSendDialog = useCallback(() => {
    setSendEmail(invoice?.client_email || '');
    setShareResult(null);
    setSendDialogOpen(true);
  }, [invoice]);

  const handleSendInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setSending(true);
    setShareResult(null);
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sendEmail, send_email: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invoice');
      }
      setShareResult(data);
      if (data.email_sent) {
        toast.success(`Invoice emailed to ${sendEmail}`);
      } else if (data.email_error) {
        toast.error(`Share link created, but email failed: ${data.email_error}`);
      } else {
        toast.success('Share link generated');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  }, [invoiceId, sendEmail]);

  const handleGenerateLinkOnly = useCallback(async () => {
    if (!invoiceId) return;
    setSending(true);
    setShareResult(null);
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ send_email: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate link');
      }
      setShareResult(data);
      toast.success('Share link generated');
    } catch (err) {
      toast.error(err.message || 'Failed to generate link');
    } finally {
      setSending(false);
    }
  }, [invoiceId]);

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
        <Button variant="outline" onClick={openSendDialog}>
          <Send className="mr-2 h-4 w-4" /> Send Invoice
        </Button>
        <Button variant="outline" onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
        <Button variant="outline" onClick={handleDownloadPdf}>
          <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
        <Button onClick={openPrintView}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      {sendDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSendDialogOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setSendDialogOpen(false); }}
          role="dialog"
          aria-modal="true"
          aria-label="Send Invoice"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Send Invoice</h3>
              <Button variant="ghost" size="icon" onClick={() => setSendDialogOpen(false)} aria-label="Close dialog">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="sendInvoiceEmail" className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
                <input
                  id="sendInvoiceEmail"
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              {shareResult?.share_url && (
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-xs font-medium text-gray-600 mb-1">Share Link:</p>
                  <p className="text-xs text-blue-600 break-all">{shareResult.share_url}</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(shareResult.share_url);
                      toast.success('Link copied');
                    }}
                    className="text-xs text-blue-600 mt-1 flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" /> Copy link
                  </button>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleGenerateLinkOnly} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Link Only'}
                </Button>
                <Button onClick={handleSendInvoice} disabled={sending || !sendEmail}>
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Send via Email
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="mt-2 shadow-lg p-4 md:p-6">
        <InvoiceTemplate invoice={invoice} settings={settings} />
      </Card>
    </div>
  );
}
