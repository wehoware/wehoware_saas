"use client";

/**
 * InvoiceSettingsSheet
 *
 * Side sheet for managing per-tenant invoice settings:
 *   - Company identity (name, email, phone, tax #, address)
 *   - Logo (uploaded via /api/v1/uploads under entity 'invoices')
 *   - Invoice number format (e.g. INV-{YYYY}-{XXXX}) and starting sequence
 *   - Default currency / tax rate / notes for new invoices
 *
 * Persists via PUT /api/v1/invoice-settings. Calls onSaved(settings) so
 * parents (e.g. the create-invoice page) can refresh form defaults.
 */
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, UploadCloud, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SelectInput from "@/components/ui/select";
import { uploadThumbnail, deleteThumbnailByUrl } from "@/lib/uploadClient";
import { formatInvoiceNumber } from "@/lib/invoiceNumber";
import { DEFAULT_TEMPLATE_ID, getTemplateById } from "@/lib/invoiceTemplates";
import InvoiceTemplatePicker from "@/components/invoice/InvoiceTemplatePicker";
import InvoiceTemplateCustomizer from "@/components/invoice/InvoiceTemplateCustomizer";

const CURRENCY_OPTIONS = [
  { value: "CAD", label: "CAD (Canadian Dollar)" },
  { value: "USD", label: "USD (US Dollar)" },
  { value: "EUR", label: "EUR (Euro)" },
  { value: "GBP", label: "GBP (British Pound)" },
  { value: "INR", label: "INR (Indian Rupee)" },
  { value: "AUD", label: "AUD (Australian Dollar)" },
];

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB cap on the client
const MAX_TAX_RATE = 100;
const ENTITY_TYPE = "invoices";

function buildEmpty() {
  return {
    company_name: "",
    company_email: "",
    company_phone: "",
    company_address: "",
    tax_number: "",
    logo_url: "",
    invoice_format: "INV-{YYYY}-{XXXX}",
    next_invoice_number: 1,
    default_currency: "CAD",
    default_tax_rate: 0,
    default_notes: "",
    template_id: DEFAULT_TEMPLATE_ID,
    template_config: null,
  };
}

