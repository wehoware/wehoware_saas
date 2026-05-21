"use client";

import { useEffect, useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
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
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  Receipt,
  FilterIcon,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { BILL_STATUSES, formatMoney } from "@/lib/accounting";
import { useAuth } from "@/contexts/auth-context";

const STATUS_COLORS = {
  Draft: "bg-gray-100 text-gray-700 border border-gray-200",
  Open: "bg-blue-100 text-blue-700 border border-blue-200",
  "Partially Paid": "bg-amber-100 text-amber-700 border border-amber-200",
  Paid: "bg-green-100 text-green-700 border border-green-200",
  Overdue: "bg-red-100 text-red-700 border border-red-200",
  Void: "bg-gray-200 text-gray-600 border border-gray-300",
};

const STATUS_FILTERS = ["All", ...BILL_STATUSES];

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

export default function BillsPage() {
  const router = useRouter();
  const { activeClient } = useAuth();

  const [bills, setBills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchBills(showRefresh = false) {
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      const params = new URLSearchParams({
        limit: "100",
        sortBy: "billDate",
        sortOrder: "desc",
      });
      if (statusFilter !== "All") params.set("status", statusFilter);
      const res = await fetch(`/api/v1/bills?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to fetch bills");
      }
      const json = await res.json();
      setBills(json.data || []);
    } catch (err) {
      console.error("Error fetching bills", err);
      toast.error(err.message || "Failed to fetch bills");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    fetchBills();
  }, [activeClient?.id, statusFilter]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return bills;
    const lower = searchTerm.toLowerCase();
    return bills.filter(
      (b) =>
        (b.bill_number || "").toLowerCase().includes(lower) ||
        (b.vendor?.name || "").toLowerCase().includes(lower) ||
        (b.reference || "").toLowerCase().includes(lower)
    );
  }, [bills, searchTerm]);

  const summary = useMemo(() => {
    const totalDue = bills.reduce(
      (sum, b) => sum + (Number(b.amount_due) || 0),
      0
    );
    const overdue = bills.filter((b) => b.status === "Overdue").length;
    const paid = bills.filter((b) => b.status === "Paid").length;
    return { totalDue, overdue, paid, count: bills.length };
  }, [bills]);

  function askDelete(bill) {
    setBillToDelete(bill);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!billToDelete) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/v1/bills/${billToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to delete bill");
      }
      setBills((prev) => prev.filter((b) => b.id !== billToDelete.id));
      toast.success("Bill deleted");
    } catch (err) {
      toast.error(err.message || "Failed to delete bill");
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
      setBillToDelete(null);
    }
  }

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title="Bills"
        description="Money you owe to vendors"
        actionLabel="New Bill"
        actionIcon={<Plus size={16} />}
        onAction={() => router.push("/admin/accounting/bills/add")}
        secondaryActionLabel={isRefreshing ? "Refreshing…" : "Refresh"}
        secondaryActionIcon={
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
        }
        onSecondaryAction={() => fetchBills(true)}
        secondaryActionDisabled={isRefreshing || isLoading}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <SummaryCard label="Total Bills" value={summary.count} />
        <SummaryCard label="Outstanding" value={formatMoney(summary.totalDue)} />
        <SummaryCard
          label="Overdue"
          value={summary.overdue}
          tone={summary.overdue > 0 ? "red" : "gray"}
        />
        <SummaryCard label="Paid" value={summary.paid} tone="green" />
      </div>

      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>All Bills</CardTitle>
          <CardDescription>
            {filtered.length} {filtered.length === 1 ? "bill" : "bills"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search bill #, vendor, reference…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[280px]"
                />
              </div>
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                >
                  Clear
                </Button>
              )}
            </div>
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
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Receipt className="h-10 w-10 inline-block mb-3 text-gray-300" />
              <div>No bills found</div>
              <Button
                className="mt-3"
                onClick={() => router.push("/admin/accounting/bills/add")}
              >
                <Plus className="h-4 w-4 mr-2" /> Create your first bill
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Bill Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow
                    key={b.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/admin/accounting/bills/${b.id}`)
                    }
                  >
                    <TableCell className="font-medium">
                      {b.bill_number}
                    </TableCell>
                    <TableCell>{b.vendor?.name || "—"}</TableCell>
                    <TableCell>{fmtDate(b.bill_date)}</TableCell>
                    <TableCell>{fmtDate(b.due_date)}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(b.total, b.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(b.amount_due, b.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[b.status] ?? STATUS_COLORS.Draft}>
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/admin/accounting/bills/${b.id}`)
                            }
                          >
                            <Eye className="h-4 w-4 mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/admin/accounting/bills/${b.id}/edit`
                              )
                            }
                          >
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => askDelete(b)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete bill"
        message={
          billToDelete
            ? `Delete bill ${billToDelete.bill_number}? Bills with payments cannot be deleted.`
            : ""
        }
        confirmLabel="Delete"
        loadingLabel="Deleting…"
        variant="destructive"
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}

function SummaryCard({ label, value, tone = "default" }) {
  const toneClass = {
    default: "text-foreground",
    red: "text-red-700",
    green: "text-green-700",
    gray: "text-gray-700",
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
