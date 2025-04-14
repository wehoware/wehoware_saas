"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import slugify from "slugify";
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
import { Loader2, Plus, Edit, Trash2, Check, X, ArrowLeft } from "lucide-react";
import supabase from "@/lib/supabase";
import AdminPageHeader from "@/components/AdminPageHeader";
import AlertComponent from "@/components/ui/alert-component";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/auth-context";

export default function ServiceCategoriesPage() {
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

  useEffect(() => {
    if (activeClient) {
      fetchCategories();
    }
  }, [activeClient]);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);

      if (!activeClient?.id) {
        setErrorMessage("No active client selected. Cannot fetch categories.");
        setErrorDialogOpen(true);
        setCategories([]);
        return;
      }

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
      setErrorMessage(error.message || "Failed to fetch categories");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

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

      const categoryData = {
        client_id: activeClient.id,
        name: newCategory.name,
        slug: slugify(newCategory.name, { lower: true, strict: true }),
        description: newCategory.description,
        icon_url: newCategory.icon_url || null,
        active: newCategory.active,
        created_by: user?.id,
        updated_by: user?.id,
      };

      const { data, error } = await supabase
        .from("wehoware_service_categories")
        .insert(categoryData);

      if (error) {
        throw error;
      }

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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;

    const slug = slugify(editingCategory.name, { lower: true, strict: true });

    try {
      setIsSubmitting(true);

      const { error } = await supabase
        .from("wehoware_service_categories")
        .update({
          name: editingCategory.name,
          slug: slug,
          description: editingCategory.description,
          icon_url: editingCategory.icon_url || null,
          active: editingCategory.active,
          updated_at: new Date(),
          updated_by: userId,
        })
        .eq("id", editingCategory.id);

      if (error) throw error;

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

      const { data: serviceData, error: serviceError } = await supabase
        .from("wehoware_services")
        .select("id")
        .eq("category_id", categoryToDelete.id)
        .limit(1);

      if (serviceError) {
        throw serviceError;
      }

      if (serviceData && serviceData.length > 0) {
        throw new Error("Cannot delete category that is in use by services");
      }

      const { error } = await supabase
        .from("wehoware_service_categories")
        .delete()
        .eq("id", categoryToDelete.id);

      if (error) {
        throw error;
      }

      setCategories((prev) =>
        prev.filter((category) => category.id !== categoryToDelete.id)
      );

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
          title="Service Categories"
          description="Manage service categories"
          showBackButton={true}
          backButtonHref="/admin/categories"
          actionLabel={showAddForm ? "Cancel" : "Add Category"}
          actionIcon={showAddForm ? <X size={16} /> : <Plus size={16} />}
          onAction={() => setShowAddForm(!showAddForm)}
        />

        {showAddForm && (
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Add New Category</CardTitle>
              <CardDescription>Create a new service category</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddCategory} className="space-y-4">
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
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={newCategory.description}
                    onChange={(e) => handleInputChange(e, true)}
                    placeholder="Enter category description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="icon_url">Icon URL</Label>
                  <Input
                    id="icon_url"
                    name="icon_url"
                    value={newCategory.icon_url}
                    onChange={(e) => handleInputChange(e, true)}
                    placeholder="Enter icon URL"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    name="active"
                    checked={newCategory.active}
                    onCheckedChange={(checked) =>
                      handleSwitchChange(checked, "active", true)
                    }
                  />
                  <Label htmlFor="active">Active</Label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewCategory({
                        name: "",
                        description: "",
                        icon_url: "",
                        active: true,
                      });
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
                      "Add Category"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Manage your service categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center">
                <Input
                  type="search"
                  placeholder="Search categories..."
                  className="max-w-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="overflow-auto rounded-md border">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Name</th>
                          <th className="text-left p-3 font-medium">
                            Description
                          </th>
                          <th className="text-left p-3 font-medium">
                            Icon URL
                          </th>
                          <th className="text-left p-3 font-medium">Active</th>
                          <th className="text-left p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCategories.length === 0 ? (
                          <tr>
                            <td
                              colSpan="5"
                              className="p-4 text-center text-muted-foreground"
                            >
                              No categories found{" "}
                              {activeClient ? `for ${activeClient.name}` : ""}.
                              Try adding one!
                            </td>
                          </tr>
                        ) : (
                          filteredCategories.map((category) => (
                            <tr
                              key={category.id}
                              className="border-b border-gray-200 last:border-0"
                            >
                              <td className="p-3">
                                {editingCategory &&
                                editingCategory.id === category.id ? (
                                  <Input
                                    name="name"
                                    value={editingCategory.name}
                                    onChange={handleInputChange}
                                    placeholder="Enter category name"
                                    required
                                  />
                                ) : (
                                  category.name
                                )}
                              </td>
                              <td className="p-3">
                                {editingCategory &&
                                editingCategory.id === category.id ? (
                                  <Textarea
                                    name="description"
                                    value={editingCategory.description}
                                    onChange={handleInputChange}
                                    placeholder="Enter category description"
                                  />
                                ) : (
                                  <div className="text-sm text-muted-foreground truncate max-w-xs">
                                    {category.description || "-"}
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                {editingCategory &&
                                editingCategory.id === category.id ? (
                                  <Input
                                    name="icon_url"
                                    value={editingCategory.icon_url || ""}
                                    onChange={handleInputChange}
                                    placeholder="Enter icon URL"
                                  />
                                ) : (
                                  <div className="text-sm text-muted-foreground truncate max-w-xs">
                                    {category.icon_url || "-"}
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                {editingCategory &&
                                editingCategory.id === category.id ? (
                                  <Switch
                                    name="active"
                                    checked={editingCategory.active}
                                    onCheckedChange={(checked) =>
                                      handleSwitchChange(checked, "active")
                                    }
                                  />
                                ) : (
                                  <span
                                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                                      category.active
                                        ? "bg-green-100 text-green-800"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {category.active ? "Active" : "Inactive"}
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                {editingCategory &&
                                editingCategory.id === category.id ? (
                                  <div className="flex space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleUpdateCategory}
                                      disabled={isSubmitting}
                                    >
                                      {isSubmitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Check className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditingCategory(null)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Edit"
                                      onClick={() =>
                                        setEditingCategory(category)
                                      }
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Delete"
                                      onClick={() => openDeleteDialog(category)}
                                    >
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

                  <div className="text-sm text-muted-foreground">
                    Showing {filteredCategories.length} of {categories.length}{" "}
                    categories
                  </div>
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
