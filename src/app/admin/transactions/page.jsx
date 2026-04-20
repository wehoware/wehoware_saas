"use client";

import { useState, useEffect, useMemo } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import AlertComponent from "@/components/ui/alert-component";
import {
  Search,
  ArrowUpDown,
  Trash2,
  FilterIcon,
  MoreHorizontal,
  RefreshCw,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  CreditCard,
} from "lucide-react";

const TYPES = ["All", "Subscription", "Service", "Refund", "Payout", "Sale", "Other"];
const STATUSES = ["All", "Pending", "Completed", "Failed", "Refunded"];
const SORT_OPTIONS = [
  { label: "Date (Newest)", field: "transactionDate", order: "desc" },
  { label: "Date (Oldest)", field: "transactionDate", order: "asc" },
  { label: "Amount (High–Low)", field: "amount", order: "desc" },
  { label: "Amount (Low–High)", field: "amount", order: "asc" },
  { label: "Type", field: "type", order: "asc" },
  { label: "Status", field: "status", order: "asc" },
];

function getStatusBadgeClass(status) {
  switch (status) {
    case "Completed":
      return "bg-green-50 text-green-700 border border-green-200";
    case "Pending":
      return "bg-yellow-50 text-yellow-700 border border-yellow-200";
    case "Failed":
      return "bg-red-50 text-red-700 border border-red-200";
    case "Refunded":
      return "bg-purple-50 text-purple-700 border border-purple-200";
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200";
  }
}

function getStatusIcon(status) {
  switch (status) {
    case "Completed":
      return <CheckCircle className="h-3 w-3 mr-1" />;
    case "Pending":
      return <Clock className="h-3 w-3 mr-1" />;
    case "Failed":
      return <XCircle className="h-3 w-3 mr-1" />;
    case "Refunded":
      return <AlertTriangle className="h-3 w-3 mr-1" />;
    default:
      return null;
  }
}

