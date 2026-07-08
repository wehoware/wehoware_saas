"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  Save,
  Receipt,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import { BILL_STATUSES, formatMoney, computeLineItemTotals } from "@/lib/accounting";
import { useAuth } from "@/contexts/auth-context";
import AttachmentUploader from "@/components/attachments/AttachmentUploader";

const EMPTY_LINE = { description: "", quantity: 1, unit_price: 0 };

function toIsoDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default function EditBillPage() {
  const router = useRouter();
  const params = useParams();
  const { activeClient } = useAuth();
  const billId = params?.id;

  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        const [billRes, vendorRes] = await Promise.all([
          fetch(`/api/v1/bills/${billId}`),
          fetch("/api/v1/vendors?active=true&limit=100"),
        ]);
        if (!billRes.ok) {
          const j = await billRes.json().catch(() => ({}));
          throw new Error(j.error || "Failed to load bill");
        }
        const bill = await billRes.json();
        const vendorJson = vendorRes.ok ? await vendorRes.json() : { data: [] };
        if (cancelled) return;
        setVendors(vendorJson.data || []);
        setAttachments(bill.attachments || []);
        setForm({
          vendor_id: bill.vendor_id,
          bill_number: bill.bill_number,
          reference: bill.reference || "",
          bill_date: toIsoDate(bill.bill_date),
          due_date: toIsoDate(bill.due_date),
          status: bill.status,
          currency: bill.currency,
          tax_rate: Number(bill.tax_rate) || 0,
          notes: bill.notes || "",
          line_items:
            bill.line_items.length > 0
              ? bill.line_items.map((li) => ({
                  description: li.description,
                  quantity: Number(li.quantity),
                  unit_price: Number(li.unit_price),
                }))
              : [{ ...EMPTY_LINE }],
        });
      } catch (err) {
        toast.error(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    if (billId) load();
    return () => {
      cancelled = true;
    };
  }, [billId, activeClient?.id]);

  if (isLoading || !form) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
        Loading…
      </div>
    );
  }

  const totals = computeLineItemTotals(form.line_items, form.tax_rate);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function setLine(idx, key, value) {
    setForm((prev) => {
      const next = [...prev.line_items];
      next[idx] = { ...next[idx], [key]: value };
      return { ...prev, line_items: next };
    });
  }
  function addLine() {
    setForm((prev) => ({
      ...prev,
      line_items: [...prev.line_items, { ...EMPTY_LINE }],
    }));
  }
  function removeLine(idx) {
    setForm((prev) => {
      if (prev.line_items.length === 1) return prev;
      return { ...prev, line_items: prev.line_items.filter((_, i) => i !== idx) };
    });
  }

  async function save() {
    if (!form.vendor_id) {
      toast.error("Please select a vendor");
      return;
    }
    try {
      setIsSaving(true);
      const res = await fetch(`/api/v1/bills/${billId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update bill");
      toast.success("Bill updated");
      router.push(`/admin/accounting/bills/${billId}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title={`Edit ${form.bill_number}`}
        description="Update bill details and line items"
        backLink={`/admin/accounting/bills/${billId}`}
        backIcon={<ArrowLeft size={16} />}
        actionLabel={isSaving ? "Saving…" : "Save Changes"}
        actionIcon={isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        onAction={save}
        actionDisabled={isSaving}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Bill Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="vendor">Vendor *</Label>
                <Select
                  value={form.vendor_id}
                  onValueChange={(v) => setField("vendor_id", v)}
                >
                  <SelectTrigger id="vendor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bill-number">Bill Number</Label>
                <Input
                  id="bill-number"
                  value={form.bill_number}
                  onChange={(e) => setField("bill_number", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="bill-date">Bill Date</Label>
                <Input
                  id="bill-date"
                  type="date"
                  value={form.bill_date}
                  onChange={(e) => setField("bill_date", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="due-date">Due Date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setField("due_date", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="reference">Reference / PO #</Label>
                <Input
                  id="reference"
                  value={form.reference}
                  onChange={(e) => setField("reference", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setField("status", v)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>Updating line items recalculates totals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {form.line_items.map((li, idx) => {
                const lineTotal =
                  (Number(li.quantity) || 0) * (Number(li.unit_price) || 0);
                return (
                  <div
                    key={idx}
                    className="grid gap-2 sm:grid-cols-12 items-end p-2 border border-gray-100 rounded-md"
                  >
                    <div className="sm:col-span-6">
                      <Input
                        placeholder="Description"
                        value={li.description}
                        onChange={(e) =>
                          setLine(idx, "description", e.target.value)
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Qty"
                        value={li.quantity}
                        onChange={(e) =>
                          setLine(idx, "quantity", Number(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Unit Price"
                        value={li.unit_price}
                        onChange={(e) =>
                          setLine(idx, "unit_price", Number(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {formatMoney(lineTotal, form.currency)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(idx)}
                        disabled={form.line_items.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" /> Add line item
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                rows={3}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
              <CardDescription>Receipts, invoices, and supporting documents</CardDescription>
            </CardHeader>
            <CardContent>
              <AttachmentUploader
                entityId={billId}
                entityType="bills"
                attachments={attachments}
                onAttachmentsChange={setAttachments}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="border border-gray-200 shadow-sm h-fit sticky top-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Totals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Subtotal" value={formatMoney(totals.subtotal, form.currency)} />
            <div>
              <Label htmlFor="tax-rate">Tax rate (%)</Label>
              <Input
                id="tax-rate"
                type="number"
                step="0.01"
                min="0"
                value={form.tax_rate}
                onChange={(e) => setField("tax_rate", Number(e.target.value) || 0)}
              />
            </div>
            <Row label="Tax" value={formatMoney(totals.taxAmount, form.currency)} />
            <div className="border-t pt-2">
              <Row
                label={<strong>Total</strong>}
                value={
                  <strong>{formatMoney(totals.total, form.currency)}</strong>
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
