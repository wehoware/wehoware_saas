"use client";

import { useEffect, useState, useMemo } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Loader2,
  RefreshCw,
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  MoreHorizontal,
  Trash2,
  FilterIcon,
  Paperclip,
  Eye,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/auth-context";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  formatMoney,
} from "@/lib/accounting";
import AttachmentUploader from "@/components/attachments/AttachmentUploader";

const TODAY = new Date().toISOString().slice(0, 10);
const STATUS_FILTERS = ["All", ...EXPENSE_STATUSES];

const STATUS_BADGE = {
  Pending: {
    icon: <Clock className="h-3 w-3 mr-1" />,
    className: "bg-amber-100 text-amber-700 border border-amber-200",
  },
  Approved: {
    icon: <CheckCircle className="h-3 w-3 mr-1" />,
    className: "bg-green-100 text-green-700 border border-green-200",
  },
  Rejected: {
    icon: <XCircle className="h-3 w-3 mr-1" />,
    className: "bg-red-100 text-red-700 border border-red-200",
  },
  Reimbursed: {
    icon: <Banknote className="h-3 w-3 mr-1" />,
    className: "bg-blue-100 text-blue-700 border border-blue-200",
  },
};

const EMPTY_FORM = {
  description: "",
  category: "Other",
  amount: 0,
  tax_amount: 0,
  expense_date: TODAY,
  receipt_url: "",
  notes: "",
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

export default function ExpensesPage() {
  const { user, activeClient } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === "admin";

  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [createdExpenseId, setCreatedExpenseId] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  const [approveOpen, setApproveOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [viewAttachments, setViewAttachments] = useState([]);

  async function fetchExpenses(showRefresh = false) {
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      const params = new URLSearchParams({
        limit: "100",
        sortBy: "expenseDate",
        sortOrder: "desc",
      });
      if (statusFilter !== "All") params.set("status", statusFilter);
      const res = await fetch(`/api/v1/expenses?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to fetch expenses");
      }
      const json = await res.json();
      setExpenses(json.data || []);
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient?.id, statusFilter]);

  const stats = useMemo(() => {
    const totalAmount = expenses.reduce(
      (s, e) => s + (Number(e.amount) || 0),
      0
    );
    const pending = expenses.filter((e) => e.status === "Pending").length;
    const approved = expenses.filter((e) => e.status === "Approved").length;
    return { count: expenses.length, totalAmount, pending, approved };
  }, [expenses]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreatedExpenseId(null);
    setCreateOpen(true);
  }

  async function saveExpense() {
    const desc = (form.description || "").trim();
    if (!desc) {
      toast.error("Description is required");
      return;
    }
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      toast.error("Amount must be positive");
      return;
    }
    try {
      setIsSaving(true);
      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          description: desc,
          amount: Number(form.amount),
          tax_amount: Number(form.tax_amount) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit expense");
      toast.success("Expense submitted");
      if (pendingCount > 0) {
        setCreatedExpenseId(json.id);
      } else {
        setCreateOpen(false);
        await fetchExpenses();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function openViewExpense(expense) {
    setViewingExpense(expense);
    setViewAttachments(expense.attachments || []);
    setViewOpen(true);
  }

  function askApprove(expense, action) {
    setPendingAction({ expense, action });
    setRejectReason("");
    setApproveOpen(true);
  }

  async function performAction() {
    if (!pendingAction) return;
    const { expense, action } = pendingAction;
    if (action === "reject" && !rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/expenses/${expense.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: action === "reject" ? rejectReason.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      toast.success(`Expense ${json.status.toLowerCase()}`);
      setApproveOpen(false);
      setPendingAction(null);
      await fetchExpenses();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function askDelete(expense) {
    setExpenseToDelete(expense);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!expenseToDelete) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/v1/expenses/${expenseToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to delete");
      }
      setExpenses((prev) => prev.filter((e) => e.id !== expenseToDelete.id));
      toast.success("Expense deleted");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
      setExpenseToDelete(null);
    }
  }

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title="Expenses"
        description="Submit and track expense claims"
        actionLabel="New Expense"
        actionIcon={<Plus size={16} />}
        onAction={openCreate}
        secondaryActionLabel={isRefreshing ? "Refreshing…" : "Refresh"}
        secondaryActionIcon={
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
        }
        onSecondaryAction={() => fetchExpenses(true)}
        secondaryActionDisabled={isRefreshing || isLoading}
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <SummaryCard label="Total Expenses" value={stats.count} />
        <SummaryCard label="Total Amount" value={formatMoney(stats.totalAmount)} />
        <SummaryCard label="Pending" value={stats.pending} tone="amber" />
        <SummaryCard label="Approved" value={stats.approved} tone="green" />
      </div>

      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>All Expenses</CardTitle>
          <CardDescription>{expenses.length} entries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-end mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FilterIcon className="h-4 w-4 mr-2" />
                  Status: {statusFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {STATUS_FILTERS.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)}>
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
              Loading…
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Wallet className="h-10 w-10 inline-block mb-3 text-gray-300" />
              <div>No expenses yet</div>
              <Button className="mt-3" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Submit your first expense
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Submitter</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => {
                  const badge = STATUS_BADGE[e.status];
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{fmtDate(e.expense_date)}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {e.description}
                          {(e.attachment_count > 0 || (e.attachments && e.attachments.length > 0)) && (
                            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell>
                        {e.submitter
                          ? `${e.submitter.first_name || ""} ${
                              e.submitter.last_name || ""
                            }`.trim() || e.submitter.email
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(e.amount, e.currency)}
                      </TableCell>
                      <TableCell>
                        {badge ? (
                          <Badge className={badge.className}>
                            {badge.icon}
                            {e.status}
                          </Badge>
                        ) : (
                          e.status
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openViewExpense(e)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {isAdmin && e.status === "Pending" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => askApprove(e, "approve")}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => askApprove(e, "reject")}
                                >
                                  <XCircle className="h-4 w-4 mr-2 text-red-600" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {isAdmin && e.status === "Approved" && (
                              <DropdownMenuItem
                                onClick={() => askApprove(e, "reimburse")}
                              >
                                <Banknote className="h-4 w-4 mr-2 text-blue-600" />
                                Mark Reimbursed
                              </DropdownMenuItem>
                            )}
                            {(isAdmin || e.submitted_by === user?.id) &&
                              e.status === "Pending" && (
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => askDelete(e)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Expense</SheetTitle>
            <SheetDescription>Submit an expense for approval</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label htmlFor="exp-desc">Description *</Label>
              <Input
                id="exp-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="exp-cat">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, category: v }))
                }
              >
                <SelectTrigger id="exp-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="exp-amount">Amount *</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="exp-tax">Tax</Label>
                <Input
                  id="exp-tax"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.tax_amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, tax_amount: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="exp-date">Expense Date *</Label>
              <Input
                id="exp-date"
                type="date"
                value={form.expense_date}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, expense_date: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Attachments</Label>
              <div className="mt-1">
                <AttachmentUploader
                  entityId={createdExpenseId}
                  entityType="expenses"
                  attachments={[]}
                  onAttachmentsChange={() => {}}
                  onPendingFilesChange={setPendingCount}
                  onPendingUploadComplete={() => {
                    setCreateOpen(false);
                    setCreatedExpenseId(null);
                    fetchExpenses();
                  }}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="exp-notes">Notes</Label>
              <textarea
                id="exp-notes"
                className="w-full mt-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={saveExpense} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…
                </>
              ) : (
                "Submit Expense"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Approve / Reject / Reimburse dialog */}
      <Sheet open={approveOpen} onOpenChange={setApproveOpen}>
        <SheetContent className="sm:max-w-md w-full">
          <SheetHeader>
            <SheetTitle>
              {pendingAction?.action === "approve" && "Approve Expense"}
              {pendingAction?.action === "reject" && "Reject Expense"}
              {pendingAction?.action === "reimburse" && "Mark Reimbursed"}
            </SheetTitle>
            <SheetDescription>
              {pendingAction?.expense?.description}
            </SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-3">
            <div className="text-sm">
              <strong>Amount:</strong>{" "}
              {pendingAction
                ? formatMoney(
                    pendingAction.expense.amount,
                    pendingAction.expense.currency
                  )
                : ""}
            </div>
            {pendingAction?.action === "reject" && (
              <div>
                <Label htmlFor="reject-reason">Reason *</Label>
                <textarea
                  id="reject-reason"
                  className="w-full mt-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setApproveOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={performAction}
              disabled={actionLoading}
              variant={
                pendingAction?.action === "reject" ? "destructive" : "default"
              }
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirm
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete expense"
        message={
          expenseToDelete
            ? `Delete "${expenseToDelete.description}"?`
            : ""
        }
        confirmLabel="Delete"
        loadingLabel="Deleting…"
        variant="destructive"
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />

      {/* View expense detail sheet */}
      <Sheet open={viewOpen} onOpenChange={setViewOpen}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Expense Details</SheetTitle>
            <SheetDescription>
              {viewingExpense?.description}
            </SheetDescription>
          </SheetHeader>
          {viewingExpense && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  {fmtDate(viewingExpense.expense_date)}
                </div>
                <div>
                  <span className="text-muted-foreground">Category:</span>{" "}
                  {viewingExpense.category}
                </div>
                <div>
                  <span className="text-muted-foreground">Amount:</span>{" "}
                  {formatMoney(viewingExpense.amount, viewingExpense.currency)}
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  {viewingExpense.status}
                </div>
                <div>
                  <span className="text-muted-foreground">Submitter:</span>{" "}
                  {viewingExpense.submitter
                    ? `${viewingExpense.submitter.first_name || ""} ${
                        viewingExpense.submitter.last_name || ""
                      }`.trim() || viewingExpense.submitter.email
                    : "—"}
                </div>
                {viewingExpense.notes && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Notes:</span>{" "}
                    {viewingExpense.notes}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <AttachmentUploader
                  entityId={viewingExpense.id}
                  entityType="expenses"
                  attachments={viewAttachments}
                  onAttachmentsChange={setViewAttachments}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SummaryCard({ label, value, tone = "default" }) {
  const toneClass = {
    default: "text-foreground",
    amber: "text-amber-700",
    green: "text-green-700",
  }[tone];
  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
