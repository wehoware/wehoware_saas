"use client";

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  ArrowUpDown,
  Briefcase,
  Loader2,
  FolderTree,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import supabase from "@/lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AlertComponent from "@/components/ui/alert-component";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/auth-context";

export default function ServicesPage() {
  const router = useRouter();
  const { activeClient, clientUrl } = useAuth();
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [categories, setCategories] = useState([]);
  // Fetch services from Supabase
  useEffect(() => {
    if (!activeClient?.id) return;
    fetchServices();
    fetchCategories();
  }, [showActiveOnly, sortField, sortOrder, activeClient]);

  const fetchServices = async () => {
    try {
      setIsLoading(true);

      // Create the query
      let query = supabase
        .from("wehoware_services")
        .select("*")
        .eq("client_id", activeClient.id);

      // Apply search if there is a search term
      if (searchTerm) {
        query = query.or(
          `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`
        );
      }

      // Apply sorting
      query = query.order(sortField, { ascending: sortOrder === "asc" });

      if (showActiveOnly) {
        query = query.eq("active", true);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      setErrorMessage(error.message || "Failed to fetch services");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("wehoware_service_categories")
        .select("*")
        .eq("client_id", activeClient.id)
        .order("name");

      if (error) {
        throw error;
      }

      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    fetchServices(); // Re-fetch with current filters
  };

  // Reset search
  const resetSearch = () => {
    setSearchTerm("");
    fetchServices();
  };

  // Handle sort
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle sort order if clicking the same field
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Set new sort field and default to ascending
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Handle delete using a separate loading state
  const openDeleteDialog = (service) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!serviceToDelete) return;

    try {
      setDeleteLoading(true);

      // Get the current user ID for audit
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id;

      const { error } = await supabase
        .from("wehoware_services")
        .delete()
        .eq("id", serviceToDelete.id);

      if (error) {
        throw error;
      }

      // Update local state without refetching
      setServices((prev) =>
        prev.filter((service) => service.id !== serviceToDelete.id)
      );

      // Show success message
      setSuccessMessage("Service deleted successfully!");
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error deleting service:", error);
      setErrorMessage(error.message || "Failed to delete service");
      setErrorDialogOpen(true);
    } finally {
      setDeleteDialogOpen(false);
      setServiceToDelete(null);
      setDeleteLoading(false);
    }
  };

  // We're using server-side filtering now, so this is much simpler
  const filteredServices = services;

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Services"
          description="Manage your services and packages"
          actionLabel="Add New"
          actionIcon={<Plus size={16} />}
          onAction={() => router.push("/admin/services/add")}
          secondaryActionLabel="Manage Categories"
          secondaryActionIcon={<FolderTree size={16} />}
          onSecondaryAction={() => router.push("/admin/categories/service")}
        />

        <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
          <CardHeader>
            <CardTitle>Services Statistics</CardTitle>
            <CardDescription>
              Overview of your services performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Total Services
                </div>
                <div className="text-2xl font-bold">{services.length}</div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Published
                </div>
                <div className="text-2xl font-bold">
                  {services.filter((service) => service.active === true).length}
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Drafts
                </div>
                <div className="text-2xl font-bold">
                  {
                    services.filter((service) => service.active === false)
                      .length
                  }
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Categories
                </div>
                <div className="text-2xl font-bold">{categories.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <CardDescription>
              Manage the services offered on your website
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-2">
                  <form
                    onSubmit={handleSearch}
                    className="flex items-center space-x-2"
                  >
                    <Input
                      type="text"
                      placeholder="Search services..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-[300px]"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="icon"
                      title="Search"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    {searchTerm && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetSearch}
                        className="text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </form>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active-only"
                      checked={showActiveOnly}
                      onCheckedChange={(checked) => setShowActiveOnly(checked)}
                    />
                    <Label htmlFor="active-only">Show active only</Label>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        Sort
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleSort("title")}>
                        Sort by Title
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSort("created_at")}
                      >
                        Sort by Date
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSort("fee")}>
                        Sort by Fee
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
                          <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[60px]">
                            Thumb
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort("title")}
                          >
                            <div className="flex items-center gap-1">
                              Title
                              {sortField === "title" && (
                                <ArrowUpDown className="h-3 w-3" />
                              )}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Description
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort("fee")}
                          >
                            <div className="flex items-center gap-1">
                              Price
                              {sortField === "fee" && (
                                <ArrowUpDown className="h-3 w-3" />
                              )}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort("created_at")}
                          >
                            <div className="flex items-center gap-1">
                              Status
                              {sortField === "created_at" && (
                                <ArrowUpDown className="h-3 w-3" />
                              )}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredServices.map((service) => (
                          <tr
                            key={service.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="p-3">
                              <img
                                src={service.thumbnail || "../images/blank.jpg"}
                                alt={
                                  service.title
                                    ? `Thumbnail for ${service.title}`
                                    : "Service thumbnail"
                                }
                                className="h-10 w-10 rounded-md object-cover border"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {service.title}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {service.service_code}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900 max-w-xs truncate">
                                {service.description}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {service.fee && (
                                <div className="text-sm text-gray-900">
                                  {service.fee_currency}{" "}
                                  {service.fee.toFixed(2)}
                                </div>
                              )}
                              {service.duration && (
                                <div className="text-xs text-gray-500">
                                  {service.duration} mins
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  service.active
                                    ? "bg-green-50 text-green-700 border border-green-200"
                                    : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                                }`}
                              >
                                {service.active ? "Active" : "Draft"}
                              </span>
                              {service.featured && (
                                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                  Featured
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex space-x-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="View"
                                  onClick={() =>
                                    window.open(
                                      `${clientUrl}/services/${service.slug}`,
                                      "_blank"
                                    )
                                  }
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Edit"
                                  onClick={() =>
                                    router.push(
                                      `/admin/services/edit/${service.id}`
                                    )
                                  }
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Delete"
                                  onClick={() => openDeleteDialog(service)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {filteredServices.length === 0 && (
                    <div className="text-center py-10">
                      <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No services found</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try changing your search or filter criteria
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Are you sure?"
        message={`This will permanently delete the service "${serviceToDelete?.title}". This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        loadingLabel="Deleting..."
        variant="destructive"
      />

      {/* Error dialog */}
      <AlertComponent
        open={errorDialogOpen}
        onOpenChange={setErrorDialogOpen}
        title="Error"
        message={errorMessage}
        actionLabel="OK"
      />

      {/* Success dialog */}
      <AlertComponent
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        title="Success"
        message={successMessage}
        actionLabel="OK"
      />
    </div>
  );
}
