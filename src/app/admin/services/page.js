"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
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
  Copy,
  ChevronLeft,
  ChevronRight,
  Star,
  TrendingUp,
  Check,
  Terminal,
} from "lucide-react";
import SelectInput from "@/components/ui/select";
import AdminPageHeader from "@/components/AdminPageHeader";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import AlertComponent from "@/components/ui/alert-component";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/auth-context";
import SeoHealthBadge from "@/components/seo/SeoHealthBadge";

const PAGE_SIZE = 20;

function getSeoScoreClass(score = 0) {
  if (score >= 80) return "bg-green-50 text-green-700 border border-green-200";
  if (score >= 50) return "bg-yellow-50 text-yellow-700 border border-yellow-200";
  return "bg-red-50 text-red-700 border border-red-200";
}

export default function ServicesPage() {
  const router = useRouter();
  const { activeClient, clientUrl } = useAuth();
  const [services, setServices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [cloneLoading, setCloneLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [successMessage, setSuccessMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const fetchServices = useCallback(async (targetPage) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        sortBy: sortField,
        sortOrder,
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      });
      if (showActiveOnly) params.set("active", "true");
      if (showFeaturedOnly) params.set("featured", "true");
      if (selectedCategoryId && selectedCategoryId !== "all") params.set("categoryId", selectedCategoryId);
      if (searchTerm) params.set("search", searchTerm);
      const res = await fetch(`/api/v1/services?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch services");
      const json = await res.json();
      setServices(json.data || []);
      if (json.pagination) {
        setPagination(json.pagination);
      }
      setSelectedIds([]);
    } catch (error) {
      console.error("Error fetching services:", error);
      setErrorMessage(error.message || "Failed to fetch services");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, [sortField, sortOrder, showActiveOnly, showFeaturedOnly, selectedCategoryId, searchTerm]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/services/categories");
      if (!res.ok) return;
      const json = await res.json();
      setCategories(json.data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  useEffect(() => {
    if (!activeClient?.id) return;
    fetchServices(page);
    fetchCategories();
  }, [page, sortField, sortOrder, showActiveOnly, showFeaturedOnly, selectedCategoryId, activeClient, fetchServices, fetchCategories]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchServices(1);
  };

  const resetSearch = () => {
    setSearchTerm("");
    setPage(1);
  };

  useEffect(() => {
    if (searchTerm === "" && activeClient?.id) {
      fetchServices(1);
    }
  }, [searchTerm]);

  const handleFilterChange = (checked) => {
    setShowActiveOnly(checked);
    setPage(1);
  };

  const handleFeaturedFilterChange = (checked) => {
    setShowFeaturedOnly(checked);
    setPage(1);
  };

  const handleCategoryFilterChange = (value) => {
    setSelectedCategoryId(value || "all");
    setPage(1);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const openDeleteDialog = (service) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!serviceToDelete) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/v1/services/${serviceToDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to delete service");
      setSuccessMessage("Service deleted successfully!");
      setSuccessDialogOpen(true);
      fetchServices(page);
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

  const handleClone = async (service) => {
    try {
      setCloneLoading(service.id);
      const res = await fetch(`/api/v1/services/${service.id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to clone service");
      const json = await res.json();
      router.push(`/admin/services/edit/${json.service.id}`);
    } catch (error) {
      console.error("Error cloning service:", error);
      setErrorMessage(error.message || "Failed to clone service");
      setErrorDialogOpen(true);
    } finally {
      setCloneLoading(null);
    }
  };

  const allOnPageSelected = services.length > 0 && services.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    const pageIds = services.map((s) => s.id);
    const pageIdSet = new Set(pageIds);
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.length === 0) return;
    if (action === "delete") {
      setBulkDeleteDialogOpen(true);
      return;
    }
    try {
      setBulkLoading(true);
      const res = await fetch("/api/v1/services/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selectedIds }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Bulk action failed");
      const json = await res.json();
      const count = json.updated ?? json.deleted ?? selectedIds.length;
      setSuccessMessage(`${count} service(s) ${action === "activate" ? "activated" : "deactivated"} successfully.`);
      setSuccessDialogOpen(true);
      setSelectedIds([]);
      fetchServices(page);
    } catch (error) {
      console.error("Bulk action error:", error);
      setErrorMessage(error.message || "Bulk action failed");
      setErrorDialogOpen(true);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      setBulkLoading(true);
      const res = await fetch("/api/v1/services/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: selectedIds }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Bulk delete failed");
      const json = await res.json();
      const count = json.deleted ?? selectedIds.length;
      setSuccessMessage(`${count} service(s) deleted successfully.`);
      setSuccessDialogOpen(true);
      setSelectedIds([]);
      fetchServices(page);
    } catch (error) {
      console.error("Bulk delete error:", error);
      setErrorMessage(error.message || "Bulk delete failed");
      setErrorDialogOpen(true);
    } finally {
      setBulkLoading(false);
      setBulkDeleteDialogOpen(false);
    }
  };

  const startItem = (pagination.page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(pagination.page * PAGE_SIZE, pagination.totalItems);

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

        <div className="flex justify-end -mt-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setApiDialogOpen(true)}
          >
            <Terminal className="h-4 w-4 mr-2" />
            Developer API Reference
          </Button>
        </div>

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
                <div className="text-2xl font-bold">{pagination.totalItems}</div>
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
                  {services.filter((service) => service.active === false).length}
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Featured
                </div>
                <div className="text-2xl font-bold">
                  {services.filter((s) => s.featured === true).length}
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Avg SEO Score
                </div>
                <div className="text-2xl font-bold">
                  {services.length > 0
                    ? Math.round(
                        services.reduce((sum, s) => sum + (s.seo_score || 0), 0) /
                          services.length
                      )
                    : 0}
                </div>
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
                <div className="flex gap-4 items-center flex-wrap">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active-only"
                      checked={showActiveOnly}
                      onCheckedChange={handleFilterChange}
                    />
                    <Label htmlFor="active-only">Active only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="featured-only"
                      checked={showFeaturedOnly}
                      onCheckedChange={handleFeaturedFilterChange}
                    />
                    <Label htmlFor="featured-only">Featured only</Label>
                  </div>
                  <div className="w-[180px]">
                    <SelectInput
                      placeholder="All Categories"
                      value={selectedCategoryId}
                      onChange={(e) => handleCategoryFilterChange(e.target.value)}
                      options={[
                        { value: "all", label: "All Categories" },
                        ...categories.map((c) => ({ value: c.id, label: c.name })),
                      ]}
                    />
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
                      <DropdownMenuItem onClick={() => handleSort("created_at")}>
                        Sort by Date
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSort("fee")}>
                        Sort by Fee
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md">
                  <span className="text-sm font-medium text-blue-700">
                    {selectedIds.length} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkLoading}
                    onClick={() => handleBulkAction("activate")}
                  >
                    Activate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkLoading}
                    onClick={() => handleBulkAction("deactivate")}
                  >
                    Deactivate
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={bulkLoading}
                    onClick={() => handleBulkAction("delete")}
                  >
                    Delete
                  </Button>
                  {bulkLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                </div>
              )}

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
                          <th className="px-3 py-3 text-left w-[40px]">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={allOnPageSelected}
                              onChange={toggleSelectAll}
                              title="Select all on page"
                            />
                          </th>
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
                            onClick={() => handleSort("views")}
                          >
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Views
                              {sortField === "views" && (
                                <ArrowUpDown className="h-3 w-3" />
                              )}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort("rating")}
                          >
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              Rating
                              {sortField === "rating" && (
                                <ArrowUpDown className="h-3 w-3" />
                              )}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            SEO
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
                        {services.map((service) => {
                          let feeDisplay = null;
                          if (service.fee_label) {
                            feeDisplay = <div className="text-sm text-gray-900">{service.fee_label}</div>;
                          } else if (service.fee != null) {
                            feeDisplay = (
                              <div className="text-sm text-gray-900">
                                {service.fee_currency}{" "}
                                {Number(service.fee).toFixed(2)}
                              </div>
                            );
                          }
                          return (
                          <tr
                            key={service.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                checked={selectedIds.includes(service.id)}
                                onChange={() => toggleSelectOne(service.id)}
                              />
                            </td>
                            <td className="p-3">
                              <Image
                                src={service.thumbnail || "/images/blank.jpg"}
                                alt={
                                  service.title
                                    ? `Thumbnail for ${service.title}`
                                    : "Service thumbnail"
                                }
                                width={64}
                                height={64}
                                className="w-16 h-16 object-cover rounded"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap max-w-[250px]">
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
                            <td className="px-4 py-3 whitespace-nowrap">
                              {feeDisplay}
                              {service.duration && (
                                <div className="text-xs text-gray-500">
                                  {service.duration}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {service.views || 0}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-900">
                                <Star className="h-3 w-3 text-yellow-500 mr-1" />
                                {service.rating === null || service.rating === undefined ? "0.0" : Number(service.rating).toFixed(1)}
                                <span className="text-xs text-gray-500 ml-1">
                                  ({service.reviews_count || 0})
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <SeoHealthBadge score={service.seo_score} size="sm" />
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
                                  title="Clone"
                                  disabled={cloneLoading === service.id}
                                  onClick={() => handleClone(service)}
                                >
                                  {cloneLoading === service.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {services.length === 0 && (
                    <div className="text-center py-10">
                      <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No services found</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try changing your search or filter criteria
                      </p>
                    </div>
                  )}

                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages} &middot; Showing {startItem}–{endItem} of {pagination.totalItems}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= pagination.totalPages}
                          onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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

      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Delete selected services?"
        message={`This will permanently delete ${selectedIds.length} service(s). This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleBulkDelete}
        isLoading={bulkLoading}
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

      <AlertComponent
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        title="Success"
        message={successMessage}
        actionLabel="OK"
      />

      <Dialog open={apiDialogOpen} onOpenChange={setApiDialogOpen}>
        <DialogContent className="max-w-[70vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Developer API Reference
            </DialogTitle>
            <DialogDescription>
              Public API endpoints scoped to the active client. Copy and use these in your frontend or mobile app.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {/* Client Context */}
            <div className="space-y-3 p-3 bg-muted rounded-lg">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Client Context
              </h4>
              <ApiCopyRow
                label="Client ID"
                value={activeClient?.id || "N/A"}
                field="clientId"
                copiedField={copiedField}
                onCopy={(val, field) => {
                  navigator.clipboard.writeText(val);
                  setCopiedField(field);
                  setTimeout(() => setCopiedField(null), 1500);
                }}
              />
              <ApiCopyRow
                label="Domain"
                value={clientUrl || "N/A"}
                field="domain"
                copiedField={copiedField}
                onCopy={(val, field) => {
                  navigator.clipboard.writeText(val);
                  setCopiedField(field);
                  setTimeout(() => setCopiedField(null), 1500);
                }}
              />
            </div>

            {/* Authentication Note */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-800">
                <strong>No authentication required.</strong> All public endpoints are scoped to a client via <code className="font-mono bg-blue-100 px-1 rounded">domain</code> or <code className="font-mono bg-blue-100 px-1 rounded">clientId</code> query parameter.
              </p>
            </div>

            {/* Endpoints */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Endpoints
              </h4>
              <ApiEndpointRow
                method="GET"
                label="List Services"
                url={`/api/public/services?clientId=${activeClient?.id || "{clientId}"}`}
                copiedField={copiedField}
                field="list"
                onCopy={(val, field) => {
                  navigator.clipboard.writeText(val);
                  setCopiedField(field);
                  setTimeout(() => setCopiedField(null), 1500);
                }}
              />
              <ApiEndpointRow
                method="GET"
                label="Get Service by Slug"
                url={`/api/public/services/{slug}?clientId=${activeClient?.id || "{clientId}"}`}
                copiedField={copiedField}
                field="slug"
                onCopy={(val, field) => {
                  navigator.clipboard.writeText(val);
                  setCopiedField(field);
                  setTimeout(() => setCopiedField(null), 1500);
                }}
              />
              <ApiEndpointRow
                method="GET"
                label="Get Service FAQs"
                url={`/api/public/services/{slug}/faqs?clientId=${activeClient?.id || "{clientId}"}`}
                copiedField={copiedField}
                field="faqs"
                onCopy={(val, field) => {
                  navigator.clipboard.writeText(val);
                  setCopiedField(field);
                  setTimeout(() => setCopiedField(null), 1500);
                }}
              />
              <ApiEndpointRow
                method="GET"
                label="List Categories"
                url={`/api/public/services/categories?clientId=${activeClient?.id || "{clientId}"}`}
                copiedField={copiedField}
                field="categories"
                onCopy={(val, field) => {
                  navigator.clipboard.writeText(val);
                  setCopiedField(field);
                  setTimeout(() => setCopiedField(null), 1500);
                }}
              />
            </div>

            {/* Query Parameters */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Query Parameters
              </h4>
              <ApiParamTable
                params={[
                  { name: "clientId", type: "string (UUID)", required: true, description: "Active client ID. Alternative to domain." },
                  { name: "domain", type: "string", required: false, description: "Client domain (e.g. example.com). Alternative to clientId." },
                  { name: "page", type: "integer", required: false, description: "Page number for list endpoints. Default: 1" },
                  { name: "limit", type: "integer", required: false, description: "Items per page. Default: 10, Max: 100" },
                  { name: "search", type: "string", required: false, description: "Search in title and description." },
                  { name: "categoryId", type: "string (UUID)", required: false, description: "Filter by category ID." },
                  { name: "featured", type: "boolean", required: false, description: "Filter featured items only." },
                  { name: "sortBy", type: "string", required: false, description: "created_at, updated_at, title, fee, featured. Default: created_at" },
                  { name: "sortOrder", type: "string", required: false, description: "asc or desc. Default: desc" },
                ]}
              />
            </div>

            {/* Response Fields */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Service Response Fields
              </h4>
              <ApiFieldTable
                fields={[
                  { name: "id", type: "string (UUID)", description: "Unique service identifier" },
                  { name: "client_id", type: "string (UUID)", description: "Owner client ID" },
                  { name: "category_id", type: "string (UUID)", description: "Category reference" },
                  { name: "title", type: "string", description: "Service title" },
                  { name: "slug", type: "string", description: "URL-friendly identifier" },
                  { name: "description", type: "string | null", description: "Short description" },
                  { name: "content", type: "string | null", description: "Full HTML content" },
                  { name: "thumbnail", type: "string | null", description: "Thumbnail image URL" },
                  { name: "thumbnail_alt", type: "string | null", description: "Alt text for thumbnail" },
                  { name: "fee", type: "number | null", description: "Service fee amount" },
                  { name: "fee_currency", type: "string | null", description: "Currency code (e.g. USD)" },
                  { name: "fee_label", type: "string | null", description: "Free if fee is 0/null" },
                  { name: "service_code", type: "string | null", description: "Internal service code" },
                  { name: "duration", type: "string | null", description: "Duration description" },
                  { name: "tags", type: "string[] | null", description: "Array of tag strings" },
                  { name: "active", type: "boolean", description: "Published status" },
                  { name: "featured", type: "boolean", description: "Featured flag" },
                  { name: "rating", type: "number", description: "Average rating (0 if none)" },
                  { name: "reviews_count", type: "integer", description: "Total review count" },
                  { name: "views", type: "integer", description: "View count" },
                  { name: "created_at", type: "ISO 8601", description: "Creation timestamp" },
                  { name: "updated_at", type: "ISO 8601", description: "Last update timestamp" },
                  { name: "meta_title", type: "string | null", description: "SEO meta title" },
                  { name: "meta_description", type: "string | null", description: "SEO meta description" },
                  { name: "meta_keywords", type: "string | null", description: "SEO meta keywords" },
                  { name: "open_graph_title", type: "string | null", description: "OG title" },
                  { name: "open_graph_description", type: "string | null", description: "OG description" },
                  { name: "open_graph_image", type: "string | null", description: "OG image URL" },
                  { name: "twitter_title", type: "string | null", description: "Twitter card title" },
                  { name: "twitter_description", type: "string | null", description: "Twitter card description" },
                  { name: "twitter_image", type: "string | null", description: "Twitter card image URL" },
                  { name: "canonical_url", type: "string | null", description: "Canonical URL override" },
                  { name: "robots_meta", type: "string | null", description: "Robots meta tag value" },
                  { name: "schema_type", type: "string | null", description: "JSON-LD schema type" },
                  { name: "seo_score", type: "integer | null", description: "Computed SEO score (0-100)" },
                  { name: "target_keywords", type: "string | null", description: "Comma-separated target keywords" },
                  { name: "cta_heading", type: "string | null", description: "CTA section heading" },
                  { name: "cta_body", type: "string | null", description: "CTA body text" },
                  { name: "cta_button_text", type: "string | null", description: "CTA button label" },
                  { name: "cta_button_url", type: "string | null", description: "CTA button link" },
                  { name: "allow_social_share", type: "boolean", description: "Social sharing enabled" },
                  { name: "wehoware_service_categories", type: "object | null", description: "{ id, name, slug }" },
                ]}
              />
            </div>

            {/* Single Service Extra Fields */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Single Service Extra Fields
              </h4>
              <ApiFieldTable
                fields={[
                  { name: "related_blogs", type: "array", description: "Linked blog posts: { id, title, slug, thumbnail, excerpt }" },
                  { name: "faqs", type: "array", description: "Active FAQs: { id, question, answer, display_order }" },
                  { name: "faq_schema", type: "object | null", description: "FAQPage JSON-LD schema.org object (inside service object)" },
                ]}
              />
            </div>

            {/* Schema.org Structured Data */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Schema.org Structured Data
              </h4>
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <p className="text-xs text-green-800">
                  <strong>SEO Enhancement.</strong> All responses include <code className="font-mono bg-green-100 px-1 rounded">schema</code> fields containing <a href="https://schema.org" className="underline" target="_blank" rel="noopener noreferrer">Schema.org</a> JSON-LD structured data. Inject these into your page&apos;s <code className="font-mono bg-green-100 px-1 rounded">&lt;script type=&quot;application/ld+json&quot;&gt;</code> tags for rich search results.
                </p>
              </div>
              <ApiFieldTable
                fields={[
                  { name: "schema.item_list", type: "object", description: "ItemList JSON-LD for list endpoints. Contains itemListElement[] with position, url, and name for each service." },
                  { name: "schema.collection_page", type: "object", description: "CollectionPage JSON-LD for list endpoints. Contains name, description, and url of the services collection." },
                  { name: "service_schema", type: "object", description: "Service JSON-LD for single service. Includes name, description, image, provider (Organization), offers (price, currency), serviceType, areaServed, aggregateRating, keywords." },
                  { name: "breadcrumb_schema", type: "object | null", description: "BreadcrumbList JSON-LD for single service. Contains itemListElement[] with position, name, and url for Home > Category > Service." },
                  { name: "faq_schema", type: "object | null", description: "FAQPage JSON-LD for service FAQs. Contains mainEntity[] with Question and acceptedAnswer pairs." },
                ]}
              />
            </div>

            {/* Example Response */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Example: List Services
              </h4>
              <ApiCodeBlock
                title="GET /api/public/services?clientId={id}"
                code={`{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "client_id": "client-uuid-1234",
      "category_id": "cat-uuid",
      "title": "Legal Consultation",
      "slug": "legal-consultation",
      "description": "Expert legal advice for businesses and individuals.",
      "content": "<p>Full service description with HTML content...</p>",
      "thumbnail": "https://cdn.example.com/service-thumb.jpg",
      "thumbnail_alt": "Legal consultation meeting",
      "fee": 150.00,
      "fee_currency": "USD",
      "fee_label": null,
      "service_code": "LC-001",
      "duration": "1 hour consultation",
      "tags": ["legal", "business", "consultation"],
      "active": true,
      "featured": false,
      "rating": 4.8,
      "reviews_count": 12,
      "views": 342,
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-06-01T14:22:00Z",
      "meta_title": "Legal Consultation Services | Wehoware",
      "meta_description": "Get expert legal advice from certified professionals.",
      "meta_keywords": "legal, consultation, lawyer, business law",
      "open_graph_title": "Legal Consultation Services",
      "open_graph_description": "Expert legal advice for businesses and individuals.",
      "open_graph_image": "https://cdn.example.com/og-legal.jpg",
      "twitter_title": "Legal Consultation Services",
      "twitter_description": "Expert legal advice for businesses and individuals.",
      "twitter_image": "https://cdn.example.com/twitter-legal.jpg",
      "canonical_url": "https://example.com/services/legal-consultation",
      "robots_meta": "index, follow",
      "schema_type": "Service",
      "seo_score": 92,
      "target_keywords": "legal consultation, business lawyer",
      "cta_heading": "Ready to Get Started?",
      "cta_body": "Book your consultation today and protect your business.",
      "cta_button_text": "Book Now",
      "cta_button_url": "/contact",
      "allow_social_share": true,
      "wehoware_service_categories": {
        "id": "cat-uuid",
        "name": "Legal",
        "slug": "legal"
      }
    }
  ],
  "pagination": {
    "totalItems": 24,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  },
  "schema": {
    "item_list": {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "url": "https://example.com/services/legal-consultation",
          "name": "Legal Consultation"
        }
      ]
    },
    "collection_page": {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Services",
      "description": "Example Co services",
      "url": "https://example.com/services"
    }
  }
}`}
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Example: Get Service by Slug
              </h4>
              <ApiCodeBlock
                title="GET /api/public/services/{slug}?clientId={id}"
                code={`{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "client_id": "client-uuid-1234",
  "category_id": "cat-uuid",
  "title": "Legal Consultation",
  "slug": "legal-consultation",
  "description": "Expert legal advice for businesses and individuals.",
  "content": "<p>Full service description with HTML content...</p>",
  "thumbnail": "https://cdn.example.com/service-thumb.jpg",
  "thumbnail_alt": "Legal consultation meeting",
  "fee": 150.00,
  "fee_currency": "USD",
  "fee_label": null,
  "service_code": "LC-001",
  "duration": "1 hour consultation",
  "tags": ["legal", "business", "consultation"],
  "active": true,
  "featured": false,
  "rating": 4.8,
  "reviews_count": 12,
  "views": 342,
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-06-01T14:22:00Z",
  "meta_title": "Legal Consultation Services | Wehoware",
  "meta_description": "Get expert legal advice from certified professionals.",
  "meta_keywords": "legal, consultation, lawyer, business law",
  "open_graph_title": "Legal Consultation Services",
  "open_graph_description": "Expert legal advice for businesses and individuals.",
  "open_graph_image": "https://cdn.example.com/og-legal.jpg",
  "twitter_title": "Legal Consultation Services",
  "twitter_description": "Expert legal advice for businesses and individuals.",
  "twitter_image": "https://cdn.example.com/twitter-legal.jpg",
  "canonical_url": "https://example.com/services/legal-consultation",
  "robots_meta": "index, follow",
  "schema_type": "Service",
  "seo_score": 92,
  "target_keywords": "legal consultation, business lawyer",
  "cta_heading": "Ready to Get Started?",
  "cta_body": "Book your consultation today and protect your business.",
  "cta_button_text": "Book Now",
  "cta_button_url": "/contact",
  "allow_social_share": true,
  "wehoware_service_categories": {
    "id": "cat-uuid",
    "name": "Legal",
    "slug": "legal"
  },
  "related_blogs": [
    {
      "id": "blog-uuid-1",
      "title": "Understanding Legal Rights",
      "slug": "legal-rights",
      "thumbnail": "https://cdn.example.com/blog-thumb.jpg",
      "excerpt": "Learn about your fundamental legal rights..."
    }
  ],
  "faqs": [
    {
      "id": "faq-1",
      "question": "What is included in the consultation?",
      "answer": "Comprehensive review of your legal situation with actionable advice.",
      "display_order": 0
    },
    {
      "id": "faq-2",
      "question": "How do I book a session?",
      "answer": "Use the CTA button or contact form to schedule your appointment.",
      "display_order": 1
    }
  ],
  "faq_schema": {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is included in the consultation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Comprehensive review of your legal situation with actionable advice."
        }
      },
      {
        "@type": "Question",
        "name": "How do I book a session?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Use the CTA button or contact form to schedule your appointment."
        }
      }
    ]
  }
}

