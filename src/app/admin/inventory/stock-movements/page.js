"use client";

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
import {
  Search,
  Loader2,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import SelectInput from "@/components/ui/select";
import AdminPageHeader from "@/components/AdminPageHeader";
import AlertComponent from "@/components/ui/alert-component";
import { useAuth } from "@/contexts/auth-context";

const PAGE_SIZE = 20;

const MOVEMENT_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "restock", label: "Restock" },
  { value: "sale", label: "Sale" },
  { value: "adjustment", label: "Adjustment" },
  { value: "return", label: "Return" },
  { value: "damage", label: "Damage/Loss" },
  { value: "transfer", label: "Transfer" },
];

function getMovementBadgeClass(type) {
  switch (type) {
    case "restock":
    case "return":
      return "bg-green-50 text-green-700 border border-green-200";
    case "sale":
    case "damage":
      return "bg-red-50 text-red-700 border border-red-200";
    case "adjustment":
      return "bg-yellow-50 text-yellow-700 border border-yellow-200";
    case "transfer":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200";
  }
}

export default function StockMovementsPage() {
  const router = useRouter();
  const { activeClient } = useAuth();
  const [movements, setMovements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedItemId, setSelectedItemId] = useState("all");
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [items, setItems] = useState([]);

  const fetchMovements = useCallback(async (targetPage) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      });
      if (selectedType && selectedType !== "all") params.set("movement_type", selectedType);
      if (selectedItemId && selectedItemId !== "all") params.set("itemId", selectedItemId);
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(`/api/v1/inventory/stock-movements?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch stock movements");
      const json = await res.json();
      setMovements(json.data || json.movements || []);
      if (json.pagination) {
        setPagination(json.pagination);
      }
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      setErrorMessage(error.message || "Failed to fetch stock movements");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, selectedItemId, searchTerm]);

  useEffect(() => {
    if (!activeClient?.id) return;
    fetchMovements(page);
  }, [page, selectedType, selectedItemId, activeClient, fetchMovements]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/inventory?limit=100&active=true");
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.data || []);
    } catch (error) {
      console.error("Error fetching items for filter:", error);
    }
  }, []);

  useEffect(() => {
    if (activeClient?.id) {
      fetchItems();
    }
  }, [activeClient, fetchItems]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchMovements(1);
  };

  const resetSearch = () => {
    setSearchTerm("");
    setPage(1);
  };

  const handleTypeFilterChange = (value) => {
    setSelectedType(value || "all");
    setPage(1);
  };

  const handleItemFilterChange = (value) => {
    setSelectedItemId(value || "all");
    setPage(1);
  };

  const startItem = (pagination.page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(pagination.page * PAGE_SIZE, pagination.totalItems);

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Stock Movements"
          description="Audit trail of all stock changes across inventory"
          backLink="/admin/inventory"
          backIcon={<ArrowLeft size={16} />}
        />

        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Stock Movement History</CardTitle>
            <CardDescription>
              View all stock movements including restocks, sales, adjustments, and more
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <form onSubmit={handleSearch} className="flex items-center space-x-2">
                  <Input
                    type="text"
                    placeholder="Search by item or reason..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-[250px]"
                  />
                  <Button type="submit" variant="outline" size="icon" title="Search">
                    <Search className="h-4 w-4" />
                  </Button>
                  {searchTerm && (
                    <Button type="button" variant="ghost" size="sm" onClick={resetSearch} className="text-xs">
                      Clear
                    </Button>
                  )}
                </form>
                <div className="flex gap-3 items-center flex-wrap">
                  <div className="w-[160px]">
                    <SelectInput
                      placeholder="All Types"
                      value={selectedType}
                      onChange={(e) => handleTypeFilterChange(e.target.value)}
                      options={MOVEMENT_TYPE_OPTIONS}
                    />
                  </div>
                  <div className="w-[200px]">
                    <SelectInput
                      placeholder="All Items"
                      value={selectedItemId}
                      onChange={(e) => handleItemFilterChange(e.target.value)}
                      options={[
                        { value: "all", label: "All Items" },
                        ...items.map((item) => ({ value: item.id, label: item.title })),
                      ]}
                    />
                  </div>
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
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Qty Change
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Stock After
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Reason
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Recorded By
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {movements.map((m) => (
                          <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {m.created_at ? new Date(m.created_at).toLocaleString() : "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {m.item?.title || m.item_title || "-"}
                              </div>
                              {m.item?.sku && (
                                <div className="text-xs text-gray-500">{m.item.sku}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMovementBadgeClass(m.movement_type)}`}>
                                {m.movement_type === "restock" || m.movement_type === "return" ? (
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                ) : m.movement_type === "sale" || m.movement_type === "damage" ? (
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                ) : (
                                  <ArrowDownUp className="h-3 w-3 mr-1" />
                                )}
                                {m.movement_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-sm font-semibold ${
                                m.quantity_change > 0 ? "text-green-600" : m.quantity_change < 0 ? "text-red-600" : "text-gray-500"
                              }`}>
                                {m.quantity_change > 0 ? "+" : ""}{m.quantity_change}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {m.quantity_after ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {m.reason || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {m.user?.name || m.created_by || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {movements.length === 0 && (
                    <div className="text-center py-10">
                      <Package className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No stock movements found</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try changing your search or filter criteria.
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

      <AlertComponent
        open={errorDialogOpen}
        onOpenChange={setErrorDialogOpen}
        title="Error"
        message={errorMessage}
        actionLabel="OK"
      />
    </div>
  );
}
