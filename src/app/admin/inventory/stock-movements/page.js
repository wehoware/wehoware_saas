"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Loader2,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Package,
  Download,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Calendar as CalendarIcon,
  Activity,
  PlusCircle,
  MinusCircle,
  Scale,
} from "lucide-react";
import SelectInput from "@/components/ui/select";
import DatePicker from "@/components/ui/date-picker";
import AdminPageHeader from "@/components/AdminPageHeader";
import AlertComponent from "@/components/ui/alert-component";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const MOVEMENT_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "restock", label: "Restock" },
  { value: "sale", label: "Sale" },
  { value: "adjustment", label: "Adjustment" },
  { value: "return", label: "Return" },
  { value: "damage", label: "Damage/Loss" },
  { value: "transfer", label: "Transfer" },
];

// Color + icon metadata per movement type, used by both the dropdown trigger
// chip and the table badge so the UI stays consistent.
const MOVEMENT_META = {
  restock: { label: "Restock", icon: TrendingUp, badge: "bg-green-50 text-green-700 border border-green-200", dot: "bg-green-500" },
  return: { label: "Return", icon: TrendingUp, badge: "bg-green-50 text-green-700 border border-green-200", dot: "bg-green-500" },
  sale: { label: "Sale", icon: TrendingDown, badge: "bg-red-50 text-red-700 border border-red-200", dot: "bg-red-500" },
  damage: { label: "Damage/Loss", icon: TrendingDown, badge: "bg-red-50 text-red-700 border border-red-200", dot: "bg-red-500" },
  adjustment: { label: "Adjustment", icon: ArrowDownUp, badge: "bg-yellow-50 text-yellow-700 border border-yellow-200", dot: "bg-yellow-500" },
  transfer: { label: "Transfer", icon: ArrowDownUp, badge: "bg-blue-50 text-blue-700 border border-blue-200", dot: "bg-blue-500" },
};

const SORT_OPTIONS = [
  { value: "created_at:desc", label: "Newest first" },
  { value: "created_at:asc", label: "Oldest first" },
  { value: "quantity_change:desc", label: "Largest increase" },
  { value: "quantity_change:asc", label: "Largest decrease" },
  { value: "quantity_after:desc", label: "Highest stock after" },
  { value: "quantity_after:asc", label: "Lowest stock after" },
];

// Quick date-range presets. Each returns {from, to} in YYYY-MM-DD form, or
// empty strings for "All time".
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
    case "month": {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: ymd(d), to: ymd(startOfDay) };
    }
    case "all":
    default:
      return { from: "", to: "" };
  }
}

const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

function getMovementMeta(type) {
  return MOVEMENT_META[type] || { label: type || "Unknown", icon: ArrowDownUp, badge: "bg-gray-50 text-gray-700 border border-gray-200", dot: "bg-gray-400" };
}

