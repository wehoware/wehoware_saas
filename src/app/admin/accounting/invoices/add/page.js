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
import { ArrowLeft, Settings, Copy, Info, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export default function AddInvoicePage() {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [defaults, setDefaults] = useState(null);
  const [cloneSource, setCloneSource] = useState(null);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);
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
      } finally {
        if (!cancelled) setIsLoadingDefaults(false);
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
    <div className="py-6 px-4 md:px-6">
      <AdminPageHeader
        title="Create New Invoice"
        description="Fill in the details below to create a new invoice."
        backLink="/admin/accounting/invoices"
        backIcon={<ArrowLeft className="mr-2 h-4 w-4" />}
        actionLabel="Clone from invoice"
        actionIcon={<Copy className="mr-2 h-4 w-4" />}
        onAction={() => setCloneOpen(true)}
        secondaryActionLabel="Settings"
        secondaryActionIcon={<Settings className="mr-2 h-4 w-4" />}
        onSecondaryAction={() => setSettingsOpen(true)}
      />

      {/* Info banner: shows the next invoice number + a tip */}
      {!isLoadingDefaults && defaults?.invoice_format && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 mb-4">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            The next invoice will be numbered automatically based on your
            settings format. Adjust the format or starting number in{" "}
            <button
              type="button"
              className="font-medium underline hover:text-blue-900"
              onClick={() => setSettingsOpen(true)}
            >
              Invoice Settings
            </button>
            .
          </div>
        </div>
      )}

      {isLoadingDefaults ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Loading defaults…</span>
        </div>
      ) : (
        <div className="mt-2">
          <InvoiceForm
            initialData={cloneSource}
            defaults={defaults}
            onSubmit={handleSubmit}
            isEditing={false}
          />
        </div>
      )}

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