// Top-level response also includes:
// "service_schema": { ... Service JSON-LD ... }
// "breadcrumb_schema": { ... BreadcrumbList JSON-LD ... }
//
// Example service_schema:
// {
//   "@context": "https://schema.org",
//   "@type": "Service",
//   "name": "Legal Consultation",
//   "description": "Get expert legal advice from certified professionals.",
//   "image": "https://cdn.example.com/service-thumb.jpg",
//   "provider": { "@type": "Organization", "name": "Example Co", "url": "https://example.com" },
//   "offers": { "@type": "Offer", "price": 150, "priceCurrency": "USD" },
//   "serviceType": "Legal",
//   "areaServed": { "@type": "Place", "url": "https://example.com" },
//   "aggregateRating": { "@type": "AggregateRating", "ratingValue": 4.8, "reviewCount": 12 },
//   "keywords": "legal, consultation, lawyer, business law"
// }
//
// Example breadcrumb_schema:
// {
//   "@context": "https://schema.org",
//   "@type": "BreadcrumbList",
//   "itemListElement": [
//     { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com" },
//     { "@type": "ListItem", "position": 2, "name": "Legal", "item": "https://example.com/services?categoryId=cat-uuid" },
//     { "@type": "ListItem", "position": 3, "name": "Legal Consultation", "item": "https://example.com/services/legal-consultation" }
//   ]
// }`}
              />
            </div>

            <div className="pt-2 border-t">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  const lines = [
                    `Client ID: ${activeClient?.id || "N/A"}`,
                    `Domain: ${clientUrl || "N/A"}`,
                    "",
                    "Endpoints:",
                    `GET /api/public/services?clientId=${activeClient?.id || "{clientId}"}`,
                    `GET /api/public/services/{slug}?clientId=${activeClient?.id || "{clientId}"}`,
                    `GET /api/public/services/{slug}/faqs?clientId=${activeClient?.id || "{clientId}"}`,
                    `GET /api/public/services/categories?clientId=${activeClient?.id || "{clientId}"}`,
                  ];
                  navigator.clipboard.writeText(lines.join("\n"));
                  setCopiedField("all");
                  setTimeout(() => setCopiedField(null), 1500);
                }}
              >
                {copiedField === "all" ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                Copy All Endpoints
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApiParamTable({ params }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Parameter</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Required</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {params.map((p) => (
            <tr key={p.name}>
              <td className="px-3 py-2 font-mono text-blue-700">{p.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.type}</td>
              <td className="px-3 py-2">
                {p.required ? (
                  <span className="text-red-600 font-semibold">Yes</span>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApiFieldTable({ fields }) {
  return (
    <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted sticky top-0">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Field</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {fields.map((f) => (
            <tr key={f.name}>
              <td className="px-3 py-2 font-mono text-blue-700">{f.name}</td>
              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{f.type}</td>
              <td className="px-3 py-2 text-muted-foreground">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApiCodeBlock({ title, code }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      {title && (
        <div className="px-3 py-1.5 bg-muted border-b text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span>{title}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
      <pre className="p-3 text-xs font-mono bg-muted/30 overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}

function ApiCopyRow({ label, value, field, copiedField, onCopy }) {
  const isCopied = copiedField === field;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-mono truncate" title={value}>{value}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0"
        onClick={() => onCopy(value, field)}
        disabled={!value || value === "N/A"}
      >
        {isCopied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

function ApiEndpointRow({ method, label, url, field, copiedField, onCopy }) {
  const isCopied = copiedField === field;
  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
          {method}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1 truncate" title={url}>
          {url}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={() => onCopy(url, field)}
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
