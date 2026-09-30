"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { toastError } from "@/lib/toast-error";
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
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Calendar as CalendarIcon,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  XCircle,
  Paperclip,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import DatePicker from "@/components/ui/date-picker";
import SelectInput from "@/components/ui/select";
import { BILL_STATUSES, formatMoney } from "@/lib/accounting";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const STATUS_META = {
  Draft: { icon: FileText, badge: "bg-gray-100 text-gray-700 border border-gray-200", color: "text-gray-500" },
  Open: { icon: Clock, badge: "bg-blue-100 text-blue-700 border border-blue-200", color: "text-blue-500" },
  "Partially Paid": { icon: Clock, badge: "bg-amber-100 text-amber-700 border border-amber-200", color: "text-amber-500" },
  Paid: { icon: CheckCircle, badge: "bg-green-100 text-green-700 border border-green-200", color: "text-green-500" },
  Overdue: { icon: AlertTriangle, badge: "bg-red-100 text-red-700 border border-red-200", color: "text-red-500" },
  Void: { icon: XCircle, badge: "bg-gray-200 text-gray-600 border border-gray-300", color: "text-gray-400" },
};

const SORT_OPTIONS = [
  { value: "billDate:desc", label: "Newest bill date" },
  { value: "billDate:asc", label: "Oldest bill date" },
  { value: "dueDate:asc", label: "Due date (soonest)" },
  { value: "dueDate:desc", label: "Due date (latest)" },
  { value: "total:desc", label: "Amount (high to low)" },
  { value: "total:asc", label: "Amount (low to high)" },
  { value: "createdAt:desc", label: "Recently created" },
];

const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

function presetRange(preset) {
  const today = new Date();
  const ymd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (preset) {
    case "today":
      return { from: ymd(startOfDay), to: ymd(startOfDay) };
    case "7d": {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() - 6);
      return { from: ymd(d), to: ymd(startOfDay) };
    }
    case "30d": {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() - 29);
      return { from: ymd(d), to: ymd(startOfDay) };
    }
    case "month":
      return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(startOfDay) };
    case "year":
      return { from: ymd(new Date(today.getFullYear(), 0, 1)), to: ymd(startOfDay) };
    case "all":
    default:
      return { from: "", to: "" };
  }
}

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

function toCsvCell(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function SortableHead({ field, sortBy, sortOrder, onSort, children, className }) {
  const active = sortBy === field;
  const order = active ? sortOrder : null;
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors", className)}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          order === "asc" ? (
            <ArrowUp className="h-3 w-3 text-primary" />
          ) : (
            <ArrowDown className="h-3 w-3 text-primary" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </TableHead>
  );
}

