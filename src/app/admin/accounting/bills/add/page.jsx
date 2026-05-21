"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

const TODAY = new Date().toISOString().slice(0, 10);
const NET30 = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
})();

const EMPTY_LINE = { description: "", quantity: 1, unit_price: 0 };

export default function AddBillPage() {
  const router = useRouter();
  const { activeClient } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [isLoadingVendors, setIsLoadingVendors] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    vendor_id: "",
    bill_number: "",
    reference: "",
    bill_date: TODAY,
    due_date: NET30,
    status: "Open",
    currency: "CAD",
    tax_rate: 0,
    notes: "",
    line_items: [{ ...EMPTY_LINE }],
  });

  useEffect(() => {
    let cancelled = false;
    async function loadVendors() {
      try {
        setIsLoadingVendors(true);
        const res = await fetch("/api/v1/vendors?active=true&limit=100");
        if (!res.ok) throw new Error("Failed to load vendors");
        const json = await res.json();
        if (!cancelled) setVendors(json.data || []);
      } catch (err) {
        toast.error(err.message);
      } finally {
        if (!cancelled) setIsLoadingVendors(false);
      }
    }
    loadVendors();
    return () => {
      cancelled = true;
    };
  }, [activeClient?.id]);

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
      return {
        ...prev,
        line_items: prev.line_items.filter((_, i) => i !== idx),
      };
    });
  }

  async function save() {
    if (!form.vendor_id) {
      toast.error("Please select a vendor");
      return;
    }
    if (form.line_items.length === 0) {
      toast.error("At least one line item is required");
      return;
    }
    try {
      setIsSaving(true);
      const res = await fetch("/api/v1/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create bill");
      toast.success("Bill created");
      router.push(`/admin/accounting/bills/${json.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title="New Bill"
        description="Record a bill from a vendor"
        backLink="/admin/accounting/bills"
        backIcon={<ArrowLeft size={16} />}
        actionLabel={isSaving ? "Saving…" : "Save Bill"}
        actionIcon={isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        onAction={save}
        actionDisabled={isSaving || isLoadingVendors}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Bill Details</CardTitle>
              <CardDescription>
                Vendor, dates, and reference numbers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="vendor">Vendor *</Label>
                  <Select
                    value={form.vendor_id}
                    onValueChange={(v) => setField("vendor_id", v)}
                    disabled={isLoadingVendors}
                  >
                    <SelectTrigger id="vendor">
                      <SelectValue
                        placeholder={
                          isLoadingVendors ? "Loading…" : "Select vendor"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No vendors. Create one first.
                        </div>
                      ) : (
                        vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bill-number">Bill Number</Label>
                  <Input
                    id="bill-number"
                    placeholder="Auto-generated if blank"
                    value={form.bill_number}
                    onChange={(e) => setField("bill_number", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bill-date">Bill Date *</Label>
                  <Input
                    id="bill-date"
                    type="date"
                    value={form.bill_date}
                    onChange={(e) => setField("bill_date", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="due-date">Due Date *</Label>
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
                      {BILL_STATUSES.filter((s) => s !== "Paid" && s !== "Partially Paid").map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>What you were billed for</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {form.line_items.map((li, idx) => (
                  <LineItemRow
                    key={idx}
                    line={li}
                    onChange={(k, v) => setLine(idx, k, v)}
                    onRemove={() => removeLine(idx)}
                    canRemove={form.line_items.length > 1}
                  />
                ))}
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" /> Add line item
                </Button>
              </div>
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
                placeholder="Internal notes for this bill"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Totals */}
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

function LineItemRow({ line, onChange, onRemove, canRemove }) {
  const total = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
  return (
    <div className="grid gap-2 sm:grid-cols-12 items-end p-2 border border-gray-100 rounded-md">
      <div className="sm:col-span-6">
        <Input
          placeholder="Description"
          value={line.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Qty"
          value={line.quantity}
          onChange={(e) => onChange("quantity", Number(e.target.value) || 0)}
        />
      </div>
      <div className="sm:col-span-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Unit Price"
          value={line.unit_price}
          onChange={(e) => onChange("unit_price", Number(e.target.value) || 0)}
        />
      </div>
      <div className="sm:col-span-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{formatMoney(total)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
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
