"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, Edit3, CheckCircle, Clock, AlertCircle, FileText, XCircle, Hash } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const fetchInvoiceById = async (id) => {
  const res = await fetch(`/api/v1/invoices/${id}`);
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Invoice not found");
  }
  const json = await res.json();
  return json.data ?? json;
};

const InvoiceStatusBadge = ({ status }) => {
  let variant = 'default';
  let IconComponent = Hash;
  switch (status) {
    case 'Paid': variant = 'success'; IconComponent = CheckCircle; break;
    case 'Pending': variant = 'warning'; IconComponent = Clock; break;
    case 'Overdue': variant = 'destructive'; IconComponent = AlertCircle; break;
    case 'Draft': variant = 'outline'; IconComponent = FileText; break;
    case 'Cancelled': variant = 'destructive_outline'; IconComponent = XCircle; break;
  }
  return (
    <Badge variant={variant} className="text-sm font-semibold flex items-center">
      <IconComponent className="w-4 h-4 mr-1.5" />
      {status}
    </Badge>
  );
};

export default function ViewInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id;
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    fetchInvoiceById(invoiceId)
      .then((data) => setInvoice(data))
      .catch((err) => {
        console.error("Error fetching invoice:", err);
        setError(err.message || "Failed to load invoice data.");
      })
      .finally(() => setLoading(false));
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
          <Link href="/admin/invoices">Go back to Invoices</Link>
        </Button>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 text-center">
        <p className="text-gray-600 text-lg">Invoice not found.</p>
        <Button asChild variant="link" className="mt-4 text-lg">
          <Link href="/admin/invoices">Go back to Invoices</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 bg-gray-50 min-h-screen">
      <AdminPageHeader
        title={invoice.invoice_number ?? `Invoice #${invoiceId}`}
        description={`Details for invoice sent to ${invoice.client_name}.`}
        backLink="/admin/invoices"
        backIcon={<ArrowLeft className="mr-2 h-4 w-4" />}
        actionLabel="Edit Invoice"
        actionIcon={<Edit3 className="mr-2 h-4 w-4" />}
        onAction={() => router.push(`/admin/invoices/edit/${invoice.id}`)}
        secondaryActionLabel="Print"
        secondaryActionIcon={<Printer className="mr-2 h-4 w-4" />}
        onSecondaryAction={() => window.print()}
      />

      <Card className="mt-6 shadow-lg">
        <CardHeader className="bg-gray-100 border-b p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start">
            <div>
              <CardTitle className="text-3xl font-bold text-blue-700">INVOICE</CardTitle>
              <CardDescription className="text-gray-600 text-md"># {invoice.invoice_number}</CardDescription>
            </div>
            <div className="mt-4 sm:mt-0 text-left sm:text-right">
              <InvoiceStatusBadge status={invoice.status} />
              {invoice.invoice_date && (
                <p className="text-sm text-gray-500 mt-2">Issued: {new Date(invoice.invoice_date).toLocaleDateString()}</p>
              )}
              {invoice.due_date && (
                <p className="text-sm text-gray-500">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Billed To:</h3>
              <p className="text-lg font-medium text-gray-800">{invoice.client_name}</p>
              {invoice.client_email && <p className="text-gray-600">{invoice.client_email}</p>}
            </div>
            <div className="text-left md:text-right">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Invoice Details:</h3>
              <p className="text-gray-600">Invoice: {invoice.invoice_number}</p>
              <p className="text-gray-600">Date: {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : "—"}</p>
              <p className="text-gray-600">Due: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}</p>
            </div>
          </div>

          <div className="mb-8 overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="py-3 px-4 text-left text-xs font-semibold uppercase text-gray-600">Description</TableHead>
                  <TableHead className="py-3 px-4 text-right text-xs font-semibold uppercase text-gray-600 w-24">Quantity</TableHead>
                  <TableHead className="py-3 px-4 text-right text-xs font-semibold uppercase text-gray-600 w-32">Unit Price</TableHead>
                  <TableHead className="py-3 px-4 text-right text-xs font-semibold uppercase text-gray-600 w-32">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-gray-700 divide-y divide-gray-100">
                {(invoice.line_items || []).map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell className="py-3 px-4 font-medium">{item.description}</TableCell>
                    <TableCell className="py-3 px-4 text-right">{Number(item.quantity)}</TableCell>
                    <TableCell className="py-3 px-4 text-right">{invoice.currency} {Number(item.unit_price).toFixed(2)}</TableCell>
                    <TableCell className="py-3 px-4 text-right font-medium">{invoice.currency} {Number(item.total).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end mb-8">
            <div className="w-full sm:w-auto min-w-[280px] md:min-w-[320px]">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Subtotal:</span>
                <span className="text-gray-800 font-medium">{invoice.currency} {Number(invoice.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(invoice.tax_amount || 0) > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Tax ({Number(invoice.tax_rate || 0).toFixed(2)}%):</span>
                  <span className="text-gray-800 font-medium">{invoice.currency} {Number(invoice.tax_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 mt-2 bg-gray-100 px-4 rounded-md">
                <span className="text-lg font-bold text-gray-800">Total:</span>
                <span className="text-lg font-bold text-gray-800">{invoice.currency} {Number(invoice.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="font-semibold text-blue-700 mb-1.5">Notes:</h4>
              <p className="text-sm text-blue-600 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          <footer className="text-center text-xs text-gray-500 pt-6 border-t border-gray-200 mt-8">
            <p>Thank you for your business!</p>
          </footer>
        </CardContent>
      </Card>
    </div>
  );
}
