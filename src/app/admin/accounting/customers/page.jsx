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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/auth-context";

const EMPTY_CUSTOMER = {
  id: null,
  name: "",
  contact_person: "",
  email: "",
  phone: "",
  billing_address: "",
  shipping_address: "",
  tax_number: "",
  website: "",
  payment_terms: "",
  currency: "CAD",
  notes: "",
  active: true,
};

export default function CustomersPage() {
  const { activeClient } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(EMPTY_CUSTOMER);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchCustomers(showRefresh = false) {
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      const res = await fetch("/api/v1/customers?limit=100&sortBy=name&sortOrder=asc");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to fetch customers");
      }
      const json = await res.json();
      setCustomers(json.data || []);
    } catch (err) {
      console.error("Error fetching customers", err);
      toast.error(err.message || "Failed to fetch customers");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, [activeClient?.id]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const lower = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(lower) ||
        (c.email || "").toLowerCase().includes(lower) ||
        (c.contact_person || "").toLowerCase().includes(lower) ||
        (c.phone || "").toLowerCase().includes(lower)
    );
  }, [customers, searchTerm]);

  function openCreate() {
    setEditingCustomer(EMPTY_CUSTOMER);
    setSheetOpen(true);
  }

  function openEdit(customer) {
    setEditingCustomer({ ...EMPTY_CUSTOMER, ...customer });
    setSheetOpen(true);
  }

  async function saveCustomer() {
    const name = (editingCustomer.name || "").trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    try {
      setIsSaving(true);
      const isEdit = Boolean(editingCustomer.id);
      const url = isEdit
        ? `/api/v1/customers/${editingCustomer.id}`
        : "/api/v1/customers";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contact_person: editingCustomer.contact_person || null,
          email: editingCustomer.email || null,
          phone: editingCustomer.phone || null,
          billing_address: editingCustomer.billing_address || null,
          shipping_address: editingCustomer.shipping_address || null,
          tax_number: editingCustomer.tax_number || null,
          website: editingCustomer.website || null,
          payment_terms: editingCustomer.payment_terms || null,
          currency: editingCustomer.currency || null,
          notes: editingCustomer.notes || null,
          active: editingCustomer.active,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to save customer");
      }
      const saved = await res.json();
      setCustomers((prev) => {
        if (isEdit) return prev.map((c) => (c.id === saved.id ? saved : c));
        return [saved, ...prev];
      });
      toast.success(isEdit ? "Customer updated" : "Customer created");
      setSheetOpen(false);
    } catch (err) {
      toast.error(err.message || "Failed to save customer");
    } finally {
      setIsSaving(false);
    }
  }

  function askDelete(customer) {
    setCustomerToDelete(customer);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!customerToDelete) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/v1/customers/${customerToDelete.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete customer");
      if (json.archived) {
        toast.success(json.message || "Customer archived");
        await fetchCustomers();
      } else {
        setCustomers((prev) => prev.filter((c) => c.id !== customerToDelete.id));
        toast.success("Customer deleted");
      }
    } catch (err) {
      toast.error(err.message || "Failed to delete customer");
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
      setCustomerToDelete(null);
    }
  }

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title="Customers"
        description="People and companies you invoice"
        actionLabel="New Customer"
        actionIcon={<Plus size={16} />}
        onAction={openCreate}
        secondaryActionLabel={isRefreshing ? "Refreshing…" : "Refresh"}
        secondaryActionIcon={
          <RefreshCw
            size={16}
            className={isRefreshing ? "animate-spin" : ""}
          />
        }
        onSecondaryAction={() => fetchCustomers(true)}
        secondaryActionDisabled={isRefreshing || isLoading}
      />

      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>
            {filtered.length} {filtered.length === 1 ? "customer" : "customers"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search name, email, contact, phone…"
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

          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 inline-block mb-3 text-gray-300" />
              <div>No customers found</div>
              <Button className="mt-3" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Create your first customer
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.contact_person || "—"}</TableCell>
                    <TableCell>{c.email || "—"}</TableCell>
                    <TableCell>{c.phone || "—"}</TableCell>
                    <TableCell>
                      {c.active ? (
                        <Badge className="bg-green-100 text-green-700 border border-green-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 border border-gray-200">
                          Archived
                        </Badge>
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
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => askDelete(c)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingCustomer.id ? "Edit Customer" : "New Customer"}
            </SheetTitle>
            <SheetDescription>
              {editingCustomer.id
                ? "Update the customer's billing and contact info."
                : "Add a new customer to your directory."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 py-4">
            <Field
              label="Name *"
              value={editingCustomer.name}
              onChange={(v) =>
                setEditingCustomer((prev) => ({ ...prev, name: v }))
              }
            />
            <Field
              label="Contact Person"
              value={editingCustomer.contact_person}
              onChange={(v) =>
                setEditingCustomer((prev) => ({ ...prev, contact_person: v }))
              }
            />
            <Field
              label="Email"
              type="email"
              value={editingCustomer.email}
              onChange={(v) =>
                setEditingCustomer((prev) => ({ ...prev, email: v }))
              }
            />
            <Field
              label="Phone"
              value={editingCustomer.phone}
              onChange={(v) =>
                setEditingCustomer((prev) => ({ ...prev, phone: v }))
              }
            />
            <Field
              label="Tax Number / GST/HST"
              value={editingCustomer.tax_number}
              onChange={(v) =>
                setEditingCustomer((prev) => ({ ...prev, tax_number: v }))
              }
            />
            <Field
              label="Website"
              value={editingCustomer.website}
              onChange={(v) =>
                setEditingCustomer((prev) => ({ ...prev, website: v }))
              }
            />
            <Field
              label="Payment Terms"
              value={editingCustomer.payment_terms}
              onChange={(v) =>
                setEditingCustomer((prev) => ({ ...prev, payment_terms: v }))
              }
            />
            <Field
              label="Currency"
              value={editingCustomer.currency}
              onChange={(v) =>
                setEditingCustomer((prev) => ({ ...prev, currency: v }))
              }
            />
            <TextArea
              label="Billing Address"
              value={editingCustomer.billing_address || ""}
              onChange={(v) =>
                setEditingCustomer((prev) => ({ ...prev, billing_address: v }))
              }
            />
            <TextArea
              label="Shipping Address"
              value={editingCustomer.shipping_address || ""}
              onChange={(v) =>
                setEditingCustomer((prev) => ({ ...prev, shipping_address: v }))
              }
            />
            <TextArea
              label="Notes"
              value={editingCustomer.notes || ""}
              onChange={(v) =>
                setEditingCustomer((prev) => ({ ...prev, notes: v }))
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editingCustomer.active}
                onChange={(e) =>
                  setEditingCustomer((prev) => ({
                    ...prev,
                    active: e.target.checked,
                  }))
                }
              />
              Active
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setSheetOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={saveCustomer} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : editingCustomer.id ? (
                "Update Customer"
              ) : (
                "Create Customer"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete customer"
        message={
          customerToDelete
            ? `Delete "${customerToDelete.name}"? Customers with linked invoices will be archived instead.`
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

function Field({ label, value, onChange, type = "text" }) {
  const id = `customer-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </div>
  );
}

function TextArea({ label, value, onChange }) {
  const id = `customer-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
        rows={2}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
