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
  UserSquare,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/auth-context";

const EMPTY_VENDOR = {
  id: null,
  name: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  tax_number: "",
  website: "",
  notes: "",
  active: true,
};

export default function VendorsPage() {
  const { activeClient } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(EMPTY_VENDOR);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchVendors(showRefresh = false) {
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      const res = await fetch("/api/v1/vendors?limit=100&sortBy=name&sortOrder=asc");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to fetch vendors");
      }
      const json = await res.json();
      setVendors(json.data || []);
    } catch (err) {
      console.error("Error fetching vendors", err);
      toast.error(err.message || "Failed to fetch vendors");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    fetchVendors();
  }, [activeClient?.id]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return vendors;
    const lower = searchTerm.toLowerCase();
    return vendors.filter(
      (v) =>
        (v.name || "").toLowerCase().includes(lower) ||
        (v.email || "").toLowerCase().includes(lower) ||
        (v.contact_person || "").toLowerCase().includes(lower)
    );
  }, [vendors, searchTerm]);

  function openCreate() {
    setEditingVendor(EMPTY_VENDOR);
    setSheetOpen(true);
  }

  function openEdit(vendor) {
    setEditingVendor({ ...EMPTY_VENDOR, ...vendor });
    setSheetOpen(true);
  }

  async function saveVendor() {
    const name = (editingVendor.name || "").trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    try {
      setIsSaving(true);
      const isEdit = Boolean(editingVendor.id);
      const url = isEdit
        ? `/api/v1/vendors/${editingVendor.id}`
        : "/api/v1/vendors";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contact_person: editingVendor.contact_person || null,
          email: editingVendor.email || null,
          phone: editingVendor.phone || null,
          address: editingVendor.address || null,
          tax_number: editingVendor.tax_number || null,
          website: editingVendor.website || null,
          notes: editingVendor.notes || null,
          active: editingVendor.active,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to save vendor");
      }
      const saved = await res.json();
      setVendors((prev) => {
        if (isEdit) return prev.map((v) => (v.id === saved.id ? saved : v));
        return [saved, ...prev];
      });
      toast.success(isEdit ? "Vendor updated" : "Vendor created");
      setSheetOpen(false);
    } catch (err) {
      toast.error(err.message || "Failed to save vendor");
    } finally {
      setIsSaving(false);
    }
  }

  function askDelete(vendor) {
    setVendorToDelete(vendor);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!vendorToDelete) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/v1/vendors/${vendorToDelete.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete vendor");
      if (json.archived) {
        // Archived (has bills) — refresh list to show new state.
        toast.success(json.message || "Vendor archived");
        await fetchVendors();
      } else {
        setVendors((prev) => prev.filter((v) => v.id !== vendorToDelete.id));
        toast.success("Vendor deleted");
      }
    } catch (err) {
      toast.error(err.message || "Failed to delete vendor");
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
      setVendorToDelete(null);
    }
  }

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title="Vendors"
        description="Companies and people you pay"
        actionLabel="New Vendor"
        actionIcon={<Plus size={16} />}
        onAction={openCreate}
        secondaryActionLabel={isRefreshing ? "Refreshing…" : "Refresh"}
        secondaryActionIcon={
          <RefreshCw
            size={16}
            className={isRefreshing ? "animate-spin" : ""}
          />
        }
        onSecondaryAction={() => fetchVendors(true)}
        secondaryActionDisabled={isRefreshing || isLoading}
      />

      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>All Vendors</CardTitle>
          <CardDescription>
            {filtered.length} {filtered.length === 1 ? "vendor" : "vendors"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search name, email, contact…"
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
              <UserSquare className="h-10 w-10 inline-block mb-3 text-gray-300" />
              <div>No vendors found</div>
              <Button className="mt-3" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Create your first vendor
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
                {filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell>{v.contact_person || "—"}</TableCell>
                    <TableCell>{v.email || "—"}</TableCell>
                    <TableCell>{v.phone || "—"}</TableCell>
                    <TableCell>
                      {v.active ? (
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
                          <DropdownMenuItem onClick={() => openEdit(v)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => askDelete(v)}
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
              {editingVendor.id ? "Edit Vendor" : "New Vendor"}
            </SheetTitle>
            <SheetDescription>
              {editingVendor.id
                ? "Update the vendor's contact and tax info."
                : "Add a new vendor to your directory."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 py-4">
            <Field
              label="Name *"
              value={editingVendor.name}
              onChange={(v) =>
                setEditingVendor((prev) => ({ ...prev, name: v }))
              }
            />
            <Field
              label="Contact Person"
              value={editingVendor.contact_person}
              onChange={(v) =>
                setEditingVendor((prev) => ({ ...prev, contact_person: v }))
              }
            />
            <Field
              label="Email"
              type="email"
              value={editingVendor.email}
              onChange={(v) =>
                setEditingVendor((prev) => ({ ...prev, email: v }))
              }
            />
            <Field
              label="Phone"
              value={editingVendor.phone}
              onChange={(v) =>
                setEditingVendor((prev) => ({ ...prev, phone: v }))
              }
            />
            <Field
              label="Tax Number / GST/HST"
              value={editingVendor.tax_number}
              onChange={(v) =>
                setEditingVendor((prev) => ({ ...prev, tax_number: v }))
              }
            />
            <Field
              label="Website"
              value={editingVendor.website}
              onChange={(v) =>
                setEditingVendor((prev) => ({ ...prev, website: v }))
              }
            />
            <div>
              <label htmlFor="vendor-address" className="text-sm font-medium">
                Address
              </label>
              <textarea
                id="vendor-address"
                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                rows={2}
                value={editingVendor.address || ""}
                onChange={(e) =>
                  setEditingVendor((prev) => ({
                    ...prev,
                    address: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label htmlFor="vendor-notes" className="text-sm font-medium">
                Notes
              </label>
              <textarea
                id="vendor-notes"
                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                rows={2}
                value={editingVendor.notes || ""}
                onChange={(e) =>
                  setEditingVendor((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editingVendor.active}
                onChange={(e) =>
                  setEditingVendor((prev) => ({
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
            <Button onClick={saveVendor} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : editingVendor.id ? (
                "Update Vendor"
              ) : (
                "Create Vendor"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete vendor"
        message={
          vendorToDelete
            ? `Delete "${vendorToDelete.name}"? Vendors with linked bills will be archived instead.`
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
  const id = `vendor-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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
