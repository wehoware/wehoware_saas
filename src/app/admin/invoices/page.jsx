"use client";

import { useState, useEffect, useMemo } from "react";
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
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Edit, Trash2, Eye, ArrowUpDown, MoreHorizontal,
  FilterIcon, FileText, CheckCircle, AlertTriangle, XCircle, Clock, Loader2,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import AlertComponent from "@/components/ui/alert-component";

const STATUS_BADGE = {
  Paid: <Badge className="bg-green-100 text-green-700"><CheckCircle className="mr-1 h-3 w-3" />Paid</Badge>,
  Pending: <Badge className="bg-yellow-100 text-yellow-700"><Clock className="mr-1 h-3 w-3" />Pending</Badge>,
  Overdue: <Badge className="bg-red-100 text-red-700"><AlertTriangle className="mr-1 h-3 w-3" />Overdue</Badge>,
  Draft: <Badge className="bg-gray-100 text-gray-700"><FileText className="mr-1 h-3 w-3" />Draft</Badge>,
  Cancelled: <Badge className="bg-gray-200 text-gray-600"><XCircle className="mr-1 h-3 w-3" />Cancelled</Badge>,
};

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("invoiceDate");
  const [sortOrder, setSortOrder] = useState("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function fetchInvoices() {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        limit: "100",
        sortBy: sortField,
        sortOrder,
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/v1/invoices?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to fetch invoices");
      }
      const json = await res.json();
      setInvoices(json.data || []);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setErrorMessage(err.message || "Failed to fetch invoices");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
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
    } catch (err) {
      console.error("Error deleting invoice:", err);
      toast.error(err.message || "Failed to delete invoice");
    } finally {
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
      setDeleteLoading(false);
    }
  };

  // Format date using UTC to avoid timezone shifts
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr + 'T00:00:00');
      if (isNaN(date.getTime())) return "—";
      return date.toLocaleDateString();
    } catch (e) {
      return "—";
    }
  };

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!searchTerm) return invoices;
    const q = searchTerm.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.client_name?.toLowerCase().includes(q)
    );
  }, [invoices, searchTerm]);

  const stats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "Paid");
    const pending = invoices.filter((i) => i.status === "Pending");
    const overdue = invoices.filter((i) => i.status === "Overdue");
    const revenue = paid.reduce((sum, i) => sum + Number(i.total || 0), 0);
    return { total: invoices.length, paid: paid.length, pending: pending.length, overdue: overdue.length, revenue };
  }, [invoices]);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <AdminPageHeader
        title="Invoices"
        description="Manage all your invoices and track payments."
        actionLabel="Create New Invoice"
        actionIcon={<Plus className="mr-2 h-4 w-4" />}
        onAction={() => router.push("/admin/invoices/add")}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {[
          { label: "Total Invoices", value: stats.total, icon: <FileText className="h-4 w-4 text-muted-foreground" />, sub: "All recorded invoices" },
          { label: "Paid Invoices", value: stats.paid, icon: <CheckCircle className="h-4 w-4 text-green-500" />, sub: `Revenue: $${stats.revenue.toFixed(2)}` },
          { label: "Pending", value: stats.pending, icon: <Clock className="h-4 w-4 text-yellow-500" />, sub: "Awaiting payment" },
          { label: "Overdue", value: stats.overdue, icon: <AlertTriangle className="h-4 w-4 text-red-500" />, sub: "Past due date" },
        ].map(({ label, value, icon, sub }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              {icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Input
              type="text"
              placeholder="Search by invoice # or client name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex items-center gap-2">
              {/* Status filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full md:w-auto">
                    <FilterIcon className="mr-2 h-4 w-4" />
                    {statusFilter === "all" ? "All Statuses" : statusFilter}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {["all", "Draft", "Paid", "Pending", "Overdue", "Cancelled"].map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)}>
                      {s === "all" ? "All Statuses" : s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowUpDown className="mr-2 h-4 w-4" /> Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleSort("invoiceDate")}>Invoice Date</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort("dueDate")}>Due Date</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort("total")}>Amount</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort("status")}>Status</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search or filter."
                  : "Get started by creating a new invoice."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("invoiceDate")}>
                      Invoice # <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                    </TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort("total")}>
                      Amount <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("invoiceDate")}>
                      Invoice Date <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("dueDate")}>
                      Due Date <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>
                        <div>{invoice.client_name}</div>
                        {invoice.client_email && (
                          <div className="text-xs text-muted-foreground">{invoice.client_email}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.currency} {Number(invoice.total || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>{STATUS_BADGE[invoice.status] ?? <Badge>{invoice.status}</Badge>}</TableCell>
                      <TableCell>
                        {formatDate(invoice.invoice_date)}
                      </TableCell>
                      <TableCell>
                        {formatDate(invoice.due_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/admin/invoices/${invoice.id}`)}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/admin/invoices/edit/${invoice.id}`)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit Invoice
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => { setInvoiceToDelete(invoice); setDeleteDialogOpen(true); }}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Invoice
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
    </div>
  );
}
