"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import InvoiceForm from '@/components/invoice/InvoiceForm';

// Mock data - this would typically come from your main invoices page or a shared store/context
const allMockInvoices = [
  { id: 'INV-001', clientName: 'Acme Corp', clientEmail: 'contact@acme.com', invoiceDate: '2024-05-01', dueDate: '2024-05-15', status: 'Paid', items: [{description: 'Web Design Package', quantity:1, unitPrice: 1200.00}, {description: 'Premium Hosting (1 Year)', quantity:1, unitPrice:300.50}], notes: 'Thank you for your continued business! Payment can be made via bank transfer or PayPal.', totalAmount: 1500.50 },
  { id: 'INV-002', clientName: 'Beta Solutions', clientEmail: 'info@beta.dev', invoiceDate: '2024-05-10', dueDate: '2024-05-25', status: 'Pending', items: [{description: 'Hourly Consulting Services', quantity:5, unitPrice: 50.10}, {description: 'Software License', quantity:2, unitPrice:75.00}], notes: 'Please remit payment by the due date.', totalAmount: 400.50 },
  { id: 'INV-003', clientName: 'Gamma Inc.', clientEmail: 'accounts@gamma.co', invoiceDate: '2024-04-20', dueDate: '2024-05-05', status: 'Overdue', items: [{description: 'Custom Development Work', quantity:10, unitPrice: 87.52}], notes: 'Payment is overdue. Please contact us immediately.', totalAmount: 875.20 },
  { id: 'INV-004', clientName: 'Delta LLC', clientEmail: 'info@delta.com', invoiceDate: '2024-05-12', dueDate: '2024-05-28', status: 'Paid', items: [{description: 'Monthly Retainer', quantity:1, unitPrice:300.00}], notes: '', totalAmount: 300.00 },
  { id: 'INV-005', clientName: 'Epsilon Exports', clientEmail: 'hello@epsilon.io', invoiceDate: '2024-06-01', dueDate: '2024-06-15', status: 'Draft', items: [{description: 'Product Sale', quantity:10, unitPrice:12.00}], notes: 'Awaiting final confirmation.', totalAmount: 120.00 },
];

// Mock data fetching function - replace with actual API call
const fetchInvoiceById = async (id) => {
  console.log(`Fetching invoice details for ID: ${id}`);
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API delay
  return allMockInvoices.find(inv => inv.id === id) || null;
};

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id; // Correctly use params.id based on folder structure [id]
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (invoiceId) {
      setLoading(true);
      fetchInvoiceById(invoiceId)
        .then(data => {
          if (data) {
            setInvoice(data);
          } else {
            setError('Invoice not found.');
          }
        })
        .catch(err => {
          console.error('Error fetching invoice:', err);
          setError('Failed to load invoice data.');
        })
        .finally(() => setLoading(false));
    }
  }, [invoiceId]);

  const handleSubmit = async (formData) => {
    // In a real application, you would send this data to your API
    console.log('Updating invoice:', invoiceId, formData);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For now, we'll just log it and navigate back
    // You might want to show a success toast message here
    alert(`Invoice ${invoiceId} updated successfully! (Mock)`); // Replace with a proper toast notification
    router.push('/admin/invoices'); 
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 flex justify-center items-center min-h-[300px]">
        <p className="text-gray-600">Loading invoice details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 text-center">
        <p className="text-red-600">Error: {error}</p>
        <Link href="/admin/invoices" className="text-blue-600 hover:underline mt-4 inline-block">
          Go back to Invoices
        </Link>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 text-center">
        <p className="text-gray-600">Invoice not found.</p>
        <Link href="/admin/invoices" className="text-blue-600 hover:underline mt-4 inline-block">
          Go back to Invoices
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <AdminPageHeader
        title={`Edit Invoice #${invoiceId}`}
        description={`Update the details for invoice sent to ${invoice.clientName}.`}
        backLink="/admin/invoices"
        backIcon={<ArrowLeft className="mr-2 h-4 w-4" />}
      />
      <div className="mt-6">
        <InvoiceForm 
          initialData={invoice} 
          onSubmit={handleSubmit} 
          isEditing={true} 
        />
      </div>
    </div>
  );
}