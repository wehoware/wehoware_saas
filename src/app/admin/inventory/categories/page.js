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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Edit, Trash2, Check, X, ArrowLeft, Search, FolderTree, Tag } from "lucide-react";

import AdminPageHeader from "@/components/AdminPageHeader";
import AlertComponent from "@/components/ui/alert-component";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export default function InventoryCategoriesPage() {
  const router = useRouter();
  const { user, activeClient } = useAuth();
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    icon_url: "",
    active: true,
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);

      if (!activeClient?.id) {
        setErrorMessage("No active client selected. Cannot fetch categories.");
        setErrorDialogOpen(true);
        setCategories([]);
        return;
      }

      const res = await fetch("/api/v1/inventory/categories");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch categories");
      const json = await res.json();
      setCategories(json.data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      setErrorMessage(error.message || "Failed to fetch categories");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, [activeClient]);

  useEffect(() => {
    if (activeClient) {
      fetchCategories();
    }
  }, [activeClient, fetchCategories]);

  const handleInputChange = (e, isNewCategory = false) => {
    const { name, value } = e.target;
    if (isNewCategory) {
      setNewCategory((prev) => ({ ...prev, [name]: value }));
    } else if (editingCategory) {
      setEditingCategory((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSwitchChange = (checked, name, isNewCategory = false) => {
    if (isNewCategory) {
      setNewCategory((prev) => ({ ...prev, [name]: checked }));
    } else if (editingCategory) {
      setEditingCategory((prev) => ({ ...prev, [name]: checked }));
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();

    if (!activeClient?.id) {
      setErrorMessage("No active client selected. Cannot add category.");
      setErrorDialogOpen(true);
      return;
    }

    if (!newCategory.name) {
      setErrorMessage("Category name is required");
      setErrorDialogOpen(true);
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await fetch("/api/v1/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategory.name,
          description: newCategory.description,
          icon_url: newCategory.icon_url || null,
          active: newCategory.active,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to add category");

      setNewCategory({ name: "", description: "", icon_url: "", active: true });
      setShowAddForm(false);
      fetchCategories();

      setSuccessMessage("Category added successfully!");
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error adding category:", error);
      setErrorMessage(error.message || "Failed to add category");
      setErrorDialogOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory.name) {
      setErrorMessage("Category name cannot be empty");
      setErrorDialogOpen(true);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/v1/inventory/categories/${editingCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingCategory.name,
          description: editingCategory.description,
          icon_url: editingCategory.icon_url || null,
          active: editingCategory.active,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to update category");

      setEditingCategory(null);
      fetchCategories();

      setSuccessMessage("Category updated successfully!");
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error updating category:", error);
      setErrorMessage(error.message || "Failed to update category");
      setErrorDialogOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      setDeleteLoading(true);

      const res = await fetch(`/api/v1/inventory/categories/${categoryToDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to delete category");

      setCategories((prev) => prev.filter((category) => category.id !== categoryToDelete.id));

      setSuccessMessage("Category deleted successfully!");
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error deleting category:", error);
      setErrorMessage(error.message || "Failed to delete category");
      setErrorDialogOpen(true);
    } finally {
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      setDeleteLoading(false);
    }
  };

  const filteredCategories = categories.filter(
    (category) =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (category.description &&
        category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col">
      <div>
        <AdminPageHeader
          title="Inventory Categories"
          description="Manage inventory categories"
          backLink="/admin/inventory"
          backIcon={<ArrowLeft size={16} />}
          actionLabel={showAddForm ? "Cancel" : "Add Category"}
          actionIcon={showAddForm ? <X size={16} /> : <Plus size={16} />}
          onAction={() => setShowAddForm(!showAddForm)}
        />

        {showAddForm && (
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Add New Category</CardTitle>
              <CardDescription>Create a new inventory category</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddCategory} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Category Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={newCategory.name}
                      onChange={(e) => handleInputChange(e, true)}
                      placeholder="Enter category name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="icon_url">Icon URL</Label>
                    <Input
                      id="icon_url"
                      name="icon_url"
                      value={newCategory.icon_url}
                      onChange={(e) => handleInputChange(e, true)}
                      placeholder="https://example.com/icon.png"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={newCategory.description}
                    onChange={(e) => handleInputChange(e, true)}
                    placeholder="Enter category description"
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    name="active"
                    checked={newCategory.active}
                    onCheckedChange={(checked) => handleSwitchChange(checked, "active", true)}
                  />
                  <Label htmlFor="active">Active</Label>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-border/40">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewCategory({ name: "", description: "", icon_url: "", active: true });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Add Category
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              Categories
            </CardTitle>
            <CardDescription>Manage your inventory categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="search"
                    placeholder="Search categories..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="overflow-auto rounded-lg border border-border/40 scrollbar-thin">
                    <table className="w-full">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Icon URL</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                          <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredCategories.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="p-0">
                              <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                                  <FolderTree className="h-7 w-7 text-muted-foreground" />
                                </div>
                                <h3 className="text-base font-medium">No categories found</h3>
                                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                  {searchTerm
                                    ? "Try changing your search criteria."
                                    : `Get started by adding your first inventory category${activeClient ? ` for ${activeClient.name}` : ""}.`}
                                </p>
                                {!searchTerm && (
                                  <Button
                                    className="mt-4"
                                    size="sm"
                                    onClick={() => setShowAddForm(true)}
                                  >
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Add Category
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredCategories.map((category) => (
                            <tr key={category.id} className="hover:bg-muted/40 transition-colors">
                              <td className="p-3">
                                {editingCategory && editingCategory.id === category.id ? (
                                  <Input
                                    name="name"
                                    value={editingCategory.name}
                                    onChange={handleInputChange}
                                    placeholder="Enter category name"
                                    required
                                  />
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                      <Tag className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="font-medium text-sm truncate max-w-[200px]" title={category.name}>
                                      {category.name}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="p-3 max-w-xs">
                                {editingCategory && editingCategory.id === category.id ? (
                                  <Textarea
                                    name="description"
                                    value={editingCategory.description}
                                    onChange={handleInputChange}
                                    placeholder="Enter category description"
                                    rows={2}
                                  />
                                ) : (
                                  <div className="text-sm text-muted-foreground truncate" title={category.description || ""}>
                                    {category.description || <span className="italic">No description</span>}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 max-w-xs">
                                {editingCategory && editingCategory.id === category.id ? (
                                  <Input
                                    name="icon_url"
                                    value={editingCategory.icon_url || ""}
                                    onChange={handleInputChange}
                                    placeholder="https://example.com/icon.png"
                                  />
                                ) : (
                                  <div className="text-sm text-muted-foreground truncate" title={category.icon_url || ""}>
                                    {category.icon_url || <span className="italic">—</span>}
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                {editingCategory && editingCategory.id === category.id ? (
                                  <Switch
                                    name="active"
                                    checked={editingCategory.active}
                                    onCheckedChange={(checked) => handleSwitchChange(checked, "active")}
                                  />
                                ) : (
                                  <span className={cn(
                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                    category.active
                                      ? "bg-green-500/10 text-green-600"
                                      : "bg-muted text-muted-foreground"
                                  )}>
                                    {category.active ? "Active" : "Inactive"}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                {editingCategory && editingCategory.id === category.id ? (
                                  <div className="flex space-x-1 justify-end">
                                    <Button variant="outline" size="icon" onClick={handleUpdateCategory} disabled={isSubmitting} title="Save">
                                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => setEditingCategory(null)} title="Cancel">
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex space-x-1 justify-end">
                                    <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditingCategory(category)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" title="Delete" onClick={() => openDeleteDialog(category)} className="text-muted-foreground hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {filteredCategories.length > 0 && (
                    <div className="text-sm text-muted-foreground tabular-nums">
                      Showing <span className="font-medium text-foreground">{filteredCategories.length}</span> of {categories.length} categories
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
        message={`This will permanently delete the category "${categoryToDelete?.name}". This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteCategory}
        isLoading={deleteLoading}
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
    </div>
  );
}
