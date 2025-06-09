"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Search, Plus, Edit, Trash2, Eye, ArrowUpDown, MoreHorizontal, CalendarDays, FilterIcon, FileText, CheckCircle, AlertTriangle, XCircle, Clock
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
// import AlertComponent from "@/components/ui/alert-component"; // Mocked for now
// import ConfirmDialog from "@/components/ui/confirm-dialog"; // Mocked for now

// Mock data - replace with actual data fetching logic
let allMockInvoices = [
  { id: 'INV-001', clientName: 'Acme Corp', amount: 1500.00, status: 'Paid', invoiceDate: '2024-05-01', dueDate: '2024-05-15' },
  { id: 'INV-002', clientName: 'Beta Solutions', amount: 250.50, status: 'Pending', invoiceDate: '2024-05-10', dueDate: '2024-05-25' },
  { id: 'INV-003', clientName: 'Gamma Inc.', amount: 875.20, status: 'Overdue', invoiceDate: '2024-04-20', dueDate: '2024-05-05' },
  { id: 'INV-004', clientName: 'Delta LLC', amount: 300.00, status: 'Paid', invoiceDate: '2024-05-12', dueDate: '2024-05-28' },
  { id: 'INV-005', clientName: 'Epsilon Exports', amount: 120.00, status: 'Draft', invoiceDate: '2024-06-01', dueDate: '2024-06-15' },
  { id: 'INV-006', clientName: 'Zeta Co.', amount: 550.75, status: 'Cancelled', invoiceDate: '2024-03-10', dueDate: '2024-03-25' },
];

