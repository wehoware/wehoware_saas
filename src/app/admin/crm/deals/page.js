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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import DealForm from "@/components/crm/DealForm";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "react-hot-toast";

const STATUS_VARIANTS = {
  Open: "secondary",
  Won: "default",
  Lost: "destructive",
};

export default function DealsPage() {
  const router = useRouter();
  const { activeClient, user, isLoading: authLoading } = useAuth();
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchDeals = useCallback(async () => {
    if (!activeClient) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (searchTerm) params.set("search", searchTerm);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/v1/crm/deals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch deals");
      const { data, pagination } = await res.json();
      setDeals(data || []);
      setTotalPages(pagination?.totalPages || 1);
      setTotalItems(pagination?.totalItems || 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeClient, page, searchTerm, statusFilter]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (activeClient) {
        fetchDeals();
      }
    }
  }, [authLoading, user, activeClient, router, fetchDeals]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDeals();
  };

  const handleEdit = (deal) => {
    setEditingDeal(deal);
    setDealFormOpen(true);
  };

  const handleCreate = () => {
    setEditingDeal(null);
    setDealFormOpen(true);
  };

  const handleDelete = async () => {
    if (!dealToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/crm/deals/${dealToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete deal");
      }
      toast.success("Deal deleted");
      setDeleteDialogOpen(false);
      setDealToDelete(null);
      fetchDeals();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Deals"
        description="Manage your sales deals and track progress"
        actionLabel="New Deal"
        actionIcon={<Plus className="h-4 w-4" />}
        onAction={handleCreate}
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deals..."
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
              <option value="Open">Open</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Deals ({totalItems})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No deals found. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Title</th>
                    <th className="pb-2 pr-4 font-medium">Contact</th>
                    <th className="pb-2 pr-4 font-medium">Stage</th>
                    <th className="pb-2 pr-4 font-medium">Value</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Close Date</th>
                    <th className="pb-2 pr-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr key={deal.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 pr-4 font-medium">{deal.title}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {deal.contact
                          ? `${deal.contact.first_name} ${deal.contact.last_name}`
                          : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        {deal.stage && (
                          <span className="flex items-center gap-1.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: deal.stage.color || "#6b7280" }}
                            />
                            {deal.stage.name}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-bold text-green-600">
                        ${deal.value ? Number(deal.value).toLocaleString() : 0}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={STATUS_VARIANTS[deal.status] || "secondary"}>
                          {deal.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {deal.expected_close_date
                          ? new Date(deal.expected_close_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(deal)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setDealToDelete(deal);
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

      <DealForm
        open={dealFormOpen}
        onOpenChange={setDealFormOpen}
        deal={editingDeal}
        onSaved={() => {
          setDealFormOpen(false);
          setEditingDeal(null);
          fetchDeals();
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Deal"
        description={`Are you sure you want to delete "${dealToDelete?.title}"?`}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
