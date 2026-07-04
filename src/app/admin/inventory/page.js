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
  Package,
  Loader2,
  FolderTree,
  Copy,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Archive,
  Settings as SettingsIcon,
  Terminal,
  Check,
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

const ITEM_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "vehicle", label: "Vehicle" },
  { value: "furniture", label: "Furniture" },
  { value: "food", label: "Food" },
  { value: "menu", label: "Menu" },
  { value: "product", label: "Product" },
  { value: "digital", label: "Digital" },
  { value: "custom", label: "Custom" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
  { value: "sold", label: "Sold" },
  { value: "reserved", label: "Reserved" },
  { value: "archived", label: "Archived" },
];

function getStatusBadgeClass(status) {
  switch (status) {
    case "active":
      return "bg-green-50 text-green-700 border border-green-200";
    case "in_stock":
      return "bg-green-50 text-green-700 border border-green-200";
    case "low_stock":
      return "bg-orange-50 text-orange-700 border border-orange-200";
    case "draft":
      return "bg-yellow-50 text-yellow-700 border border-yellow-200";
    case "sold":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    case "reserved":
      return "bg-purple-50 text-purple-700 border border-purple-200";
    case "archived":
      return "bg-gray-50 text-gray-700 border border-gray-200";
    case "out_of_stock":
      return "bg-red-50 text-red-700 border border-red-200";
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200";
  }
}

