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
        .eq("client_id", activeClient.id)
        .order(sortField, { ascending: sortOrder === "asc" });

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

  // Handle search (currently filtering locally)
  const handleSearch = (e) => {
    e.preventDefault();
    // For a larger dataset, consider server-side search
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

  // Filter services based on search term
  const filteredServices = services.filter((service) => {
    const matchesSearch =
      searchTerm === "" ||
      service.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Services"
          description="Manage your services"
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
              Manage the immigration services offered on your website
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
                <form
                  onSubmit={handleSearch}
                  className="flex w-full max-w-sm items-center space-x-2"
                >
                  <Input
                    type="text"
                    placeholder="Search services..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Button type="submit">
                    <Search className="h-4 w-4" />
                  </Button>
                </form>
                <div className="flex items-center space-x-4">
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
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredServices.map((service) => (
                      <Card key={service.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-2">
                                <h3 className="font-medium">{service.title}</h3>
                              </div>
                              <div className="flex items-center space-x-1">
                                {service.featured && (
                                  <Badge variant="secondary">Featured</Badge>
                                )}
                                <Badge
                                  variant={
                                    service.active ? "success" : "destructive"
                                  }
                                >
                                  {service.active ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                            </div>
                            <div className="mb-4">
                              <p className="text-sm text-muted-foreground">
                                {service.description?.length > 180
                                  ? `${service.description.substring(
                                      0,
                                      180
                                    )}...`
                                  : service.description}
                              </p>
                              {service.fee && (
                                <p className="text-sm font-medium mt-2">
                                  Fee: {service.fee_currency}{" "}
                                  {service.fee.toFixed(2)}
                                </p>
                              )}
                            </div>
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  window.open(
                                    `${clientUrl}/services/${service.slug}`,
                                    "_blank"
                                  )
                                }
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  router.push(
                                    `/admin/services/edit/${service.id}`
                                  )
                                }
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteDialog(service)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
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