const getStatusBadge = (status) => {
  switch (status) {
    case 'Paid': return <Badge variant="success" className="bg-green-100 text-green-700"><CheckCircle className="mr-1 h-3 w-3" />Paid</Badge>;
    case 'Pending': return <Badge variant="warning" className="bg-yellow-100 text-yellow-700"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    case 'Overdue': return <Badge variant="destructive" className="bg-red-100 text-red-700"><AlertTriangle className="mr-1 h-3 w-3" />Overdue</Badge>;
    case 'Draft': return <Badge variant="outline" className="bg-gray-100 text-gray-700"><FileText className="mr-1 h-3 w-3" />Draft</Badge>;
    case 'Cancelled': return <Badge variant="secondary" className="bg-gray-200 text-gray-600"><XCircle className="mr-1 h-3 w-3" />Cancelled</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'Paid', 'Pending', 'Overdue', 'Draft', 'Cancelled'
  const [sortField, setSortField] = useState("invoiceDate"); // 'id', 'clientName', 'amount', 'status', 'invoiceDate', 'dueDate'
  const [sortOrder, setSortOrder] = useState("desc"); // 'asc', 'desc'

  // Mock delete dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);

  useEffect(() => {
    // Simulate fetching data
    setIsLoading(true);
    setTimeout(() => {
      let filteredInvoices = allMockInvoices;

      if (searchTerm) {
        filteredInvoices = filteredInvoices.filter(inv =>
          inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.clientName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      if (statusFilter !== "all") {
        filteredInvoices = filteredInvoices.filter(inv => inv.status === statusFilter);
      }

      // Sorting logic
      filteredInvoices.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'amount') {
          valA = parseFloat(valA);
          valB = parseFloat(valB);
        }
        // For dates, convert to Date objects for comparison
        if (sortField === 'invoiceDate' || sortField === 'dueDate') {
          valA = new Date(valA);
          valB = new Date(valB);
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      setInvoices(filteredInvoices);
      setIsLoading(false);
    }, 500); // Simulate network delay
  }, [searchTerm, statusFilter, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const openDeleteDialog = (invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  };

  const handleDeleteInvoice = () => {
    if (!invoiceToDelete) return;
    // Mock deletion: filter out the invoice
    // In a real app, call an API to delete and then refetch or update state
    console.log('Deleting invoice:', invoiceToDelete.id);
    allMockInvoices = allMockInvoices.filter(inv => inv.id !== invoiceToDelete.id);
    // Trigger a re-filter/sort
    setSearchTerm(prev => prev); 
    setStatusFilter(prev => prev);
    setSortField(prev => prev);
    setSortOrder(prev => prev);
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
    // Show mock success message (implement with AlertComponent if available)
    alert(`Invoice ${invoiceToDelete.id} deleted successfully (mock).`);
  };
  
  const summaryStats = useMemo(() => {
    const total = allMockInvoices.length;
    const paid = allMockInvoices.filter(inv => inv.status === 'Paid').length;
    const pending = allMockInvoices.filter(inv => inv.status === 'Pending').length;
    const overdue = allMockInvoices.filter(inv => inv.status === 'Overdue').length;
    const totalRevenue = allMockInvoices.filter(inv => inv.status === 'Paid').reduce((sum, inv) => sum + inv.amount, 0);
    return { total, paid, pending, overdue, totalRevenue };
  }, [allMockInvoices]); // Recalculate if allMockInvoices changes (e.g., after delete)

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <AdminPageHeader
        title="Invoices"
        description="Manage all your company invoices and track payments."
        actionLabel="Create New Invoice"
        actionIcon={<Plus className="mr-2 h-4 w-4" />}
        onAction={() => router.push('/admin/invoices/add')}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.total}</div>
            <p className="text-xs text-muted-foreground">All recorded invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.paid}</div>
            <p className="text-xs text-muted-foreground">Total revenue: ${summaryStats.totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.overdue}</div>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full md:w-auto">
              <form onSubmit={(e) => e.preventDefault()} className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Search by ID or Client Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
                {/* <Button type="submit" size="icon" variant="outline"><Search className="h-4 w-4" /></Button> */}
              </form>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full md:w-auto">
                            <FilterIcon className="mr-2 h-4 w-4" /> 
                            Filter: {statusFilter === 'all' ? 'All Statuses' : statusFilter}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {['all', 'Paid', 'Pending', 'Overdue', 'Draft', 'Cancelled'].map(status => (
                            <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)}>
                                {status === 'all' ? 'All Statuses' : status}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <ArrowUpDown className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="ml-2 text-muted-foreground">Loading invoices...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-10">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices found</h3>
                <p className="mt-1 text-sm text-gray-500">
                    {searchTerm || statusFilter !== 'all' ? 'Try adjusting your search or filter criteria.' : 'Get started by creating a new invoice.'}
                </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead onClick={() => handleSort('id')} className="cursor-pointer hover:bg-gray-50">
                      ID <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                    </TableHead>
                    <TableHead onClick={() => handleSort('clientName')} className="cursor-pointer hover:bg-gray-50">
                      Client <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                    </TableHead>
                    <TableHead onClick={() => handleSort('amount')} className="text-right cursor-pointer hover:bg-gray-50">
                      Amount <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                    </TableHead>
                    <TableHead onClick={() => handleSort('status')} className="cursor-pointer hover:bg-gray-50">
                      Status <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                    </TableHead>
                    <TableHead onClick={() => handleSort('invoiceDate')} className="cursor-pointer hover:bg-gray-50">
                      Invoice Date <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                    </TableHead>
                    <TableHead onClick={() => handleSort('dueDate')} className="cursor-pointer hover:bg-gray-50">
                      Due Date <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.id}</TableCell>
                      <TableCell>{invoice.clientName}</TableCell>
                      <TableCell className="text-right">${invoice.amount.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
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
                            <DropdownMenuItem onClick={() => openDeleteDialog(invoice)} className="text-red-600 hover:!text-red-600 focus:text-red-600">
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

      {/* Mock Confirm Dialog for Delete - Replace with actual ConfirmDialog component */}
      {deleteDialogOpen && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000}}>
          <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}>
            <h3 style={{marginTop:0}}>Confirm Deletion</h3>
            <p>Are you sure you want to delete invoice {invoiceToDelete?.id}?</p>
            <div style={{marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteInvoice}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

