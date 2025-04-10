"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import supabase from "@/lib/supabase";
import AdminPageHeader from "@/components/AdminPageHeader";

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all clients from Supabase
  const fetchClients = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("wehoware_clients")
        .select("*");
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error(error.message || "Failed to fetch clients");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Filter clients based on the search term
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

  // Handle client deletion with a basic window.confirm
  const handleDelete = async (client) => {
    if (
      window.confirm(
        `Are you sure you want to delete ${client.company_name}? This action cannot be undone.`
      )
    ) {
      try {
        await supabase.from("wehoware_clients").delete().eq("id", client.id);
        setClients(clients.filter((c) => c.id !== client.id));
        toast.success("Client deleted successfully");
      } catch (error) {
        console.error("Error deleting client:", error);
        toast.error(error.message || "Failed to delete client");
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <AdminPageHeader
        title="Client Management"
        description="Manage all your clients"
      />
      <div className="my-4 flex justify-between items-center gap-10">
        <Input
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-1/3"
        />
        <Button onClick={() => router.push("/admin/clients/add")}>Add Client</Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Name</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Company Name</th>
                <th className="text-left py-3 px-4">Number</th>
                <th className="text-left py-3 px-4">Domain</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length ? (
                filteredClients.map((client) => (
                  <tr key={client.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {client.contact_person || "-"}
                    </td>
                    <td className="py-3 px-4">{client.email || "-"}</td>
                    <td className="py-3 px-4">{client.company_name || "-"}</td>
                    <td className="py-3 px-4">
                      {client.contact_number || "-"}
                    </td>
                    <td className="py-3 px-4">{client.domain || "-"}</td>
                    <td className="py-3 px-4 space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(`/admin/clients/edit?id=${client.id}`)
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(client)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-4">
                    No clients found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
