"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import supabase from "@/lib/supabase";
import {
  Plus,
  Edit,
  Trash2,
  ArrowUpDown,
  Loader2,
  Users,
  Mail,
  Building2,
  User
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  // Fetch all clients from Supabase, incorporating sorting
  const fetchClients = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from("wehoware_clients")
        .select("*")
        .order(sortField, { ascending: sortOrder === "asc" });

      const { data, error } = await query;

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error(error.message || "Failed to fetch clients");
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger fetch when sort changes
  useEffect(() => {
    fetchClients();
  }, [sortField, sortOrder]);

  // Filter clients based on the search term (Client-side filtering)
  const filteredClients = clients.filter((client) => {
    const term = searchTerm.toLowerCase();
    return (
      client.company_name?.toLowerCase().includes(term) ||
      client.email?.toLowerCase().includes(term) ||
      client.contact_number?.toLowerCase().includes(term) ||
      client.domain?.toLowerCase().includes(term) ||
      client.contact_person?.toLowerCase().includes(term)
    );
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    // fetchClients() will be called by useEffect
  };

  const openDeleteDialog = (client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  // Handle client deletion using ConfirmDialog
  const handleDelete = async (client) => {
    if (!clientToDelete) return;
    try {
      setDeleteLoading(true);
      await supabase
        .from("wehoware_clients")
        .delete()
        .eq("id", clientToDelete.id);
      setClients(clients.filter((c) => c.id !== clientToDelete.id));
      toast.success("Client deleted successfully");
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error(error.message || "Failed to delete client");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <AdminPageHeader
          title="Client Management"
          description="Manage all your clients"
          actionLabel="Add New"
          actionIcon={<Plus size={16} />}
          onAction={() => router.push("/admin/clients/add")}
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">
                All Clients ({clients.length})
              </CardTitle>
              <CardDescription>Browse and manage your clients.</CardDescription>
            </div>
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </CardHeader>
          <Separator />
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      {/* Add sorting handlers */}
                      <th
                        className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 cursor-pointer"
                        onClick={() => handleSort("company_name")}
                      >
                        Company <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                      </th>
                      <th
                        className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 cursor-pointer"
                        onClick={() => handleSort("contact_person")}
                      >
                        Contact <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                      </th>
                      <th
                        className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 cursor-pointer"
                        onClick={() => handleSort("email")}
                      >
                        Email <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                      </th>
                      <th
                        className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 cursor-pointer"
                        onClick={() => handleSort("domain")}
                      >
                        Domain <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                      </th>
                      <th
                        className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 cursor-pointer"
                        onClick={() => handleSort("created_at")}
                      >
                        Created <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {filteredClients.length ? (
                      filteredClients.map((client) => (
                        <tr
                          key={client.id}
                          className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                        >
                          <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0 font-medium">
                            <div className="flex items-center">
                              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                              {client.company_name || "-"}
                            </div>
                          </td>
                          <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                            <div className="flex items-center space-x-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <div>{client.contact_person || "-"}</div>
                            </div>
                          </td>
                          <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                              {client.email || "-"}
                            </div>
                          </td>
                          <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                            {client.domain || "-"}
                          </td>
                          <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0 text-muted-foreground">
                            {new Date(client.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0 text-right">
                            <div className="flex justify-end space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  router.push(
                                    `/admin/clients/edit?id=${client.id}`
                                  )
                                }
                              >
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteDialog(client)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="p-4 text-center h-24">
                          <div className="flex flex-col items-center justify-center">
                            <Users className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-sm font-medium">
                              No clients found.
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Try adjusting your search.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Are you sure?"
        message={`This will permanently delete the client "${clientToDelete?.company_name}" and all associated data. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        loadingLabel="Deleting..."
        variant="destructive"
      />
    </div>
  );
}