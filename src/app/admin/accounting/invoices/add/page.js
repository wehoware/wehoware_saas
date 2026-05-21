"use client";

/**
 * /admin/accounting/invoices/add
 *
 * Composes:
 *   - InvoiceForm (controlled)
 *   - InvoiceSettingsSheet (per-tenant settings, gear icon)
 *   - CloneInvoiceSheet (copy from a previous invoice)
 *
 * Settings are fetched once on mount and refreshed whenever the user saves
 * the settings sheet, so InvoiceForm always sees current defaults.
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import AdminPageHeader from "@/components/AdminPageHeader";
import InvoiceForm from "@/components/invoice/InvoiceForm";
import InvoiceSettingsSheet from "@/components/invoice/InvoiceSettingsSheet";
import CloneInvoiceSheet from "@/components/invoice/CloneInvoiceSheet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Copy } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export default function AddInvoicePage() {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [defaults, setDefaults] = useState(null);
  const [cloneSource, setCloneSource] = useState(null);
  const { activeClient } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/invoice-settings");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setDefaults(data);
      } catch {
        // Non-fatal: form will use built-in defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeClient?.id]);

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
    router.push("/admin/accounting/invoices");
  };

  const handleSettingsSaved = (next) => {
    setDefaults(next);
  };

  const handleClone = (sourceInvoice) => {
    if (!sourceInvoice) return;
    // Strip identifiers and dates so the cloned invoice is treated as new.
    setCloneSource({
      client_name: sourceInvoice.client_name ?? "",
      client_email: sourceInvoice.client_email ?? "",
      currency: sourceInvoice.currency ?? defaults?.default_currency ?? "CAD",
      tax_rate: sourceInvoice.tax_rate ?? defaults?.default_tax_rate ?? 0,
      notes: sourceInvoice.notes ?? "",
      line_items: Array.isArray(sourceInvoice.line_items)
        ? sourceInvoice.line_items.map((li) => ({
            description: li.description ?? "",
            quantity: li.quantity ?? 1,
            unit_price: li.unit_price ?? li.unitPrice ?? 0,
          }))
        : [],
      // Reset fields not appropriate to clone
      invoice_date: undefined,
      due_date: undefined,
      status: "Draft",
      id: undefined,
      // Cache-bust the form's useEffect dep
      _clonedFrom: sourceInvoice.id,
    });
    toast.success(
      `Cloned from ${sourceInvoice.invoice_number || "selected invoice"}`
    );
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <AdminPageHeader
        title="Create New Invoice"
        description="Fill in the details below to create a new invoice."
        backLink="/admin/accounting/invoices"
        backIcon={<ArrowLeft className="mr-2 h-4 w-4" />}
      />

      <div className="flex justify-end gap-2 mb-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setCloneOpen(true)}
        >
          <Copy className="mr-2 h-4 w-4" /> Clone from invoice
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setSettingsOpen(true)}
          aria-label="Invoice settings"
        >
          <Settings className="mr-2 h-4 w-4" /> Settings
        </Button>
      </div>

      <div className="mt-2">
        <InvoiceForm
          initialData={cloneSource}
          defaults={defaults}
          onSubmit={handleSubmit}
          isEditing={false}
        />
      </div>

      <InvoiceSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={handleSettingsSaved}
      />

      <CloneInvoiceSheet
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        onClone={handleClone}
      />
    </div>
  );
}
