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
  Copy,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Star,
  TrendingUp,
  Clock,
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

const PAGE_SIZE = 20;

function getSeoScoreClass(score = 0) {
  if (score >= 80) return "bg-green-50 text-green-700 border border-green-200";
  if (score >= 50) return "bg-yellow-50 text-yellow-700 border border-yellow-200";
  return "bg-red-50 text-red-700 border border-red-200";
}

function getStatusClass(status) {
  if (status === "Published") return "bg-green-50 text-green-700 border border-green-200";
  if (status === "Archived") return "bg-gray-50 text-gray-700 border border-gray-200";
  return "bg-yellow-50 text-yellow-700 border border-yellow-200";
}

export default function BlogsPage() {
  const router = useRouter();
  const { activeClient, clientUrl } = useAuth();
  const [blogs, setBlogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [cloneLoading, setCloneLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPublishedOnly, setShowPublishedOnly] = useState(false);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [blogToDelete, setBlogToDelete] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const buildQueryParams = useCallback((targetPage) => {
    const params = new URLSearchParams({
      sortBy: sortField,
      sortOrder,
      limit: String(PAGE_SIZE),
      page: String(targetPage),
    });
    if (showPublishedOnly) params.set("status", "Published");
    if (showFeaturedOnly) params.set("featured", "true");
    if (selectedCategoryId && selectedCategoryId !== "all") params.set("categoryId", selectedCategoryId);
    if (selectedStatus && selectedStatus !== "all") params.set("status", selectedStatus);
    if (searchTerm) params.set("search", searchTerm);
    return params;
  }, [sortField, sortOrder, showPublishedOnly, showFeaturedOnly, selectedCategoryId, selectedStatus, searchTerm]);

  const formatBlog = (blog) => ({
    ...blog,
    category: blog.wehoware_blog_categories ? blog.wehoware_blog_categories.name : "Uncategorized",
    date: blog.published_at
      ? new Date(blog.published_at).toISOString().split("T")[0]
      : new Date(blog.created_at).toISOString().split("T")[0],
  });

  const fetchBlogs = useCallback(async (targetPage) => {
    try {
      setIsLoading(true);
      const params = buildQueryParams(targetPage);
      const res = await fetch(`/api/v1/blogs?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch blogs");
      const json = await res.json();
      setBlogs((json.blogs || []).map(formatBlog));
      if (json.pagination) setPagination(json.pagination);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error fetching blogs:", error);
      setErrorMessage(error.message || "Failed to fetch blogs");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, [buildQueryParams]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/blogs/categories");
      if (!res.ok) return;
      const json = await res.json();
      setCategories(json.data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  useEffect(() => {
    if (!activeClient?.id) return;
    fetchBlogs(page);
    fetchCategories();
  }, [page, sortField, sortOrder, showPublishedOnly, showFeaturedOnly, selectedCategoryId, selectedStatus, activeClient, fetchBlogs, fetchCategories]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSelectedIds([]);
    fetchBlogs(1);
  };

  const resetSearch = () => {
    setSearchTerm("");
    setPage(1);
    setSelectedIds([]);
  };

  useEffect(() => {
    if (searchTerm === "") {
      setPage(1);
    }
  }, [searchTerm]);

  const handleFilterChange = (checked) => {
    setShowPublishedOnly(checked);
    setPage(1);
    setSelectedIds([]);
  };

  const handleFeaturedFilterChange = (checked) => {
    setShowFeaturedOnly(checked);
    setPage(1);
    setSelectedIds([]);
  };

  const handleCategoryFilterChange = (value) => {
    setSelectedCategoryId(value || "all");
    setPage(1);
    setSelectedIds([]);
  };

  const handleStatusFilterChange = (value) => {
    setSelectedStatus(value || "all");
    setPage(1);
    setSelectedIds([]);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
    setSelectedIds([]);
  };

  const openDeleteDialog = (blog) => {
    setBlogToDelete(blog);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!blogToDelete) return;
    try {
      setDeleteLoading(true);
      const delRes = await fetch(`/api/v1/blogs/${blogToDelete.id}`, { method: "DELETE" });
      if (!delRes.ok) throw new Error((await delRes.json().catch(() => ({}))).error || "Failed to delete blog");
      fetchBlogs(page);
      setSuccessMessage("Blog post deleted successfully!");
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error deleting blog:", error);
      setErrorMessage(error.message || "Failed to delete blog post");
      setErrorDialogOpen(true);
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setBlogToDelete(null);
    }
  };

  const handleClone = async (blogId) => {
    try {
      setCloneLoading(blogId);
      const res = await fetch(`/api/v1/blogs/${blogId}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to duplicate blog");
      const json = await res.json();
      router.push(`/admin/blogs/edit/${json.blog.id}`);
    } catch (error) {
      console.error("Error cloning blog:", error);
      setErrorMessage(error.message || "Failed to clone blog post");
      setErrorDialogOpen(true);
    } finally {
      setCloneLoading(null);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.length === 0) return;
    if (action === "delete") {
      setBulkDeleteDialogOpen(true);
      return;
    }
    try {
      setBulkLoading(true);
      const res = await fetch("/api/v1/blogs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selectedIds }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Bulk action failed");
      const json = await res.json();
      fetchBlogs(page);
      setSuccessMessage(`Bulk ${action} applied to ${json.updated ?? selectedIds.length} post(s).`);
      setSuccessDialogOpen(true);
      setSelectedIds([]);
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
      const res = await fetch("/api/v1/blogs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: selectedIds }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Bulk delete failed");
      const json = await res.json();
      fetchBlogs(page);
      setSuccessMessage(`Deleted ${json.deleted ?? selectedIds.length} post(s).`);
      setSuccessDialogOpen(true);
      setSelectedIds([]);
    } catch (error) {
      console.error("Bulk delete error:", error);
      setErrorMessage(error.message || "Bulk delete failed");
      setErrorDialogOpen(true);
    } finally {
      setBulkLoading(false);
      setBulkDeleteDialogOpen(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === blogs.length && blogs.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(blogs.map((b) => b.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allSelected = blogs.length > 0 && selectedIds.length === blogs.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const firstItem = pagination.totalItems === 0 ? 0 : (pagination.page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(pagination.page * PAGE_SIZE, pagination.totalItems);

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
            <CardTitle>Blog Statistics</CardTitle>
            <CardDescription>Overview of your blog performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Total Posts
                </div>
                <div className="text-2xl font-bold">{pagination.totalItems}</div>
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
                  Featured
                </div>
                <div className="text-2xl font-bold">
                  {blogs.filter((b) => b.featured === true).length}
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-muted-foreground">
                  Avg SEO Score
                </div>
                <div className="text-2xl font-bold">
                  {blogs.length > 0
                    ? Math.round(
                        blogs.reduce((sum, b) => sum + (b.seo_score || 0), 0) /
                          blogs.length
                      )
                    : 0}
                </div>
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
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-2">
                  <form
                    onSubmit={handleSearch}
                    className="flex items-center space-x-2"
                  >
                    <Input
                      type="text"
                      placeholder="Search blogs..."
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
                      id="published-only"
                      checked={showPublishedOnly}
                      onCheckedChange={handleFilterChange}
                    />
                    <Label htmlFor="published-only">Published only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="featured-only"
                      checked={showFeaturedOnly}
                      onCheckedChange={handleFeaturedFilterChange}
                    />
                    <Label htmlFor="featured-only">Featured only</Label>
                  </div>
                  <div className="w-[160px]">
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
                  <div className="w-[140px]">
                    <SelectInput
                      placeholder="All Statuses"
                      value={selectedStatus}
                      onChange={(e) => handleStatusFilterChange(e.target.value)}
                      options={[
                        { value: "all", label: "All Statuses" },
                        { value: "Draft", label: "Draft" },
                        { value: "Published", label: "Published" },
                        { value: "Archived", label: "Archived" },
                      ]}
                    />
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

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <CheckSquare className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-sm font-medium text-blue-700">
                    {selectedIds.length} selected
                  </span>
                  <div className="flex items-center gap-2 ml-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bulkLoading}
                      onClick={() => handleBulkAction("publish")}
                    >
                      {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bulkLoading}
                      onClick={() => handleBulkAction("unpublish")}
                    >
                      Unpublish
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bulkLoading}
                      onClick={() => handleBulkAction("archive")}
                    >
                      Archive
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={bulkLoading}
                      onClick={() => handleBulkAction("delete")}
                    >
                      Delete
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-xs"
                    onClick={() => setSelectedIds([])}
                  >
                    Clear selection
                  </Button>
                </div>
              )}

              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="overflow-auto rounded-md border">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3 text-left w-[44px]">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => { if (el) el.indeterminate = someSelected; }}
                              onChange={toggleSelectAll}
                              className="h-4 w-4 cursor-pointer rounded border-gray-300"
                              title="Select all on page"
                            />
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[60px]">
                            Thumb
                          </th>
                          <th
                            className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort("title")}
                          >
                            Title
                            {sortField === "title" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Category
                          </th>
                          <th
                            className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort("views")}
                          >
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Views
                              {sortField === "views" &&
                                (sortOrder === "asc" ? "↑" : "↓")}
                            </div>
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              Likes
                            </div>
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Read Time
                            </div>
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            SEO
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Status
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Updated
                          </th>
                          <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {blogs.map((blog) => (
                          <tr
                            key={blog.id}
                            className={`border-b border-gray-200 last:border-0 ${selectedIds.includes(blog.id) ? "bg-blue-50" : ""}`}
                          >
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(blog.id)}
                                onChange={() => toggleSelectOne(blog.id)}
                                className="h-4 w-4 cursor-pointer rounded border-gray-300"
                              />
                            </td>
                            <td className="p-3">
                              <Image
                                src={blog.thumbnail || "/images/blank.jpg"}
                                alt={
                                  blog.title
                                    ? `Thumbnail for ${blog.title}`
                                    : "Blog thumbnail"
                                }
                                width={64}
                                height={64}
                                className="w-16 h-16 object-cover rounded"
                              />
                            </td>
                            <td className="p-3 max-w-[300px]">
                              <div className="font-medium truncate">
                                {blog.title}
                              </div>
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
                            <td className="p-3">
                              <div className="text-sm text-gray-900">
                                {blog.views || 0}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center text-sm text-gray-900">
                                <Star className="h-3 w-3 text-yellow-500 mr-1" />
                                {blog.likes || 0}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center text-sm text-gray-900">
                                <Clock className="h-3 w-3 text-muted-foreground mr-1" />
                                {blog.read_time ? `${blog.read_time} min` : "—"}
                              </div>
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSeoScoreClass(blog.seo_score)}`}
                              >
                                {blog.seo_score || 0}/100
                              </span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusClass(blog.status)}`}
                              >
                                {blog.status}
                              </span>
                              {blog.featured && (
                                <span className="ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                  Featured
                                </span>
                              )}
                            </td>
                            <td className="p-3 hidden md:table-cell">
                              <div className="text-sm text-muted-foreground">
                                {blog.updated_at
                                  ? new Date(blog.updated_at).toISOString().split("T")[0]
                                  : "—"}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex space-x-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="View"
                                  onClick={() =>
                                    window.open(
                                      `${clientUrl}/blog/${blog.slug}`,
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
                                    router.push(`/admin/blogs/edit/${blog.id}`)
                                  }
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Clone"
                                  disabled={cloneLoading === blog.id}
                                  onClick={() => handleClone(blog.id)}
                                >
                                  {cloneLoading === blog.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Copy className="h-4 w-4" />
                                  }
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

                  {blogs.length === 0 && (
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
                  {pagination.totalItems > 0
                    ? `Page ${pagination.page} of ${pagination.totalPages} · Showing ${firstItem}–${lastItem} of ${pagination.totalItems}`
                    : "No blog posts"}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages || isLoading}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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

      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Delete selected posts?"
        message={`This will permanently delete ${selectedIds.length} blog post(s). This action cannot be undone.`}
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

            {/* Endpoints */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Endpoints
              </h4>
              <ApiEndpointRow
                method="GET"
                label="List Blogs"
                url={`/api/public/blogs?clientId=${activeClient?.id || "{clientId}"}`}
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
                label="Get Blog by Slug"
                url={`/api/public/blogs/{slug}?clientId=${activeClient?.id || "{clientId}"}`}
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
                url={`/api/public/blogs/categories?clientId=${activeClient?.id || "{clientId}"}`}
                copiedField={copiedField}
                field="categories"
                onCopy={(val, field) => {
                  navigator.clipboard.writeText(val);
                  setCopiedField(field);
                  setTimeout(() => setCopiedField(null), 1500);
                }}
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
                    `GET /api/public/blogs?clientId=${activeClient?.id || "{clientId}"}`,
                    `GET /api/public/blogs/{slug}?clientId=${activeClient?.id || "{clientId}"}`,
                    `GET /api/public/blogs/categories?clientId=${activeClient?.id || "{clientId}"}`,
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
