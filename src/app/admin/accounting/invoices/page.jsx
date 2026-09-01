"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Edit, Trash2, Eye, ArrowUpDown, MoreHorizontal,
  FilterIcon, FileText, CheckCircle, AlertTriangle, XCircle, Clock,
  Loader2, Settings, Download, X, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, Search, Calendar as CalendarIcon, DollarSign,
  TrendingUp, Wallet,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import AlertComponent from "@/components/ui/alert-component";
import InvoiceSettingsSheet from "@/components/invoice/InvoiceSettingsSheet";
import DatePicker from "@/components/ui/date-picker";
import { formatInvoiceDate, formatCurrency } from "@/lib/invoiceFormat";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const STATUS_LIST = ["Draft", "Pending", "Paid", "Overdue", "Cancelled"];

const STATUS_META = {
  Paid: { icon: CheckCircle, badge: "bg-green-100 text-green-700" },
  Pending: { icon: Clock, badge: "bg-yellow-100 text-yellow-700" },
  Overdue: { icon: AlertTriangle, badge: "bg-red-100 text-red-700" },
  Draft: { icon: FileText, badge: "bg-gray-100 text-gray-700" },
  Cancelled: { icon: XCircle, badge: "bg-gray-200 text-gray-600" },
};

const SORT_OPTIONS = [
  { value: "invoiceDate:desc", label: "Newest invoice date" },
  { value: "invoiceDate:asc", label: "Oldest invoice date" },
  { value: "dueDate:asc", label: "Due date (soonest)" },
  { value: "dueDate:desc", label: "Due date (latest)" },
  { value: "total:desc", label: "Amount (high to low)" },
  { value: "total:asc", label: "Amount (low to high)" },
  { value: "status:asc", label: "Status (A→Z)" },
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

function toCsvCell(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  if (!meta) return <Badge>{status}</Badge>;
  const Icon = meta.icon;
  return (
    <Badge className={cn("inline-flex items-center", meta.badge)}>
      <Icon className="mr-1 h-3 w-3" />
      {status}
    </Badge>
  );
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

export default function InvoicesPage() {
  const router = useRouter();
  const { activeClient } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0 });
  const [summary, setSummary] = useState({
    total: 0, paid: 0, pending: 0, overdue: 0, draft: 0, cancelled: 0,
    revenue: 0, outstanding: 0, byStatus: {},
  });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortKey, setSortKey] = useState("invoiceDate:desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [sortBy, sortOrder] = useMemo(() => {
    const [field, order] = sortKey.split(":");
    return [field || "invoiceDate", order || "desc"];
  }, [sortKey]);

  const fetchInvoices = useCallback(async (targetPage) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        sortBy,
        sortOrder,
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchTerm) params.set("search", searchTerm);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/v1/invoices?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to fetch invoices");
      }
      const json = await res.json();
      setInvoices(json.data || []);
      if (json.pagination) setPagination(json.pagination);
      if (json.summary) setSummary(json.summary);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setErrorMessage(err.message || "Failed to fetch invoices");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchTerm, fromDate, toDate, sortBy, sortOrder]);

  useEffect(() => {
    if (!activeClient?.id) return;
    fetchInvoices(page);
  }, [page, statusFilter, fromDate, toDate, sortBy, sortOrder, activeClient?.id, fetchInvoices]);

  // Debounced search: trigger fetch when searchTerm settles for 400ms.
  useEffect(() => {
    if (!activeClient?.id) return;
    const t = setTimeout(() => {
      setPage(1);
      fetchInvoices(1);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortKey(`${field}:${sortOrder === "asc" ? "desc" : "asc"}`);
    } else {
      setSortKey(`${field}:desc`);
    }
    setPage(1);
  };

  const applyPreset = (preset) => {
    setDatePreset(preset);
    const range = presetRange(preset);
    setFromDate(range.from);
    setToDate(range.to);
    setPage(1);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDatePreset("all");
    setFromDate("");
    setToDate("");
    setSortKey("invoiceDate:desc");
    setPage(1);
  };

  const handleDelete = async () => {
    if (!invoiceToDelete) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/v1/invoices/${invoiceToDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to delete invoice");
      }
      setInvoices((prev) => prev.filter((i) => i.id !== invoiceToDelete.id));
      toast.success("Invoice deleted successfully");
      fetchInvoices(page);
    } catch (err) {
      console.error("Error deleting invoice:", err);
      toast.error(err.message || "Failed to delete invoice");
    } finally {
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
      setDeleteLoading(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      "Invoice #", "Customer", "Client Name", "Client Email",
      "Status", "Invoice Date", "Due Date", "Billing Period",
      "Subtotal", "Tax Rate", "Tax Amount", "Total", "Currency",
    ];
    const rows = invoices.map((inv) => [
      inv.invoice_number,
      inv.customer?.name || "",
      inv.client_name,
      inv.client_email || "",
      inv.status,
      inv.invoice_date ? new Date(inv.invoice_date).toISOString().slice(0, 10) : "",
      inv.due_date ? new Date(inv.due_date).toISOString().slice(0, 10) : "",
      inv.billing_start_date || inv.billing_end_date
        ? `${inv.billing_start_date || ""} – ${inv.billing_end_date || ""}`
        : "",
      inv.subtotal,
      inv.tax_rate,
      inv.tax_amount,
      inv.total,
      inv.currency,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(toCsvCell).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const startItem = (pagination.page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(pagination.page * PAGE_SIZE, pagination.totalItems);

  const activeFilterCount = [
    statusFilter !== "all",
    !!fromDate,
    !!toDate,
    !!searchTerm,
    sortKey !== "invoiceDate:desc",
  ].filter(Boolean).length;

  const statusOptions = useMemo(() => {
    const opts = [{ value: "all", label: "All Statuses", count: summary.total }];
    for (const s of STATUS_LIST) {
      const data = summary.byStatus?.[s];
      opts.push({ value: s, label: s, count: data?.count || 0 });
    }
    return opts;
  }, [summary]);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <AdminPageHeader
        title="Invoices"
        description="Manage all your invoices and track payments."
        actionLabel="Create New Invoice"
        actionIcon={<Plus className="mr-2 h-4 w-4" />}
        onAction={() => router.push("/admin/accounting/invoices/add")}
        secondaryActionLabel="Export CSV"
        secondaryActionIcon={<Download className="mr-2 h-4 w-4" />}
        onSecondaryAction={handleExportCsv}
        secondaryActionDisabled={invoices.length === 0}
      />

      {/* Summary stat cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="p-4 border border-border/40 rounded-lg hover:shadow-sm transition-shadow bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Total Invoices</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <FileText className="h-4 w-4 text-blue-500" />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums">{summary.total}</div>
          <div className="text-xs text-muted-foreground mt-1">In current filter</div>
        </div>
        <div className="p-4 border border-border/40 rounded-lg hover:shadow-sm transition-shadow bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Revenue (Paid)</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
          </div>
          <div className="text-2xl font-bold text-green-600 tabular-nums">
            {formatCurrency(summary.revenue, "").trim()}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{summary.paid} paid invoice(s)</div>
        </div>
        <div className="p-4 border border-border/40 rounded-lg hover:shadow-sm transition-shadow bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Outstanding</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
              <Wallet className="h-4 w-4 text-yellow-500" />
            </div>
          </div>
          <div className="text-2xl font-bold text-yellow-600 tabular-nums">
            {formatCurrency(summary.outstanding, "").trim()}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {summary.pending + summary.overdue} pending + overdue
          </div>
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
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            {/* Row 1: search + status + sort */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search by invoice #, client, or customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full md:max-w-sm pl-8"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
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
                    <Button variant="outline" className="w-full md:w-auto justify-between min-w-[150px]">
                      <span className="inline-flex items-center">
                        <FilterIcon className="mr-2 h-4 w-4" />
                        {statusFilter === "all" ? "All Statuses" : statusFilter}
                      </span>
                      {statusFilter !== "all" && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusFilter("all");
                            setPage(1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              setStatusFilter("all");
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
                          {opt.value !== "all" && (() => {
                            const M = STATUS_META[opt.value];
                            const Icon = M?.icon;
                            return Icon ? <Icon className={cn("h-3.5 w-3.5", M.badge.split(" ")[1])} /> : null;
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

                {/* Settings */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettingsOpen(true)}
                  title="Invoice settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Row 2: date presets + range pickers + clear */}
            <div className="flex items-center flex-wrap gap-2 pt-3 border-t border-dashed border-border/60">
              <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5" />
                Invoice date:
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
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-3 text-sm font-medium">No invoices found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeFilterCount > 0
                  ? "Try adjusting your search or filter criteria."
                  : "Get started by creating a new invoice."}
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                {activeFilterCount > 0 && (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <X className="h-4 w-4 mr-1.5" />
                    Clear filters
                  </Button>
                )}
                <Button size="sm" onClick={() => router.push("/admin/accounting/invoices/add")}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New invoice
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <SortableHead field="invoiceDate" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>
                        Invoice #
                      </SortableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Client</TableHead>
                      <SortableHead field="total" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-right">
                        Amount
                      </SortableHead>
                      <TableHead>Status</TableHead>
                      <SortableHead field="invoiceDate" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>
                        Invoice Date
                      </SortableHead>
                      <SortableHead field="dueDate" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>
                        Due Date
                      </SortableHead>
                      <TableHead>Billing Period</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const overdue = invoice.status === "Pending" && invoice.due_date
                        ? new Date(invoice.due_date) < new Date()
                        : false;
                      return (
                        <TableRow
                          key={invoice.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/admin/accounting/invoices/${invoice.id}`)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{invoice.invoice_number}</span>
                              {overdue && (
                                <span title="Past due date" className="inline-flex items-center">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {invoice.customer ? (
                              <div>
                                <div className="font-medium text-sm">{invoice.customer.name}</div>
                                {invoice.customer.email && (
                                  <div className="text-xs text-muted-foreground">{invoice.customer.email}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{invoice.client_name}</div>
                            {invoice.client_email && (
                              <div className="text-xs text-muted-foreground">{invoice.client_email}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <div className="font-medium">{formatCurrency(invoice.total, invoice.currency)}</div>
                            {Number(invoice.amount_paid) > 0 && Number(invoice.amount_paid) < Number(invoice.total) && (
                              <div className="text-xs text-muted-foreground">
                                Paid {formatCurrency(invoice.amount_paid, invoice.currency)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <StatusBadge status={invoice.status} />
                          </TableCell>
                          <TableCell>{formatInvoiceDate(invoice.invoice_date)}</TableCell>
                          <TableCell>
                            <span className={cn(overdue && "text-red-600 font-medium")}>
                              {formatInvoiceDate(invoice.due_date)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {invoice.billing_start_date || invoice.billing_end_date
                              ? `${formatInvoiceDate(invoice.billing_start_date)} – ${formatInvoiceDate(invoice.billing_end_date)}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/admin/accounting/invoices/${invoice.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push(`/admin/accounting/invoices/edit/${invoice.id}`)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit Invoice
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportCsv}>
                                  <Download className="mr-2 h-4 w-4" /> Export CSV
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setInvoiceToDelete(invoice);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Invoice
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
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Invoice?"
        message={`This will permanently delete invoice ${invoiceToDelete?.invoice_number} for ${invoiceToDelete?.client_name}. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        loadingLabel="Deleting..."
        variant="destructive"
      />

      <AlertComponent
        open={errorDialogOpen}
        onOpenChange={setErrorDialogOpen}
        title="Error"
        message={errorMessage}
        actionLabel="OK"
      />

      <InvoiceSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={() => {
          fetchInvoices(page);
        }}
      />
    </div>
  );
}