function SortHeader({ field, sortBy, sortOrder, onSort, children, className }) {
  const active = sortBy === field;
  const order = active ? sortOrder : null;
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors",
        className
      )}
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
    </th>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toCsvCell(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export default function StockMovementsPage() {
  const router = useRouter();
  const { activeClient } = useAuth();
  const [movements, setMovements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0 });
  const [summary, setSummary] = useState({ totalMovements: 0, stockIn: 0, stockOut: 0, netChange: 0, byType: {} });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedItemId, setSelectedItemId] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortKey, setSortKey] = useState("created_at:desc");
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [items, setItems] = useState([]);

  const [sortBy, sortOrder] = useMemo(() => {
    const [field, order] = sortKey.split(":");
    return [field || "created_at", order || "desc"];
  }, [sortKey]);

  const fetchMovements = useCallback(async (targetPage) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        sortBy,
        sortOrder,
      });
      if (selectedType && selectedType !== "all") params.set("movement_type", selectedType);
      if (selectedItemId && selectedItemId !== "all") params.set("itemId", selectedItemId);
      if (searchTerm) params.set("search", searchTerm);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/v1/inventory/stock-movements?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch stock movements");
      const json = await res.json();
      setMovements(json.data || json.movements || []);
      if (json.pagination) {
        setPagination(json.pagination);
      }
      if (json.summary) {
        setSummary(json.summary);
      }
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      setErrorMessage(error.message || "Failed to fetch stock movements");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, selectedItemId, searchTerm, fromDate, toDate, sortBy, sortOrder]);

  useEffect(() => {
    if (!activeClient?.id) return;
    fetchMovements(page);
  }, [page, selectedType, selectedItemId, fromDate, toDate, sortBy, sortOrder, activeClient, fetchMovements]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/inventory?limit=100&active=true");
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.data || []);
    } catch (error) {
      console.error("Error fetching items for filter:", error);
    }
  }, []);

  useEffect(() => {
    if (activeClient?.id) {
      fetchItems();
    }
  }, [activeClient, fetchItems]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchMovements(1);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedType("all");
    setSelectedItemId("all");
    setDatePreset("all");
    setFromDate("");
    setToDate("");
    setSortKey("created_at:desc");
    setPage(1);
  };

  const handleTypeFilterChange = (value) => {
    setSelectedType(value || "all");
    setPage(1);
  };

  const handleItemFilterChange = (value) => {
    setSelectedItemId(value || "all");
    setPage(1);
  };

  const applyPreset = (preset) => {
    setDatePreset(preset);
    const range = presetRange(preset);
    setFromDate(range.from);
    setToDate(range.to);
    setPage(1);
  };

  const handleFromDateChange = (e) => {
    setFromDate(e.target.value);
    setDatePreset("all");
    setPage(1);
  };

  const handleToDateChange = (e) => {
    setToDate(e.target.value);
    setDatePreset("all");
    setPage(1);
  };

  const handleSortColumn = (field) => {
    if (sortBy === field) {
      setSortKey(`${field}:${sortOrder === "asc" ? "desc" : "asc"}`);
    } else {
      setSortKey(`${field}:desc`);
    }
    setPage(1);
  };

  const handleExportCsv = () => {
    const headers = ["Date", "Item", "SKU", "Type", "Quantity Change", "Stock After", "Reason", "Recorded By"];
    const rows = movements.map((m) => [
      m.created_at ? new Date(m.created_at).toISOString() : "",
      m.item?.title || m.item_title || "",
      m.item?.sku || "",
      m.movement_type || "",
      m.quantity_change ?? "",
      m.quantity_after ?? "",
      m.reason || "",
      m.user?.name || m.created_by || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(toCsvCell).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const startItem = (pagination.page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(pagination.page * PAGE_SIZE, pagination.totalItems);

  const activeFilterCount = [
    selectedType !== "all",
    selectedItemId !== "all",
    !!fromDate,
    !!toDate,
    !!searchTerm,
    sortKey !== "created_at:desc",
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Stock Movements"
          description="Audit trail of all stock changes across inventory"
          backLink="/admin/inventory"
          backIcon={<ArrowLeft size={16} />}
          actionLabel="Export CSV"
          actionIcon={<Download size={16} />}
          onAction={handleExportCsv}
          actionDisabled={movements.length === 0}
        />

        {/* Summary stat cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 border border-border/40 rounded-lg hover:shadow-sm transition-shadow bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Total Movements</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <Activity className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <div className="text-2xl font-bold tabular-nums">{summary.totalMovements || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">In current filter</div>
          </div>
          <div className="p-4 border border-border/40 rounded-lg hover:shadow-sm transition-shadow bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Stock In</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                <PlusCircle className="h-4 w-4 text-green-500" />
              </div>
            </div>
            <div className="text-2xl font-bold text-green-600 tabular-nums">+{summary.stockIn || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Restocks + returns</div>
          </div>
          <div className="p-4 border border-border/40 rounded-lg hover:shadow-sm transition-shadow bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Stock Out</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                <MinusCircle className="h-4 w-4 text-red-500" />
              </div>
            </div>
            <div className="text-2xl font-bold text-red-600 tabular-nums">-{summary.stockOut || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Sales + damage/loss</div>
          </div>
          <div className="p-4 border border-border/40 rounded-lg hover:shadow-sm transition-shadow bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Net Change</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Scale className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
            <div
              className={cn(
                "text-2xl font-bold tabular-nums",
                (summary.netChange || 0) > 0 ? "text-green-600" : (summary.netChange || 0) < 0 ? "text-red-600" : "text-muted-foreground"
              )}
            >
              {(summary.netChange || 0) > 0 ? "+" : ""}{summary.netChange || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Across filtered range</div>
          </div>
        </div>

        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Stock Movement History</CardTitle>
            <CardDescription>
              View all stock movements including restocks, sales, adjustments, and more
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Filters row 1: search + type + item */}
              <div className="flex justify-between items-center flex-wrap gap-4">
                <form onSubmit={handleSearch} className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Search by item or reason..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-[250px] pl-8"
                    />
                  </div>
                  <Button type="submit" variant="outline" size="icon" title="Search">
                    <Search className="h-4 w-4" />
                  </Button>
                </form>
                <div className="flex gap-3 items-center flex-wrap">
                  <div className="w-[170px]">
                    <SelectInput
                      placeholder="All Types"
                      value={selectedType}
                      onChange={(e) => handleTypeFilterChange(e.target.value)}
                      options={MOVEMENT_TYPE_OPTIONS}
                    />
                  </div>
                  <div className="w-[210px]">
                    <SelectInput
                      placeholder="All Items"
                      value={selectedItemId}
                      onChange={(e) => handleItemFilterChange(e.target.value)}
                      options={[
                        { value: "all", label: "All Items" },
                        ...items.map((item) => ({
                          value: item.id,
                          label: item.sku ? `${item.title} (${item.sku})` : item.title,
                        })),
                      ]}
                    />
                  </div>
                  <div className="w-[180px]">
                    <SelectInput
                      placeholder="Sort order"
                      value={sortKey}
                      onChange={(e) => {
                        setSortKey(e.target.value || "created_at:desc");
                        setPage(1);
                      }}
                      options={SORT_OPTIONS}
                    />
                  </div>
                </div>
              </div>

              {/* Filters row 2: date presets + range pickers + clear */}
              <div className="flex items-center flex-wrap gap-2 pt-1 border-t border-dashed border-border/60">
                <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Date range:
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
                      onChange={handleFromDateChange}
                      className="h-8"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">to</span>
                  <div className="w-[150px]">
                    <DatePicker
                      name="to"
                      placeholder="To date"
                      value={toDate}
                      onChange={handleToDateChange}
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

              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="w-full overflow-auto rounded-md border bg-white">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <SortHeader field="created_at" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSortColumn}>Date</SortHeader>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <SortHeader field="quantity_change" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSortColumn}>Qty Change</SortHeader>
                          <SortHeader field="quantity_after" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSortColumn}>Stock After</SortHeader>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Reason
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Recorded By
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {movements.map((m) => {
                          const meta = getMovementMeta(m.movement_type);
                          const Icon = meta.icon;
                          const positive = (m.quantity_change ?? 0) > 0;
                          const negative = (m.quantity_change ?? 0) < 0;
                          return (
                            <tr
                              key={m.id}
                              className="hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => m.item?.id && router.push(`/admin/inventory/edit/${m.item.id}`)}
                              title="View item"
                            >
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {formatDateTime(m.created_at)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {m.item?.title || m.item_title || "-"}
                                </div>
                                {m.item?.sku && (
                                  <div className="text-xs text-gray-500">SKU: {m.item.sku}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", meta.badge)}>
                                  <Icon className="h-3 w-3 mr-1" />
                                  {meta.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                  className={cn(
                                    "text-sm font-semibold inline-flex items-center gap-1 tabular-nums",
                                    positive ? "text-green-600" : negative ? "text-red-600" : "text-gray-500"
                                  )}
                                >
                                  {positive ? (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  ) : negative ? (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  ) : null}
                                  {positive ? "+" : ""}{m.quantity_change ?? 0}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 tabular-nums">
                                {m.quantity_after ?? "-"}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 max-w-[280px] truncate" title={m.reason || ""}>
                                {m.reason || "-"}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {m.user?.name || m.created_by || "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {movements.length > 0 && (
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td className="px-4 py-3 text-xs font-medium text-gray-600 uppercase tracking-wider" colSpan={3}>
                              Page subtotal
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={cn(
                                  "text-sm font-semibold tabular-nums",
                                  movements.reduce((acc, m) => acc + (m.quantity_change || 0), 0) > 0
                                    ? "text-green-600"
                                    : movements.reduce((acc, m) => acc + (m.quantity_change || 0), 0) < 0
                                    ? "text-red-600"
                                    : "text-gray-500"
                                )}
                              >
                                {movements.reduce((acc, m) => acc + (m.quantity_change || 0), 0) > 0 ? "+" : ""}
                                {movements.reduce((acc, m) => acc + (m.quantity_change || 0), 0)}
                              </span>
                            </td>
                            <td className="px-4 py-3" colSpan={3} />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {movements.length === 0 && (
                    <div className="text-center py-12">
                      <Package className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No stock movements found</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try changing your search or filter criteria.
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-4">
                        {activeFilterCount > 0 && (
                          <Button variant="outline" size="sm" onClick={resetFilters}>
                            <X className="h-4 w-4 mr-1.5" />
                            Clear filters
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => router.push("/admin/inventory")}>
                          <Package className="h-4 w-4 mr-1.5" />
                          Go to inventory
                        </Button>
                      </div>
                    </div>
                  )}

                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
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
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertComponent
        open={errorDialogOpen}
        onOpenChange={setErrorDialogOpen}
        title="Error"
        message={errorMessage}
        actionLabel="OK"
      />
    </div>
  );
}
