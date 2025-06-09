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

// Mock data - this would typically come from your main invoices page or a shared store/context
const allMockInvoices = [
  { id: 'INV-001', clientName: 'Acme Corp', clientEmail: 'contact@acme.com', clientAddress: '123 Innovation Drive, Tech City, TX 75001', companyName: 'WeHowAre Inc.', companyAddress: '456 Solutions Ave, Silicon Valley, CA 94016', companyEmail: 'billing@wehoware.com', invoiceDate: '2024-05-01', dueDate: '2024-05-15', status: 'Paid', items: [{description: 'Web Design Package', quantity:1, unitPrice: 1200.00}, {description: 'Premium Hosting (1 Year)', quantity:1, unitPrice:300.50}], notes: 'Thank you for your continued business! Payment can be made via bank transfer or PayPal.', subtotal: 1500.50, tax: 0, discount: 0, totalAmount: 1500.50 },
  { id: 'INV-002', clientName: 'Beta Solutions', clientEmail: 'info@beta.dev', clientAddress: '789 Beta Block, Dev Town, NY 10001', companyName: 'WeHowAre Inc.', companyAddress: '456 Solutions Ave, Silicon Valley, CA 94016', companyEmail: 'billing@wehoware.com', invoiceDate: '2024-05-10', dueDate: '2024-05-25', status: 'Pending', items: [{description: 'Hourly Consulting Services', quantity:5, unitPrice: 50.10}, {description: 'Software License', quantity:2, unitPrice:75.00}], notes: 'Please remit payment by the due date.', subtotal: 400.50, tax: 40.05, discount: 0, totalAmount: 440.55 },
  { id: 'INV-003', clientName: 'Gamma Inc.', clientEmail: 'accounts@gamma.co', clientAddress: '321 Gamma Parkway, Business Bay, FL 33001', companyName: 'WeHowAre Inc.', companyAddress: '456 Solutions Ave, Silicon Valley, CA 94016', companyEmail: 'billing@wehoware.com', invoiceDate: '2024-04-20', dueDate: '2024-05-05', status: 'Overdue', items: [{description: 'Custom Development Work', quantity:10, unitPrice: 87.52}], notes: 'Payment is overdue. Please contact us immediately.', subtotal: 875.20, tax: 0, discount: 50, totalAmount: 825.20 },
  { id: 'INV-004', clientName: 'Delta LLC', clientEmail: 'info@delta.com', clientAddress: '101 Delta Street, Commerce City, GA 30301', companyName: 'WeHowAre Inc.', companyAddress: '456 Solutions Ave, Silicon Valley, CA 94016', companyEmail: 'billing@wehoware.com', invoiceDate: '2024-05-12', dueDate: '2024-05-28', status: 'Paid', items: [{description: 'Monthly Retainer', quantity:1, unitPrice:300.00}], notes: '', subtotal: 300.00, tax: 30.00, discount: 0, totalAmount: 330.00 },
  { id: 'INV-005', clientName: 'Epsilon Exports', clientEmail: 'hello@epsilon.io', clientAddress: '202 Epsilon Ave, Trade Town, WA 98001', companyName: 'WeHowAre Inc.', companyAddress: '456 Solutions Ave, Silicon Valley, CA 94016', companyEmail: 'billing@wehoware.com', invoiceDate: '2024-06-01', dueDate: '2024-06-15', status: 'Draft', items: [{description: 'Product Sale', quantity:10, unitPrice:12.00}], notes: 'Awaiting final confirmation.', subtotal: 120.00, tax: 0, discount: 0, totalAmount: 120.00 },
];

const fetchInvoiceById = async (id) => {
  console.log(`Fetching invoice details for ID: ${id}`);
  await new Promise(resolve => setTimeout(resolve, 300));
  return allMockInvoices.find(inv => inv.id === id) || null;
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
    if (invoiceId) {
      setLoading(true);
      fetchInvoiceById(invoiceId)
        .then(data => {
          if (data) setInvoice(data);
          else setError('Invoice not found.');
        })
        .catch(err => {
          console.error('Error fetching invoice:', err);
          setError('Failed to load invoice data.');
        })
        .finally(() => setLoading(false));
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
        title={`Invoice #${invoice.id}`}
        description={`Details for invoice sent to ${invoice.clientName}.`}
        backLink="/admin/invoices"
        backIcon={<ArrowLeft className="mr-2 h-4 w-4" />}
        primaryActionLabel="Edit Invoice"
        primaryActionIcon={<Edit3 className="mr-2 h-4 w-4" />}
        onPrimaryAction={() => router.push(`/admin/invoices/edit/${invoice.id}`)}
        secondaryActionLabel="Print Invoice"
        secondaryActionIcon={<Printer className="mr-2 h-4 w-4" />}
        onSecondaryAction={() => window.print()}
      />

      <Card className="mt-6 shadow-lg">
        <CardHeader className="bg-gray-100 border-b p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start">
            <div>
              <CardTitle className="text-3xl font-bold text-blue-700">INVOICE</CardTitle>
              <CardDescription className="text-gray-600 text-md"># {invoice.id}</CardDescription>
            </div>
            <div className="mt-4 sm:mt-0 text-left sm:text-right">
              <InvoiceStatusBadge status={invoice.status} />
              <p className="text-sm text-gray-500 mt-2">Issued: {new Date(invoice.invoiceDate).toLocaleDateString()}</p>
              {invoice.dueDate && <p className="text-sm text-gray-500">Due: {new Date(invoice.dueDate).toLocaleDateString()}</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Billed To:</h3>
              <p className="text-lg font-medium text-gray-800">{invoice.clientName}</p>
              <p className="text-gray-600">{invoice.clientEmail}</p>
              {invoice.clientAddress && <p className="text-gray-600 whitespace-pre-line">{invoice.clientAddress}</p>}
            </div>
            <div className="text-left md:text-right">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">From:</h3>
              <p className="text-lg font-medium text-gray-800">{invoice.companyName || 'Your Company Name'}</p>
              <p className="text-gray-600">{invoice.companyEmail || 'yourcompany@example.com'}</p>
              {invoice.companyAddress && <p className="text-gray-600 whitespace-pre-line">{invoice.companyAddress}</p>}
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
                {invoice.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="py-3 px-4 font-medium">{item.description}</TableCell>
                    <TableCell className="py-3 px-4 text-right">{item.quantity}</TableCell>
                    <TableCell className="py-3 px-4 text-right">${item.unitPrice.toFixed(2)}</TableCell>
                    <TableCell className="py-3 px-4 text-right font-medium">${(item.quantity * item.unitPrice).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end mb-8">
            <div className="w-full sm:w-auto min-w-[280px] md:min-w-[320px]">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Subtotal:</span>
                <span className="text-gray-800 font-medium">${(invoice.subtotal || 0).toFixed(2)}</span>
              </div>
              {invoice.tax > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Tax:</span>
                  <span className="text-gray-800 font-medium">${(invoice.tax || 0).toFixed(2)}</span>
                </div>
              )}
              {invoice.discount > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Discount:</span>
                  <span className="text-gray-800 font-medium">-${(invoice.discount || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 mt-2 bg-gray-100 px-4 rounded-md">
                <span className="text-lg font-bold text-gray-800">Total:</span>
                <span className="text-lg font-bold text-gray-800">${(invoice.totalAmount || 0).toFixed(2)}</span>
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
            <p>If you have any questions concerning this invoice, please contact: {invoice.companyEmail || '[Your Company Email]'}</p>
          </footer>
        </CardContent>
      </Card>
    </div>
  );
}