export default function BillsPage() {
  const router = useRouter();
  const { activeClient } = useAuth();

  const [bills, setBills] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0 });
  const [summary, setSummary] = useState({
    total: 0, totalDue: 0, totalPaid: 0, overdue: 0, paid: 0, open: 0, draft: 0, byStatus: {},
  });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortKey, setSortKey] = useState("billDate:desc");
  const [vendors, setVendors] = useState([]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [sortBy, sortOrder] = useMemo(() => {
    const [field, order] = sortKey.split(":");
    return [field || "billDate", order || "desc"];
  }, [sortKey]);

  const fetchBills = useCallback(async (targetPage, showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        sortBy,
        sortOrder,
      });
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (selectedVendorId !== "all") params.set("vendor_id", selectedVendorId);
      if (searchTerm) params.set("search", searchTerm);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/v1/bills?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to fetch bills");
      }
      const json = await res.json();
      setBills(json.data || []);
      if (json.pagination) setPagination(json.pagination);
      if (json.summary) setSummary(json.summary);
    } catch (err) {
      console.error("Error fetching bills", err);
      toastError(err, "Failed to fetch bills");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter, selectedVendorId, searchTerm, fromDate, toDate, sortBy, sortOrder]);

  useEffect(() => {
    if (!activeClient?.id) return;
    fetchBills(page);
  }, [page, statusFilter, selectedVendorId, fromDate, toDate, sortBy, sortOrder, activeClient?.id, fetchBills]);

  // Debounced search
  useEffect(() => {
    if (!activeClient?.id) return;
    const t = setTimeout(() => {
      setPage(1);
      fetchBills(1);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Fetch vendors for filter dropdown
  useEffect(() => {
    if (!activeClient?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/vendors?limit=100&active=true");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setVendors(json.data || []);
      } catch {
        // non-fatal
      }
    })();
    return () => { cancelled = true; };
  }, [activeClient?.id]);

  const applyPreset = (preset) => {
    setDatePreset(preset);
    const range = presetRange(preset);
    setFromDate(range.from);
    setToDate(range.to);
    setPage(1);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setSelectedVendorId("all");
    setDatePreset("all");
    setFromDate("");
    setToDate("");
    setSortKey("billDate:desc");
    setPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortKey(`${field}:${sortOrder === "asc" ? "desc" : "asc"}`);
    } else {
      setSortKey(`${field}:desc`);
    }
    setPage(1);
  };

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
      toast.success("Bill deleted");
      fetchBills(page);
    } catch (err) {
      toastError(err, "Failed to delete bill");
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
      setBillToDelete(null);
    }
  }

  const handleExportCsv = () => {
    const headers = [
      "Bill #", "Vendor", "Reference", "Bill Date", "Due Date",
      "Status", "Subtotal", "Tax", "Total", "Paid", "Due", "Currency",
    ];
    const rows = bills.map((b) => [
      b.bill_number,
      b.vendor?.name || "",
      b.reference || "",
      b.bill_date ? new Date(b.bill_date).toISOString().slice(0, 10) : "",
      b.due_date ? new Date(b.due_date).toISOString().slice(0, 10) : "",
      b.status,
      b.subtotal,
      b.tax_amount,
      b.total,
      b.amount_paid,
      b.amount_due,
      b.currency,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(toCsvCell).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bills-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const startItem = (pagination.page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(pagination.page * PAGE_SIZE, pagination.totalItems);

  const activeFilterCount = [
    statusFilter !== "All",
    selectedVendorId !== "all",
    !!fromDate,
    !!toDate,
    !!searchTerm,
    sortKey !== "billDate:desc",
  ].filter(Boolean).length;

  const statusOptions = useMemo(() => {
    const opts = [{ value: "All", label: "All Statuses", count: summary.total }];
    for (const s of BILL_STATUSES) {
      const data = summary.byStatus?.[s];
      opts.push({ value: s, label: s, count: data?.count || 0 });
    }
    return opts;
  }, [summary]);

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title="Bills"
        description="Money you owe to vendors"
        actionLabel="New Bill"
        actionIcon={<Plus size={16} />}
        onAction={() => router.push("/admin/accounting/bills/add")}
        secondaryActionLabel="Export CSV"
        secondaryActionIcon={<Download size={16} />}
        onSecondaryAction={handleExportCsv}
        secondaryActionDisabled={bills.length === 0}
      />

      {/* Summary stat cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="p-4 border border-border/40 rounded-lg hover:shadow-sm transition-shadow bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Total Bills</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <Receipt className="h-4 w-4 text-blue-500" />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums">{summary.total}</div>
          <div className="text-xs text-muted-foreground mt-1">In current filter</div>
        </div>
        <div className="p-4 border border-border/40 rounded-lg hover:shadow-sm transition-shadow bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Outstanding</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <DollarSign className="h-4 w-4 text-amber-500" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 tabular-nums">
            {formatMoney(summary.totalDue)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Total still owed</div>
        </div>
        <div className="p-4 border border-border/40 rounded-lg hover:shadow-sm transition-shadow bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Overdue</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-600 tabular-nums">{summary.overdue}</div>
          <div className="text-xs text-muted-foreground mt-1">Past due date</div>
        </div>
        <div className="p-4 border border-border/40 rounded-lg hover:shadow-sm transition-shadow bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Paid</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
          </div>
          <div className="text-2xl font-bold text-green-600 tabular-nums">{summary.paid}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatMoney(summary.totalPaid)} paid
          </div>
        </div>
      </div>

      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4">
            {/* Row 1: search + status + vendor + sort + refresh */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search bill #, vendor, reference…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-full md:w-[280px]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status filter with counts */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-between min-w-[150px]">
                      <span className="inline-flex items-center">
                        <FilterIcon className="mr-2 h-4 w-4" />
                        {statusFilter === "All" ? "All Statuses" : statusFilter}
                      </span>
                      {statusFilter !== "All" && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusFilter("All");
                            setPage(1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              setStatusFilter("All");
                              setPage(1);
                            }
                          }}
                          className="ml-2 rounded-sm hover:bg-accent p-0.5"
                          aria-label="Clear status filter"
                        >
                          <X className="h-3 w-3" />
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Filter by status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {statusOptions.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => {
                          setStatusFilter(opt.value);
                          setPage(1);
                        }}
                        className="flex items-center justify-between"
                      >
                        <span className="inline-flex items-center gap-2">
                          {opt.value !== "All" && (() => {
                            const M = STATUS_META[opt.value];
                            const Icon = M?.icon;
                            return Icon ? <Icon className={cn("h-3.5 w-3.5", M.color)} /> : null;
                          })()}
                          {opt.label}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                          {opt.count}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Vendor filter */}
                <div className="w-[180px]">
                  <SelectInput
                    placeholder="All Vendors"
                    value={selectedVendorId}
                    onChange={(e) => {
                      setSelectedVendorId(e.target.value || "all");
                      setPage(1);
                    }}
                    options={[
                      { value: "all", label: "All Vendors" },
                      ...vendors.map((v) => ({ value: v.id, label: v.name })),
                    ]}
                  />
                </div>

                {/* Sort dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ArrowUpDown className="mr-2 h-4 w-4" /> Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Sort by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {SORT_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => {
                          setSortKey(opt.value);
                          setPage(1);
                        }}
                        className={cn(sortKey === opt.value && "bg-accent")}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Refresh */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchBills(page, true)}
                  disabled={isRefreshing || isLoading}
                  title="Refresh"
                >
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Row 2: date presets + range pickers + clear */}
            <div className="flex items-center flex-wrap gap-2 pt-3 border-t border-dashed border-border/60">
              <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5" />
                Bill date:
              </span>
              {DATE_PRESETS.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  variant={datePreset === p.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyPreset(p.value)}
                >
                  {p.label}
                </Button>
              ))}
              <div className="flex items-center gap-1.5 ml-2">
                <div className="w-[150px]">
                  <DatePicker
                    name="from"
                    placeholder="From date"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setDatePreset("all");
                      setPage(1);
                    }}
                    className="h-8"
                  />
                </div>
                <span className="text-xs text-muted-foreground">to</span>
                <div className="w-[150px]">
                  <DatePicker
                    name="to"
                    placeholder="To date"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setDatePreset("all");
                      setPage(1);
                    }}
                    className="h-8"
                  />
                </div>
              </div>
              {activeFilterCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs ml-auto"
                  onClick={resetFilters}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear filters ({activeFilterCount})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
              Loading…
            </div>
          ) : bills.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Receipt className="h-10 w-10 inline-block mb-3 text-gray-300" />
              <div className="text-sm font-medium text-foreground">No bills found</div>
              <p className="text-sm mt-1">
                {activeFilterCount > 0
                  ? "Try adjusting your search or filter criteria."
                  : "Get started by creating your first bill."}
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                {activeFilterCount > 0 && (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <X className="h-4 w-4 mr-1.5" />
                    Clear filters
                  </Button>
                )}
                <Button size="sm" onClick={() => router.push("/admin/accounting/bills/add")}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New bill
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Bill #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <SortableHead field="billDate" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>
                        Bill Date
                      </SortableHead>
                      <SortableHead field="dueDate" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>
                        Due Date
                      </SortableHead>
                      <SortableHead field="total" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-right">
                        Total
                      </SortableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((b) => {
                      const meta = STATUS_META[b.status] || STATUS_META.Draft;
                      const overdue = b.status === "Open" && b.due_date
                        ? new Date(b.due_date) < new Date()
                        : false;
                      return (
                        <TableRow
                          key={b.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/admin/accounting/bills/${b.id}`)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{b.bill_number}</span>
                              {b.attachment_count > 0 && (
                                <span className="inline-flex items-center text-muted-foreground" title={`${b.attachment_count} attachment(s)`}>
                                  <Paperclip className="h-3.5 w-3.5" />
                                </span>
                              )}
                              {overdue && (
                                <span title="Past due date">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                </span>
                              )}
                            </div>
                            {b.reference && (
                              <div className="text-xs text-muted-foreground">Ref: {b.reference}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {b.vendor ? (
                              <div>
                                <div className="text-sm font-medium">{b.vendor.name}</div>
                                {b.vendor.email && (
                                  <div className="text-xs text-muted-foreground">{b.vendor.email}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{fmtDate(b.bill_date)}</TableCell>
                          <TableCell>
                            <span className={cn(overdue && "text-red-600 font-medium")}>
                              {fmtDate(b.due_date)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(b.total, b.currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={cn(Number(b.amount_due) > 0 && "font-medium", overdue && "text-red-600")}>
                              {formatMoney(b.amount_due, b.currency)}
                            </span>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Badge className={meta.badge}>
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
                                <DropdownMenuItem onClick={() => router.push(`/admin/accounting/bills/${b.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" /> View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push(`/admin/accounting/bills/${b.id}/edit`)}>
                                  <Edit className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportCsv}>
                                  <Download className="h-4 w-4 mr-2" /> Export CSV
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} &middot; Showing {startItem}–{endItem} of {pagination.totalItems}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
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
