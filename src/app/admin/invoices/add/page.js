"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import AdminPageHeader from "@/components/AdminPageHeader";
import InvoiceForm from "@/components/invoice/InvoiceForm";
import { ArrowLeft } from "lucide-react";

export default function AddInvoicePage() {
  const router = useRouter();

  const handleSubmit = async (formData) => {
    const res = await fetch("/api/v1/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "Failed to create invoice");
    }
    toast.success("Invoice created successfully!");
    router.push("/admin/invoices");
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
        <InvoiceForm onSubmit={handleSubmit} isEditing={false} />
      </div>
    </div>
  );
}