function formatPrice(price, currency) {
  if (price === null || price === undefined) return "Call for price";
  return `${currency || "CAD"} ${Number(price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InventoryPage() {
  const router = useRouter();
  const { activeClient, clientUrl } = useAuth();
  const [items, setItems] = useState([]);
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
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [successMessage, setSuccessMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [itemToDelete, setItemToDelete] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, sold: 0, lowStock: 0, totalValue: 0 });

  const fetchItems = useCallback(async (targetPage) => {
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
      if (selectedType && selectedType !== "all") params.set("type", selectedType);
      if (selectedStatus && selectedStatus !== "all") params.set("status", selectedStatus);
      if (searchTerm) params.set("search", searchTerm);
      const res = await fetch(`/api/v1/inventory?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch inventory items");
      const json = await res.json();
      setItems(json.data || []);
      if (json.pagination) {
        setPagination(json.pagination);
      }
      if (json.stats) {
        setStats(json.stats);
      }
      setSelectedIds([]);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
      setErrorMessage(error.message || "Failed to fetch inventory items");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, [sortField, sortOrder, showActiveOnly, showFeaturedOnly, selectedCategoryId, selectedType, selectedStatus, searchTerm]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/inventory/categories");
      if (!res.ok) return;
      const json = await res.json();
      setCategories(json.data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  useEffect(() => {
    if (!activeClient?.id) return;
    fetchItems(page);
    fetchCategories();
  }, [page, sortField, sortOrder, showActiveOnly, showFeaturedOnly, selectedCategoryId, selectedType, selectedStatus, activeClient, fetchItems, fetchCategories]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchItems(1);
  };

  const resetSearch = () => {
    setSearchTerm("");
    setPage(1);
  };

  useEffect(() => {
    if (searchTerm === "" && activeClient?.id) {
      fetchItems(1);
    }
  }, [searchTerm, activeClient?.id, fetchItems]);

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

  const handleTypeFilterChange = (value) => {
    setSelectedType(value || "all");
    setPage(1);
  };

  const handleStatusFilterChange = (value) => {
    setSelectedStatus(value || "all");
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

  const openDeleteDialog = (item) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/v1/inventory/${itemToDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to delete item");
      setSuccessMessage("Inventory item deleted successfully!");
      setSuccessDialogOpen(true);
      fetchItems(page);
    } catch (error) {
      console.error("Error deleting item:", error);
      setErrorMessage(error.message || "Failed to delete item");
      setErrorDialogOpen(true);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setDeleteLoading(false);
    }
  };

  const handleClone = async (item) => {
    try {
      setCloneLoading(item.id);
      const res = await fetch(`/api/v1/inventory/${item.id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to clone item");
      const json = await res.json();
      router.push(`/admin/inventory/edit/${json.item.id}`);
    } catch (error) {
      console.error("Error cloning item:", error);
      setErrorMessage(error.message || "Failed to clone item");
      setErrorDialogOpen(true);
    } finally {
      setCloneLoading(null);
    }
  };

  const allOnPageSelected = items.length > 0 && items.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    const pageIds = items.map((s) => s.id);
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
      const res = await fetch("/api/v1/inventory/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selectedIds }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Bulk action failed");
      const json = await res.json();
      const count = json.updated ?? json.deleted ?? selectedIds.length;
      setSuccessMessage(`${count} item(s) ${action === "activate" ? "activated" : "deactivated"} successfully.`);
      setSuccessDialogOpen(true);
      setSelectedIds([]);
      fetchItems(page);
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
      const res = await fetch("/api/v1/inventory/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: selectedIds }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Bulk delete failed");
      const json = await res.json();
      const count = json.deleted ?? selectedIds.length;
      setSuccessMessage(`${count} item(s) deleted successfully.`);
      setSuccessDialogOpen(true);
      setSelectedIds([]);
      fetchItems(page);
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
          title="Inventory"
          description="Manage your inventory items"
          actionLabel="Add New"
          actionIcon={<Plus size={16} />}
          onAction={() => router.push("/admin/inventory/add")}
          secondaryActionLabel="Manage Categories"
          secondaryActionIcon={<FolderTree size={16} />}
          onSecondaryAction={() => router.push("/admin/inventory/categories")}
        />

        <div className="flex justify-end -mt-2 mb-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/admin/inventory/stock-movements")}
          >
            <Archive className="h-4 w-4 mr-2" />
            Stock Movements
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/admin/inventory/settings")}
          >
            <SettingsIcon className="h-4 w-4 mr-2" />
            Settings
          </Button>
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
            <CardTitle>Inventory Statistics</CardTitle>
            <CardDescription>
              Overview of your inventory performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Total Items
                </div>
                <div className="text-2xl font-bold">{stats.total || pagination.totalItems}</div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Active
                </div>
                <div className="text-2xl font-bold text-green-600">{stats.active || 0}</div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Sold
                </div>
                <div className="text-2xl font-bold text-blue-600">{stats.sold || 0}</div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Low Stock
                </div>
                <div className="text-2xl font-bold text-orange-600">{stats.lowStock || 0}</div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Total Value
                </div>
                <div className="text-2xl font-bold">
                  {stats.totalValue ? Number(stats.totalValue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
          <CardHeader>
            <CardTitle>Inventory Items</CardTitle>
            <CardDescription>
              Manage the items in your inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <form
                    onSubmit={handleSearch}
                    className="flex items-center space-x-2"
                  >
                    <Input
                      type="text"
                      placeholder="Search items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-[250px]"
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
                <div className="flex gap-3 items-center flex-wrap">
                  <div className="w-[140px]">
                    <SelectInput
                      placeholder="All Types"
                      value={selectedType}
                      onChange={(e) => handleTypeFilterChange(e.target.value)}
                      options={ITEM_TYPE_OPTIONS}
                    />
                  </div>
                  <div className="w-[150px]">
                    <SelectInput
                      placeholder="All Statuses"
                      value={selectedStatus}
                      onChange={(e) => handleStatusFilterChange(e.target.value)}
                      options={STATUS_OPTIONS}
                    />
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
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active-only"
                      checked={showActiveOnly}
                      onCheckedChange={handleFilterChange}
                    />
                    <Label htmlFor="active-only">Active</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="featured-only"
                      checked={showFeaturedOnly}
                      onCheckedChange={handleFeaturedFilterChange}
                    />
                    <Label htmlFor="featured-only">Featured</Label>
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
                      <DropdownMenuItem onClick={() => handleSort("price")}>
                        Sort by Price
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSort("created_at")}>
                        Sort by Date
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSort("quantity")}>
                        Sort by Stock
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
                            Image
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer max-w-[200px]"
                            onClick={() => handleSort("title")}
                          >
                            <div className="flex items-center gap-1">
                              Title
                              {sortField === "title" && (
                                <ArrowUpDown className="h-3 w-3" />
                              )}
                            </div>
                          </th>
                          {/* <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th> */}
                          {/* <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th> */}
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort("price")}
                          >
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Price
                              {sortField === "price" && (
                                <ArrowUpDown className="h-3 w-3" />
                              )}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort("quantity")}
                          >
                            <div className="flex items-center gap-1">
                              Stock
                              {sortField === "quantity" && (
                                <ArrowUpDown className="h-3 w-3" />
                              )}
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            SEO
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          {/* <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort("created_at")}
                          >
                            <div className="flex items-center gap-1">
                              Created
                              {sortField === "created_at" && (
                                <ArrowUpDown className="h-3 w-3" />
                              )}
                            </div>
                          </th> */}
                          <th
                            scope="col"
                            className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {items.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                checked={selectedIds.includes(item.id)}
                                onChange={() => toggleSelectOne(item.id)}
                              />
                            </td>
                            <td className="p-3">
                              <Image
                                src={item.thumbnail || item.images?.[0]?.url || "/images/blank.jpg"}
                                alt={
                                  item.title
                                    ? `Thumbnail for ${item.title}`
                                    : "Item thumbnail"
                                }
                                width={64}
                                height={64}
                                className="w-16 h-16 object-cover rounded"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                                    {item.title}
                                  </div>
                                  {/* <div className="text-sm text-gray-500">
                                    {item.sku || item.slug}
                                  </div>*/}
                                  {item.attributes?.make && item.attributes?.model && (
                                    <div className="text-xs text-gray-400">
                                      {item.attributes.make} {item.attributes.model}
                                      {item.attributes.year ? ` ${item.attributes.year}` : ""}
                                    </div>
                                  )} 
                                </div>
                              </div>
                            </td>
                            {/* <td className="px-4 py-3 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                {item.type || "custom"}
                              </span>
                            </td> */}
                            {/* <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {item.category?.name || (
                                  <span className="text-gray-400 italic">Uncategorized</span>
                                )}
                              </div>
                            </td> */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatPrice(item.price, item.currency)}
                              </div>
                              {!item.price_visible && item.price && (
                                <div className="text-xs text-orange-600">Hidden</div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {item.quantity ?? 0}
                              </div>
                              {item.quantity <= (item.reorder_threshold || 0) && item.quantity > 0 && (
                                <div className="text-xs text-orange-600">Low</div>
                              )}
                              {item.quantity === 0 && (
                                <div className="text-xs text-red-600">Out</div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <SeoHealthBadge score={item.seo_score} size="sm" />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(item.status)}`}
                              >
                                {item.status || "draft"}
                              </span>
                              {item.featured && (
                                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                  Featured
                                </span>
                              )}
                            </td>
                            {/* <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}
                              </div>
                            </td> */}
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex space-x-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="View"
                                  onClick={() =>
                                    window.open(
                                      `${clientUrl}/inventory/${item.slug}`,
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
                                      `/admin/inventory/edit/${item.id}`
                                    )
                                  }
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Clone"
                                  disabled={cloneLoading === item.id}
                                  onClick={() => handleClone(item)}
                                >
                                  {cloneLoading === item.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Delete"
                                  onClick={() => openDeleteDialog(item)}
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

                  {items.length === 0 && (
                    <div className="text-center py-10">
                      <Package className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No inventory items found</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try changing your search or filter criteria, or add a new item.
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
        message={`This will permanently delete the item "${itemToDelete?.title}". This action cannot be undone.`}
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
        title="Delete selected items?"
        message={`This will permanently delete ${selectedIds.length} item(s). This action cannot be undone.`}
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
                label="List Inventory Items"
                url={`/api/public/inventory?clientId=${activeClient?.id || "{clientId}"}`}
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
                label="Get Item by Slug"
                url={`/api/public/inventory/{slug}?clientId=${activeClient?.id || "{clientId}"}`}
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
                label="List Categories"
                url={`/api/public/inventory/categories?clientId=${activeClient?.id || "{clientId}"}`}
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
                  { name: "page", type: "integer", required: false, description: "Page number for list endpoint. Default: 1" },
                  { name: "limit", type: "integer", required: false, description: "Items per page. Default: 10, Max: 100" },
                  { name: "search", type: "string", required: false, description: "Search in title, description, and SKU." },
                  { name: "categoryId", type: "string (UUID)", required: false, description: "Filter by category ID." },
                  { name: "type", type: "string", required: false, description: "Filter by item type (vehicle, product, furniture, food, menu)." },
                  { name: "featured", type: "boolean", required: false, description: "Filter featured items only." },
                  { name: "sortBy", type: "string", required: false, description: "created_at, updated_at, title, price, featured. Default: created_at" },
                  { name: "sortOrder", type: "string", required: false, description: "asc or desc. Default: desc" },
                ]}
              />
            </div>

            {/* Response Fields */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Inventory Item Response Fields
              </h4>
              <ApiFieldTable
                fields={[
                  { name: "id", type: "string (UUID)", description: "Unique item identifier" },
                  { name: "client_id", type: "string (UUID)", description: "Owner client ID" },
                  { name: "category_id", type: "string (UUID) | null", description: "Category reference" },
                  { name: "title", type: "string", description: "Item title" },
                  { name: "slug", type: "string", description: "URL-friendly identifier" },
                  { name: "type", type: "string", description: "Item type (vehicle, product, furniture, food, menu)" },
                  { name: "sku", type: "string | null", description: "Stock keeping unit" },
                  { name: "description", type: "string | null", description: "Short description (HTML)" },
                  { name: "thumbnail", type: "string | null", description: "Thumbnail image URL" },
                  { name: "thumbnail_alt", type: "string | null", description: "Alt text for thumbnail" },
                  { name: "price", type: "number | null", description: "Item price" },
                  { name: "currency", type: "string", description: "Currency code (e.g. CAD)" },
                  { name: "price_visible", type: "boolean", description: "Whether price is publicly visible" },
                  { name: "price_label", type: "string | null", description: "Derived label: 'Contact for pricing' or 'Free' if price is 0" },
                  { name: "quantity", type: "integer", description: "Stock quantity" },
                  { name: "status", type: "string", description: "Item status (active, in_stock, low_stock, out_of_stock, sold, reserved, archived)" },
                  { name: "tags", type: "string[]", description: "Array of tag strings" },
                  { name: "featured", type: "boolean", description: "Featured flag" },
                  { name: "attributes", type: "object | null", description: "Custom attributes (make, model, year, mileage, transmission, fuel_type, body_type, etc.)" },
                  { name: "images", type: "array | null", description: "Gallery image URLs" },
                  { name: "videos", type: "array | null", description: "Gallery video URLs" },
                  { name: "meta_title", type: "string | null", description: "SEO meta title" },
                  { name: "meta_description", type: "string | null", description: "SEO meta description" },
                  { name: "meta_keywords", type: "string | null", description: "SEO meta keywords" },
                  { name: "views", type: "integer", description: "View count" },
                  { name: "created_at", type: "ISO 8601", description: "Creation timestamp" },
                  { name: "updated_at", type: "ISO 8601", description: "Last update timestamp" },
                  { name: "category", type: "object | null", description: "{ id, name, slug }" },
                ]}
              />
            </div>

            {/* Single Item Extra Fields */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Single Item Extra Fields
              </h4>
              <ApiFieldTable
                fields={[
                  { name: "content", type: "string | null", description: "Full HTML content/body" },
                  { name: "reorder_threshold", type: "integer", description: "Low-stock reorder threshold" },
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
                  { name: "schema.item_list", type: "object", description: "ItemList JSON-LD for list endpoints. Contains itemListElement[] with position, url, and name for each item." },
                  { name: "schema.collection_page", type: "object", description: "CollectionPage JSON-LD for list endpoints. Contains name, description, and url of the inventory collection." },
                  { name: "product_schema", type: "object", description: "Product/Vehicle JSON-LD for single item. Includes name, description, image, brand, offers (price, currency), keywords, and vehicle attributes (model, year, mileage, VIN) when applicable." },
                  { name: "breadcrumb_schema", type: "object | null", description: "BreadcrumbList JSON-LD for single item. Contains itemListElement[] with position, name, and url for Home > Category > Item." },
                ]}
              />
            </div>

            {/* Example: List */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Example: List Inventory Items
              </h4>
              <ApiCodeBlock
                title="GET /api/public/inventory?clientId={id}"
                code={`{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "client_id": "client-uuid-1234",
      "category_id": "cat-uuid",
      "title": "2019 BMW M850i xDrive Coupe",
      "slug": "2019-bmw-m850i-xdrive-coupe",
      "type": "vehicle",
      "sku": "BMW-M850I-2019",
      "description": "<p>4.4L TwinPower Turbo V8 with xDrive AWD.</p>",
      "thumbnail": "https://cdn.example.com/inventory/bmw.jpg",
      "thumbnail_alt": "2019 BMW M850i front view",
      "price": 59999.00,
      "currency": "CAD",
      "price_visible": true,
      "price_label": null,
      "quantity": 1,
      "status": "in_stock",
      "tags": ["bmw", "coupe", "v8"],
      "featured": true,
      "attributes": {
        "make": "BMW",
        "model": "8-Series",
        "year": "2019",
        "mileage": "50000",
        "transmission": "Auto",
        "fuel_type": "gasoline",
        "body_type": "coupe",
        "exterior_color": "blue",
        "interior_color": "red",
        "doors": "2",
        "seats": "4",
        "condition": "Used"
      },
      "images": [
        "https://cdn.example.com/inventory/bmw-1.jpg",
        "https://cdn.example.com/inventory/bmw-2.jpg"
      ],
      "videos": [
        "https://cdn.example.com/inventory/bmw-walkaround.mp4"
      ],
      "meta_title": "2019 BMW M850i xDrive Coupe | Nawab Motors",
      "meta_description": "TwinPower Turbo V8 with xDrive AWD. Red leather interior.",
      "meta_keywords": "bmw, m850i, coupe, v8, xdrive",
      "views": 342,
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-06-01T14:22:00Z",
      "category": {
        "id": "cat-uuid",
        "name": "Luxury Vehicles",
        "slug": "luxury-vehicles"
      }
    }
  ],
  "pagination": {
    "totalItems": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  },
  "schema": {
    "item_list": {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "url": "https://example.com/inventory/2019-bmw-m850i-xdrive-coupe",
          "name": "2019 BMW M850i xDrive Coupe"
        }
      ]
    },
    "collection_page": {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Inventory",
      "description": "Example Co inventory items",
      "url": "https://example.com/inventory"
    }
  }
}`}
              />
            </div>

            {/* Example: Single Item */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Example: Get Item by Slug
              </h4>
              <ApiCodeBlock
                title="GET /api/public/inventory/{slug}?clientId={id}"
                code={`{
  "item": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "client_id": "client-uuid-1234",
    "category_id": "cat-uuid",
    "title": "2019 BMW M850i xDrive Coupe",
    "slug": "2019-bmw-m850i-xdrive-coupe",
    "type": "vehicle",
    "sku": "BMW-M850I-2019",
    "description": "<p>4.4L TwinPower Turbo V8 with xDrive AWD.</p>",
    "content": "<p>Full description with features and specifications...</p>",
    "thumbnail": "https://cdn.example.com/inventory/bmw.jpg",
    "thumbnail_alt": "2019 BMW M850i front view",
    "price": 59999.00,
    "currency": "CAD",
    "price_visible": true,
    "price_label": null,
    "quantity": 1,
    "reorder_threshold": 0,
    "status": "in_stock",
    "tags": ["bmw", "coupe", "v8"],
    "featured": true,
    "attributes": {
      "make": "BMW",
      "model": "8-Series",
      "year": "2019",
      "mileage": "50000",
      "transmission": "Auto",
      "fuel_type": "gasoline",
      "body_type": "coupe",
      "exterior_color": "blue",
      "interior_color": "red",
      "engine_size": "4.4",
      "doors": "2",
      "seats": "4",
      "condition": "Used"
    },
    "images": [
      "https://cdn.example.com/inventory/bmw-1.jpg",
      "https://cdn.example.com/inventory/bmw-2.jpg"
    ],
    "videos": [
      "https://cdn.example.com/inventory/bmw-walkaround.mp4"
    ],
    "meta_title": "2019 BMW M850i xDrive Coupe | Nawab Motors",
    "meta_description": "TwinPower Turbo V8 with xDrive AWD. Red leather interior.",
    "meta_keywords": "bmw, m850i, coupe, v8, xdrive",
    "views": 343,
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-06-01T14:22:00Z",
    "category": {
      "id": "cat-uuid",
      "name": "Luxury Vehicles",
      "slug": "luxury-vehicles"
    }
  },
  "product_schema": {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    "name": "2019 BMW M850i xDrive Coupe",
    "description": "TwinPower Turbo V8 with xDrive AWD. Red leather interior.",
    "image": "https://cdn.example.com/inventory/bmw.jpg",
    "brand": {
      "@type": "Brand",
      "name": "Nawab Motors"
    },
    "offers": {
      "@type": "Offer",
      "price": 59999,
      "priceCurrency": "CAD"
    },
    "model": "8-Series",
    "vehicleModelDate": "2019",
    "mileageFromOdometer": "50000"
  },
  "breadcrumb_schema": {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com" },
      { "@type": "ListItem", "position": 2, "name": "Luxury Vehicles", "item": "https://example.com/inventory?categoryId=cat-uuid" },
      { "@type": "ListItem", "position": 3, "name": "2019 BMW M850i xDrive Coupe", "item": "https://example.com/inventory/2019-bmw-m850i-xdrive-coupe" }
    ]
  }
}`}
              />
            </div>

            {/* Error Responses */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Error Responses
              </h4>
              <ApiFieldTable
                fields={[
                  { name: "404", type: "Client not found / Item not found", description: "Returned when the client or item slug does not exist." },
                  { name: "403", type: "Client is inactive", description: "Returned when the client account is deactivated." },
                  { name: "500", type: "Internal server error", description: "Unexpected server-side failure. Check server logs." },
                ]}
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
                    `GET /api/public/inventory?clientId=${activeClient?.id || "{clientId}"}`,
                    `GET /api/public/inventory/{slug}?clientId=${activeClient?.id || "{clientId}"}`,
                    `GET /api/public/inventory/categories?clientId=${activeClient?.id || "{clientId}"}`,
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
