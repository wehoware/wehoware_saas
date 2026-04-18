"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import InvoiceForm from "@/components/invoice/InvoiceForm";

export default function EditInvoicePage() {
  const router = useRouter();
  const { id: invoiceId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!invoiceId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/invoices/${invoiceId}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Invoice not found");
        }
        const json = await res.json();
        setInvoice(json.data ?? json);
      } catch (err) {
        setError(err.message || "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId]);

  const handleSubmit = async (formData) => {
    const res = await fetch(`/api/v1/invoices/${invoiceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "Failed to update invoice");
    }
    toast.success("Invoice updated successfully!");
    router.push("/admin/invoices");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="container mx-auto py-6 px-4 text-center">
        <p className="text-red-600">{error || "Invoice not found."}</p>
        <Link href="/admin/invoices" className="text-blue-600 hover:underline mt-4 inline-block">
          Go back to Invoices
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <AdminPageHeader
        title={`Edit Invoice ${invoice.invoice_number}`}
        description={`Update details for ${invoice.client_name}`}
        backLink="/admin/invoices"
        backIcon={<ArrowLeft className="mr-2 h-4 w-4" />}
      />
      <div className="mt-6">
        <InvoiceForm initialData={invoice} onSubmit={handleSubmit} isEditing={true} />
      </div>
    </div>
  );
}