export default function InvoiceSettingsSheet({ open, onOpenChange, onSaved }) {
  const [form, setForm] = useState(buildEmpty);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Fetch settings each time the sheet opens so user always sees latest state.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/v1/invoice-settings");
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Failed to load invoice settings");
        }
        const data = await res.json();
        if (!cancelled) {
          setForm({
            company_name: data.company_name ?? "",
            company_email: data.company_email ?? "",
            company_phone: data.company_phone ?? "",
            company_address: data.company_address ?? "",
            tax_number: data.tax_number ?? "",
            logo_url: data.logo_url ?? "",
            invoice_format: data.invoice_format || "INV-{YYYY}-{XXXX}",
            next_invoice_number: data.next_invoice_number ?? 1,
            default_currency: data.default_currency || "CAD",
            default_tax_rate: Number(data.default_tax_rate ?? 0),
            default_notes: data.default_notes ?? "",
            template_id: data.template_id || DEFAULT_TEMPLATE_ID,
            template_config: data.template_config ?? null,
          });
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message || "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image file");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(`Logo must be smaller than ${MAX_LOGO_BYTES / (1024 * 1024)}MB`);
      return;
    }
    try {
      setUploading(true);
      const url = await uploadThumbnail(file, ENTITY_TYPE);
      update("logo_url", url);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err.message || "Logo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!form.logo_url) return;
    const previous = form.logo_url;
    update("logo_url", "");
    deleteThumbnailByUrl(previous).catch(() => {
      /* non-fatal: file cleanup happens on next save */
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const seq = Number(form.next_invoice_number);
    if (!Number.isFinite(seq) || seq < 1) {
      toast.error("Starting invoice number must be a positive integer");
      return;
    }
    if (!form.invoice_format.includes("{X")) {
      toast.error('Invoice format must contain a sequence placeholder, e.g. "{XXXX}"');
      return;
    }
    const taxRate = Number(form.default_tax_rate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > MAX_TAX_RATE) {
      toast.error(`Default tax rate must be between 0 and ${MAX_TAX_RATE}`);
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/v1/invoice-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company_name,
          company_email: form.company_email,
          company_phone: form.company_phone,
          company_address: form.company_address,
          tax_number: form.tax_number,
          logo_url: form.logo_url || null,
          invoice_format: form.invoice_format,
          next_invoice_number: Math.floor(seq),
          default_currency: form.default_currency,
          default_tax_rate: taxRate,
          default_notes: form.default_notes,
          template_id: form.template_id || DEFAULT_TEMPLATE_ID,
          template_config: form.template_config,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to save settings");
      }
      const updated = await res.json();
      toast.success("Invoice settings saved");
      onSaved?.(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const previewNumber = formatInvoiceNumber(
    form.invoice_format,
    Number(form.next_invoice_number) || 1,
    new Date()
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Invoice Settings</SheetTitle>
          <SheetDescription>
            Defaults applied to every new invoice for the active client.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 mt-4 pb-8">
            {/* Company */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Company</h3>
              <div>
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={form.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  placeholder="Acme Inc."
                  maxLength={255}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="company_email">Email</Label>
                  <Input
                    id="company_email"
                    type="email"
                    value={form.company_email}
                    onChange={(e) => update("company_email", e.target.value)}
                    placeholder="billing@example.com"
                    maxLength={255}
                  />
                </div>
                <div>
                  <Label htmlFor="company_phone">Phone</Label>
                  <Input
                    id="company_phone"
                    value={form.company_phone}
                    onChange={(e) => update("company_phone", e.target.value)}
                    placeholder="+1 555 555 5555"
                    maxLength={50}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tax_number">Tax / VAT / GST Number</Label>
                <Input
                  id="tax_number"
                  value={form.tax_number}
                  onChange={(e) => update("tax_number", e.target.value)}
                  placeholder="Optional"
                  maxLength={100}
                />
              </div>
              <div>
                <Label htmlFor="company_address">Address</Label>
                <Textarea
                  id="company_address"
                  value={form.company_address}
                  onChange={(e) => update("company_address", e.target.value)}
                  placeholder="Street, City, Postal Code, Country"
                  rows={3}
                />
              </div>
            </section>

            {/* Logo */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Logo</h3>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-md border border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
                  {form.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.logo_url}
                      alt="Company logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">No logo</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
                    <UploadCloud className="h-4 w-4" />
                    {uploading ? "Uploading..." : "Upload logo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                    />
                  </label>
                  {form.logo_url && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-2 text-xs text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove logo
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Numbering */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Invoice Numbering</h3>
              <div>
                <Label htmlFor="invoice_format">Format</Label>
                <Input
                  id="invoice_format"
                  value={form.invoice_format}
                  onChange={(e) => update("invoice_format", e.target.value)}
                  placeholder="INV-{YYYY}-{XXXX}"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Placeholders:{" "}
                  <code className="font-mono">{"{YYYY}"}</code>{" "}
                  <code className="font-mono">{"{YY}"}</code>{" "}
                  <code className="font-mono">{"{MM}"}</code>{" "}
                  <code className="font-mono">{"{DD}"}</code>{" "}
                  <code className="font-mono">{"{XXXX}"}</code> (sequence padding).
                </p>
              </div>
              <div>
                <Label htmlFor="next_invoice_number">
                  Starting / next invoice number
                </Label>
                <Input
                  id="next_invoice_number"
                  type="number"
                  min={1}
                  step={1}
                  value={form.next_invoice_number}
                  onChange={(e) =>
                    update("next_invoice_number", e.target.value)
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  Next invoice will be numbered <strong>{previewNumber}</strong>.
                </p>
              </div>
            </section>

            {/* Defaults */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">
                Defaults for new invoices
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="default_currency">Currency</Label>
                  <SelectInput
                    id="default_currency"
                    name="default_currency"
                    value={form.default_currency}
                    onChange={(e) => update("default_currency", e.target.value)}
                    options={CURRENCY_OPTIONS}
                  />
                </div>
                <div>
                  <Label htmlFor="default_tax_rate">Tax Rate (%)</Label>
                  <Input
                    id="default_tax_rate"
                    type="number"
                    min={0}
                    max={MAX_TAX_RATE}
                    step={0.01}
                    value={form.default_tax_rate}
                    onChange={(e) => update("default_tax_rate", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="default_notes">Default Notes / Terms</Label>
                <Textarea
                  id="default_notes"
                  rows={3}
                  value={form.default_notes}
                  onChange={(e) => update("default_notes", e.target.value)}
                  placeholder="e.g. Payment due within 30 days."
                />
              </div>
            </section>

            {/* Invoice template */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">
                    Invoice Template
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Pick a base design, then optionally tweak colors and fonts.
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  Selected:{" "}
                  <span className="font-medium text-gray-800">
                    {getTemplateById(form.template_id).name}
                  </span>
                </div>
              </div>
              <InvoiceTemplatePicker
                value={form.template_id}
                onChange={(id) =>
                  setForm((prev) => ({
                    ...prev,
                    template_id: id,
                    // Clear customizations when switching base template so
                    // the user gets the new look untouched.
                    template_config: null,
                  }))
                }
              />
              <details className="rounded-md border border-gray-200 p-3 bg-white">
                <summary className="cursor-pointer text-sm font-medium text-gray-800">
                  Customize colors &amp; fonts
                </summary>
                <div className="mt-3">
                  <InvoiceTemplateCustomizer
                    templateId={form.template_id}
                    value={form.template_config}
                    onChange={(next) =>
                      setForm((prev) => ({ ...prev, template_config: next }))
                    }
                  />
                </div>
              </details>
            </section>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || uploading}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
