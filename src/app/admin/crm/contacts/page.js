"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Mail,
  Phone,
  Building2,
  Loader2,
  ArrowUpDown,
  Users,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import ContactForm from "@/components/crm/ContactForm";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "react-hot-toast";

const STATUS_COLORS = {
  New: "bg-blue-100 text-blue-800",
  Contacted: "bg-yellow-100 text-yellow-800",
  Qualified: "bg-purple-100 text-purple-800",
  Unqualified: "bg-gray-100 text-gray-800",
  Converted: "bg-green-100 text-green-800",
};

export default function ContactsPage() {
  const router = useRouter();
  const { activeClient, user, isLoading: authLoading } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchContacts = useCallback(async () => {
    if (!activeClient) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sort_by: sortField,
        sort_order: sortOrder,
      });
      if (searchTerm) params.set("search", searchTerm);
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/v1/crm/contacts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const { data, pagination } = await res.json();
      setContacts(data || []);
      setTotalPages(pagination?.totalPages || 1);
      setTotalItems(pagination?.totalItems || 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeClient, page, sortField, sortOrder, searchTerm, statusFilter, typeFilter]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (activeClient) {
        fetchContacts();
      }
    }
  }, [authLoading, user, activeClient, router, fetchContacts]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchContacts();
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingContact(null);
    setFormOpen(true);
  };

  const handleSaved = () => {
    fetchContacts();
  };

  const handleDelete = async () => {
    if (!contactToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/crm/contacts/${contactToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete contact");
      }
      toast.success("Contact deleted");
      setDeleteDialogOpen(false);
      setContactToDelete(null);
      fetchContacts();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConvert = async (contact) => {
    try {
      const res = await fetch(`/api/v1/crm/contacts/${contact.id}/convert`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to convert contact");
      }
      toast.success("Contact converted to customer");
      fetchContacts();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Contacts"
        description="Manage your CRM contacts, leads, and customers"
        actionLabel="New Contact"
        actionIcon={<Plus className="h-4 w-4" />}
        onAction={handleCreate}
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Unqualified">Unqualified</option>
              <option value="Converted">Converted</option>
            </select>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Types</option>
              <option value="Lead">Lead</option>
              <option value="Customer">Customer</option>
            </select>
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contacts ({totalItems})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No contacts found. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium cursor-pointer" onClick={() => handleSort("first_name")}>
                      <span className="flex items-center gap-1">
                        Name <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Phone</th>
                    <th className="pb-2 pr-4 font-medium">Company</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium cursor-pointer" onClick={() => handleSort("status")}>
                      <span className="flex items-center gap-1">
                        Status <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th className="pb-2 pr-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 pr-4">
                        <div className="font-medium">
                          {contact.first_name} {contact.last_name}
                        </div>
                        {contact.job_title && (
                          <div className="text-xs text-muted-foreground">{contact.job_title}</div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {contact.email && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {contact.phone && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {contact.company && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {contact.company}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={contact.type === "Customer" ? "default" : "secondary"}>
                          {contact.type}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[contact.status] || "bg-gray-100 text-gray-800"}`}>
                          {contact.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex justify-end gap-1">
                          {contact.type === "Lead" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleConvert(contact)}
                              title="Convert to Customer"
                            >
                              Convert
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(contact)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setContactToDelete(contact);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editingContact}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Contact"
        description={`Are you sure you want to delete ${contactToDelete?.first_name} ${contactToDelete?.last_name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
