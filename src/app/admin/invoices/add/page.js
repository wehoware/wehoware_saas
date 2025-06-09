"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import AdminPageHeader from '@/components/AdminPageHeader';
import InvoiceForm from '@/components/invoice/InvoiceForm'; // Assuming InvoiceForm.jsx is in this path
import { ArrowLeft } from 'lucide-react';

export default function AddInvoicePage() {
  const router = useRouter();

  const handleSubmit = async (formData) => {
    // In a real application, you would send this data to your API
    console.log('Submitting new invoice:', formData);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    
    // For now, we'll just log it and navigate back
    // You might want to show a success toast message here
    alert('Invoice created successfully! (Mock)'); // Replace with a proper toast notification
    router.push('/admin/invoices'); 
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <AdminPageHeader
        title="Create New Invoice"
        description="Fill in the details below to create a new invoice."
        backLink="/admin/invoices"
        backIcon={<ArrowLeft className="mr-2 h-4 w-4" />}
      />
      <div className="mt-6">
        <InvoiceForm 
          onSubmit={handleSubmit} 
          isEditing={false} 
        />
      </div>
    </div>
  );
}