function formatAmount(amount, currency = "CAD", type) {
  const isNegative = amount < 0 || type === "Refund";
  const formatted = `${currency} ${Math.abs(amount).toFixed(2)}`;
  return { formatted: isNegative ? `-${formatted}` : formatted, isNegative };
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminTransactionsPage() {
  const router = useRouter();

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Filters & sort
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeSortOption, setActiveSortOption] = useState(SORT_OPTIONS[0]);

  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchTransactions = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const params = new URLSearchParams({
        page: "1",
        limit: "100",
        sortBy: activeSortOption.field,
        sortOrder: activeSortOption.order,
      });
      if (typeFilter !== "All") params.set("type", typeFilter);
      if (statusFilter !== "All") params.set("status", statusFilter);

      const res = await fetch(`/api/v1/transactions?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch transactions");
      }
      const json = await res.json();
      setTransactions(json.data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error(error.message || "Failed to fetch transactions");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [typeFilter, statusFilter, activeSortOption]);

  const handleRefresh = () => fetchTransactions(true);

  // Client-side search filter
  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    const lower = searchTerm.toLowerCase();
    return transactions.filter(
      (t) =>
        (t.description || "").toLowerCase().includes(lower) ||
        (t.reference || "").toLowerCase().includes(lower)
    );
  }, [transactions, searchTerm]);

  // Summary card calculations
  const summaryStats = useMemo(() => {
    const total = transactions.length;
    const totalRevenue = transactions
      .filter((t) => t.status === "Completed" && t.type !== "Refund")
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const pendingCount = transactions.filter((t) => t.status === "Pending").length;
    const failedCount = transactions.filter((t) => t.status === "Failed").length;
    return { total, totalRevenue, pendingCount, failedCount };
  }, [transactions]);

  const openDeleteDialog = (transaction) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/v1/transactions/${transactionToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete transaction");
      }
      setTransactions((prev) => prev.filter((t) => t.id !== transactionToDelete.id));
      toast.success("Transaction deleted successfully");
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast.error(error.message || "Failed to delete transaction");
    } finally {
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
      setDeleteLoading(false);
    }
  };

  const activeCurrencySymbol =
    transactions.length > 0 ? (transactions[0].currency || "CAD") : "CAD";

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Transactions"
          description="View and manage all financial transactions"
          actionLabel="New Transaction"
          actionIcon={<Plus size={16} />}
          onAction={() => router.push("/admin/transactions/add")}
        />

        {/* Summary Cards */}
        <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
          <CardHeader>
            <CardTitle>Transaction Summary</CardTitle>
            <CardDescription>Overview of your financial activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Total Transactions
                </div>
                <div className="text-2xl font-bold">{summaryStats.total}</div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {activeCurrencySymbol} {summaryStats.totalRevenue.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Completed only</div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Pending
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {summaryStats.pendingCount}
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Failed
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {summaryStats.failedCount}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              All financial transactions for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search description or reference..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-[280px]"
                    />
                  </div>
                  {searchTerm && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {/* Right side controls */}
                <div className="flex items-center gap-2">
                  {/* Type Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FilterIcon className="h-4 w-4 mr-2" />
                        Type: {typeFilter}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {TYPES.map((t) => (
                        <DropdownMenuItem
                          key={t}
                          onClick={() => setTypeFilter(t)}
                          className={typeFilter === t ? "font-medium" : ""}
                        >
                          {t}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Status Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FilterIcon className="h-4 w-4 mr-2" />
                        Status: {statusFilter}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {STATUSES.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onClick={() => setStatusFilter(s)}
                          className={statusFilter === s ? "font-medium" : ""}
                        >
                          {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Sort */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        Sort
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {SORT_OPTIONS.map((opt) => (
                        <DropdownMenuItem
                          key={`${opt.field}-${opt.order}`}
                          onClick={() => setActiveSortOption(opt)}
                          className={
                            activeSortOption.field === opt.field &&
                            activeSortOption.order === opt.order
                              ? "font-medium"
                              : ""
                          }
                        >
                          {opt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Refresh */}
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Refresh"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                    />
                  </Button>
                </div>
              </div>

              {/* Table */}
              {isLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="w-full overflow-auto rounded-md border bg-white">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Reference
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTransactions.map((txn) => {
                          const { formatted, isNegative } = formatAmount(
                            txn.amount,
                            txn.currency,
                            txn.type
                          );
                          return (
                            <tr
                              key={txn.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              {/* Date */}
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {formatDate(txn.transaction_date)}
                              </td>
                              {/* Description */}
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                                  {txn.description || "—"}
                                </div>
                                {txn.notes && (
                                  <div className="text-xs text-gray-400 truncate max-w-xs">
                                    {txn.notes}
                                  </div>
                                )}
                              </td>
                              {/* Reference */}
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                                {txn.reference || "—"}
                              </td>
                              {/* Amount */}
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold">
                                <span className={isNegative ? "text-red-600" : "text-gray-900"}>
                                  {formatted}
                                </span>
                              </td>
                              {/* Type */}
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                {txn.type || "—"}
                              </td>
                              {/* Status */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                                    txn.status
                                  )}`}
                                >
                                  {getStatusIcon(txn.status)}
                                  {txn.status || "—"}
                                </span>
                              </td>
                              {/* Actions */}
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Actions"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-700"
                                      onClick={() => openDeleteDialog(txn)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {filteredTransactions.length === 0 && (
                    <div className="text-center py-16">
                      <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No transactions found</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {searchTerm || typeFilter !== "All" || statusFilter !== "All"
                          ? "Try adjusting your search or filter criteria"
                          : "No transactions have been recorded yet"}
                      </p>
                    </div>
                  )}

                  {filteredTransactions.length > 0 && (
                    <div className="text-xs text-muted-foreground text-right pt-1">
                      Showing {filteredTransactions.length} of {transactions.length} transaction
                      {transactions.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Transaction?"
        message={`This will permanently delete the transaction "${
          transactionToDelete?.description || transactionToDelete?.reference || transactionToDelete?.id
        }". This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        loadingLabel="Deleting..."
        variant="destructive"
      />

      {/* Error alert */}
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
