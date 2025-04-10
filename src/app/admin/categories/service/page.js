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
import { Loader2, Plus, Edit, Trash2, Check, X } from "lucide-react";
import supabase from "@/lib/supabase";
import AdminPageHeader from "@/components/AdminPageHeader";
import AlertComponent from "@/components/ui/alert-component";
import ConfirmDialog from "@/components/ui/confirm-dialog";

export default function ServiceCategoriesPage() {
  const router = useRouter();
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
  });
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
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
    } else {
      setEditingCategory((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    
    if (!newCategory.name) {
      setErrorMessage("Category name is required");
      setErrorDialogOpen(true);
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Generate slug from name
      const slug = slugify(newCategory.name, { lower: true, strict: true });
      
      // Get the current user ID for audit
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const { data, error } = await supabase.from("service_categories").insert({
        name: newCategory.name,
        slug: slug,
        description: newCategory.description,
        created_by: userId,
        updated_by: userId,
      });

      if (error) {
        throw error;
      }

      // Reset form and refresh categories
      setNewCategory({ name: "", description: "" });
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

  const startEditing = (category) => {
    setEditingCategory({ ...category });
  };

  const cancelEditing = () => {
    setEditingCategory(null);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory.name) {
      setErrorMessage("Category name is required");
      setErrorDialogOpen(true);
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Generate slug from name
      const slug = slugify(editingCategory.name, { lower: true, strict: true });
      
      // Get the current user ID for audit
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const { data, error } = await supabase
        .from("service_categories")
        .update({
          name: editingCategory.name,
          slug: slug,
          description: editingCategory.description,
          updated_by: userId,
        })
        .eq("id", editingCategory.id);

      if (error) {
        throw error;
      }

      // Reset editing state and refresh categories
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

      // Check if category is in use
      const { data: serviceData, error: serviceError } = await supabase
        .from("services")
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
        .from("service_categories")
        .delete()
        .eq("id", categoryToDelete.id);

      if (error) {
        throw error;
      }

      // Update local state without refetching
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

  // Filter categories based on search term
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Service Categories"
          description="Manage service categories"
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

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewCategory({ name: "", description: "" });
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
                          <th className="text-left p-3 font-medium">Description</th>
                          <th className="text-left p-3 font-medium">Slug</th>
                          <th className="text-left p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCategories.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="p-4 text-center text-muted-foreground">
                              No categories found
                            </td>
                          </tr>
                        ) : (
                          filteredCategories.map((category) => (
                            <tr
                              key={category.id}
                              className="border-b border-gray-200 last:border-0"
                            >
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
                                  <div className="font-medium">{category.name}</div>
                                )}
                              </td>
                              <td className="p-3">
                                {editingCategory && editingCategory.id === category.id ? (
                                  <Textarea
                                    name="description"
                                    value={editingCategory.description || ""}
                                    onChange={handleInputChange}
                                    placeholder="Enter description"
                                    className="min-h-[80px]"
                                  />
                                ) : (
                                  <div className="text-sm text-muted-foreground">
                                    {category.description || "No description"}
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="text-sm text-muted-foreground">
                                  {category.slug}
                                </div>
                              </td>
                              <td className="p-3">
                                {editingCategory && editingCategory.id === category.id ? (
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
                                      onClick={cancelEditing}
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
                                      onClick={() => startEditing(category)}
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
                    Showing {filteredCategories.length} of {categories.length} categories
                  </div>
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
        message={`This will permanently delete the category "${categoryToDelete?.name}". This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteCategory}
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
