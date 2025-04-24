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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Calendar,
  User,
  ArrowUpDown,
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
import { deleteThumbnailByUrl } from "@/lib/storageUtils";

export default function BlogsPage() {
  const router = useRouter();
  const { activeClient, clientUrl } = useAuth();
  const [blogs, setBlogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPublishedOnly, setShowPublishedOnly] = useState(false);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [blogToDelete, setBlogToDelete] = useState(null);
  const [categories, setCategories] = useState([]);

  // Fetch blogs when sort or filter changes
  useEffect(() => {
    fetchBlogs();
    fetchCategories();
  }, [showPublishedOnly, activeClient, sortField, sortOrder]);


  const fetchBlogs = async () => {
    try {
      setIsLoading(true);

      // Create the query
      let query = supabase
        .from("wehoware_blogs")
        .select(
          `
          *,
          wehoware_blog_categories(name)
        `
        )
        .eq("client_id", activeClient.id)
        .order(sortField, { ascending: sortOrder === "asc" });

      // Only filter by status if showPublishedOnly is true
      if (showPublishedOnly) {
        query = query.eq("status", "Published");
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Format the data to include category name
      const formattedData = data.map((blog) => ({
        ...blog,
        category: blog.wehoware_blog_categories
          ? blog.wehoware_blog_categories.name
          : "Uncategorized",
        date: blog.published_at
          ? new Date(blog.published_at).toISOString().split("T")[0]
          : new Date(blog.created_at).toISOString().split("T")[0],
      }));

      setBlogs(formattedData || []);
    } catch (error) {
      console.error("Error fetching blogs:", error);
      setErrorMessage(error.message || "Failed to fetch blogs");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("wehoware_blog_categories")
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
  const openDeleteDialog = (blog) => {
    setBlogToDelete(blog);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!blogToDelete) return;

    try {
      setDeleteLoading(true);

      // Get the current user ID for audit
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id;



      const { error } = await supabase
        .from("wehoware_blogs")
        .delete()
        .eq("id", blogToDelete.id)
        .eq("client_id", activeClient.id);

      if (error) {
        throw error;
      }

      // Update local state without refetching
      setBlogs((prev) => prev.filter((blog) => blog.id !== blogToDelete.id));

      // Show success message
      setSuccessMessage("Blog post deleted successfully!");
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error deleting blog post:", error);
      setErrorMessage(error.message || "Failed to delete blog post");
      setErrorDialogOpen(true);
    } finally {
      setDeleteDialogOpen(false);
      setBlogToDelete(null);
      setDeleteLoading(false);
    }
  };

  // Filter blogs based on search term
  const filteredBlogs = blogs.filter((blog) => {
    const matchesSearch =
      searchTerm === "" ||
      blog.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      blog.excerpt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      blog.category?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Blog Posts"
          description="Manage your blog posts"
          actionLabel="Add New"
          actionIcon={<Plus size={16} />}
          onAction={() => router.push("/admin/blogs/add")}
          secondaryActionLabel="Manage Categories"
          secondaryActionIcon={<FolderTree size={16} />}
          onSecondaryAction={() => router.push("/admin/categories/blog")}
        />
        <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
          <CardHeader>
            <CardTitle>Blog Statistics</CardTitle>
            <CardDescription>Overview of your blog performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Total Posts
                </div>
                <div className="text-2xl font-bold">{blogs.length}</div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Published
                </div>
                <div className="text-2xl font-bold">
                  {blogs.filter((blog) => blog.status === "Published").length}
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Drafts
                </div>
                <div className="text-2xl font-bold">
                  {blogs.filter((blog) => blog.status === "Draft").length}
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
            <CardTitle>Blog Posts</CardTitle>
            <CardDescription>
              Manage your blog content, create drafts, and publish posts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search blogs..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-4 items-center">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="published-only"
                      checked={showPublishedOnly}
                      onCheckedChange={(checked) =>
                        setShowPublishedOnly(checked)
                      }
                    />
                    <Label htmlFor="published-only">Published only</Label>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                        Sort by
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleSort("title")}>
                        Title{" "}
                        {sortField === "title" &&
                          (sortOrder === "asc" ? "↑" : "↓")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSort("created_at")}
                      >
                        Date Created{" "}
                        {sortField === "created_at" &&
                          (sortOrder === "asc" ? "↑" : "↓")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSort("published_at")}
                      >
                        Date Published{" "}
                        {sortField === "published_at" &&
                          (sortOrder === "asc" ? "↑" : "↓")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSort("status")}>
                        Status{" "}
                        {sortField === "status" &&
                          (sortOrder === "asc" ? "↑" : "↓")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
                          <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[60px]">
                            Thumb
                          </th>
                          <th
                            className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort("title")}
                          >
                            Title{" "}
                            {sortField === "title" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </th>
                          <th className="text-left p-3 font-medium hidden md:table-cell">
                            Category
                          </th>
                          <th className="text-left p-3 font-medium hidden md:table-cell">
                            Date
                          </th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-left p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBlogs.map((blog) => (
                          <tr
                            key={blog.id}
                            className="border-b border-gray-200 last:border-0"
                          >
                            <td className="p-3">
                              <img
                                src={blog.thumbnail} // Use placeholder if no thumbnail
                                alt={blog.title ? `Thumbnail for ${blog.title}` : 'Blog post thumbnail'}
                                className="h-10 w-10 rounded-md object-cover border"
                              />
                            </td>
                            <td className="p-3 max-w-[300px]">
                              <div className="font-medium truncate">{blog.title}</div>
                              <div className="text-sm text-muted-foreground truncate">
                                {blog.excerpt}
                              </div>
                              {blog.thumbnail && (
                                <div className="mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    Has Thumbnail
                                  </Badge>
                                </div>
                              )}
                            </td>
                            <td className="p-3 hidden md:table-cell">
                              {blog.category}
                            </td>
                            <td className="p-3 hidden md:table-cell">
                              <div className="flex items-center space-x-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span>{blog.author}</span>
                              </div>
                            </td>
                            <td className="p-3 hidden md:table-cell">
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span>{blog.date}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  blog.status === "Published"
                                    ? "bg-green-50 text-green-700 border border-green-200"
                                    : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                                }`}
                              >
                                {blog.status}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex space-x-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="View"
                                  onClick={() =>
                                    window.open(`${clientUrl}/blog/${blog.slug}`, "_blank")
                                  }
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Edit"
                                  onClick={() =>
                                    router.push(`/admin/blogs/edit/${blog.id}`)
                                  }
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Delete"
                                  onClick={() => openDeleteDialog(blog)}
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

                  {filteredBlogs.length === 0 && (
                    <div className="text-center py-10">
                      <User className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">
                        No blog posts found
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try changing your search or filter criteria
                      </p>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {filteredBlogs.length} of {blogs.length} blog posts
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Are you sure?"
        message={`This will permanently delete the blog post "${blogToDelete?.title}". This action cannot be undone.`}
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
