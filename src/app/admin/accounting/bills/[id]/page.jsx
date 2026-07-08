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
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Edit,
  Loader2,
  CreditCard,
  CalendarDays,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import { formatMoney, PAYMENT_METHODS } from "@/lib/accounting";
import { useAuth } from "@/contexts/auth-context";
import AttachmentUploader from "@/components/attachments/AttachmentUploader";

const STATUS_COLORS = {
  Draft: "bg-gray-100 text-gray-700 border border-gray-200",
  Open: "bg-blue-100 text-blue-700 border border-blue-200",
  "Partially Paid": "bg-amber-100 text-amber-700 border border-amber-200",
  Paid: "bg-green-100 text-green-700 border border-green-200",
  Overdue: "bg-red-100 text-red-700 border border-red-200",
  Void: "bg-gray-200 text-gray-600 border border-gray-300",
};

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

const TODAY = new Date().toISOString().slice(0, 10);

export default function BillViewPage() {
  const router = useRouter();
  const params = useParams();
  const { activeClient } = useAuth();
  const billId = params?.id;

  const [bill, setBill] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payment, setPayment] = useState({
    payment_date: TODAY,
    amount: 0,
    method: "Bank Transfer",
    reference: "",
    notes: "",
  });
  const [isRecording, setIsRecording] = useState(false);

  async function loadBill() {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/bills/${billId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to load bill");
      }
      const data = await res.json();
      setBill(data);
      setPayment((prev) => ({
        ...prev,
        amount: Number(data.amount_due) || 0,
      }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (billId) loadBill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId, activeClient?.id]);

  async function recordPayment() {
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be positive");
      return;
    }
    try {
      setIsRecording(true);
      const res = await fetch(`/api/v1/bills/${billId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payment),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record payment");
      toast.success("Payment recorded");
      setPaymentOpen(false);
      await loadBill();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsRecording(false);
    }
  }

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
        Loading bill…
      </div>
    );
  }
  if (!bill) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Bill not found.{" "}
        <Button variant="link" onClick={() => router.push("/admin/accounting/bills")}>
          Back to bills
        </Button>
      </div>
    );
  }

  const canRecordPayment =
    !["Draft", "Paid", "Void"].includes(bill.status) &&
    Number(bill.amount_due) > 0;

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title={`Bill ${bill.bill_number}`}
        description={bill.vendor?.name || "—"}
        backLink="/admin/accounting/bills"
        backIcon={<ArrowLeft size={16} />}
        actionLabel="Edit"
        actionIcon={<Edit size={16} />}
        onAction={() =>
          router.push(`/admin/accounting/bills/${bill.id}/edit`)
        }
        secondaryActionLabel={canRecordPayment ? "Record Payment" : null}
        secondaryActionIcon={<CreditCard size={16} />}
        onSecondaryAction={
          canRecordPayment ? () => setPaymentOpen(true) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Bill Details</CardTitle>
                <Badge className={STATUS_COLORS[bill.status] ?? STATUS_COLORS.Draft}>
                  {bill.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              <Detail label="Vendor" value={bill.vendor?.name || "—"} />
              <Detail label="Reference" value={bill.reference || "—"} />
              <Detail label="Bill Date" value={fmtDate(bill.bill_date)} />
              <Detail label="Due Date" value={fmtDate(bill.due_date)} />
              {bill.notes && (
                <div className="sm:col-span-2 pt-2 border-t">
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="mt-1 whitespace-pre-wrap">{bill.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left border-b">
                  <tr>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.line_items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-muted-foreground"
                      >
                        No line items
                      </td>
                    </tr>
                  ) : (
                    bill.line_items.map((li) => (
                      <tr key={li.id} className="border-b last:border-0">
                        <td className="py-2">{li.description}</td>
                        <td className="py-2 text-right">{li.quantity}</td>
                        <td className="py-2 text-right">
                          {formatMoney(li.unit_price, bill.currency)}
                        </td>
                        <td className="py-2 text-right">
                          {formatMoney(li.total, bill.currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Payment History
              </CardTitle>
              <CardDescription>
                {bill.payments.length}{" "}
                {bill.payments.length === 1 ? "payment" : "payments"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bill.payments.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No payments recorded yet
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left border-b">
                    <tr>
                      <th className="py-2">Date</th>
                      <th className="py-2">Method</th>
                      <th className="py-2">Reference</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.payments.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">{fmtDate(p.payment_date)}</td>
                        <td className="py-2">{p.method || "—"}</td>
                        <td className="py-2">{p.reference || "—"}</td>
                        <td className="py-2 text-right">
                          {formatMoney(p.amount, bill.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
              <CardDescription>Receipts, invoices, and supporting documents</CardDescription>
            </CardHeader>
            <CardContent>
              <AttachmentUploader
                entityId={bill.id}
                entityType="bills"
                attachments={bill.attachments || []}
                onAttachmentsChange={(updated) =>
                  setBill((prev) => ({ ...prev, attachments: updated }))
                }
              />
            </CardContent>
          </Card>
        </div>

        <Card className="border border-gray-200 shadow-sm h-fit sticky top-4">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatMoney(bill.subtotal, bill.currency)} />
            <Row label={`Tax (${Number(bill.tax_rate).toFixed(2)}%)`} value={formatMoney(bill.tax_amount, bill.currency)} />
            <div className="border-t pt-2">
              <Row
                label={<strong>Total</strong>}
                value={<strong>{formatMoney(bill.total, bill.currency)}</strong>}
              />
            </div>
            <Row
              label="Paid"
              value={formatMoney(bill.amount_paid, bill.currency)}
            />
            <div className="border-t pt-2">
              <Row
                label={<strong>Amount Due</strong>}
                value={
                  <strong className={Number(bill.amount_due) > 0 ? "text-red-700" : "text-green-700"}>
                    {formatMoney(bill.amount_due, bill.currency)}
                  </strong>
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Record payment sheet */}
      <Sheet open={paymentOpen} onOpenChange={setPaymentOpen}>
        <SheetContent className="sm:max-w-md w-full">
          <SheetHeader>
            <SheetTitle>Record Payment</SheetTitle>
            <SheetDescription>
              Mark a payment against {bill.bill_number}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label htmlFor="pay-date">Payment Date *</Label>
              <Input
                id="pay-date"
                type="date"
                value={payment.payment_date}
                onChange={(e) =>
                  setPayment((prev) => ({ ...prev, payment_date: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="pay-amount">Amount *</Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={bill.amount_due}
                value={payment.amount}
                onChange={(e) =>
                  setPayment((prev) => ({ ...prev, amount: e.target.value }))
                }
              />
              <div className="text-xs text-muted-foreground mt-1">
                Outstanding: {formatMoney(bill.amount_due, bill.currency)}
              </div>
            </div>
            <div>
              <Label htmlFor="pay-method">Method</Label>
              <Select
                value={payment.method}
                onValueChange={(v) =>
                  setPayment((prev) => ({ ...prev, method: v }))
                }
              >
                <SelectTrigger id="pay-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pay-ref">Reference</Label>
              <Input
                id="pay-ref"
                value={payment.reference}
                onChange={(e) =>
                  setPayment((prev) => ({ ...prev, reference: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="pay-notes">Notes</Label>
              <textarea
                id="pay-notes"
                className="w-full mt-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
                rows={2}
                value={payment.notes}
                onChange={(e) =>
                  setPayment((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setPaymentOpen(false)}
              disabled={isRecording}
            >
              Cancel
            </Button>
            <Button onClick={recordPayment} disabled={isRecording}>
              {isRecording ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Record Payment"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
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
