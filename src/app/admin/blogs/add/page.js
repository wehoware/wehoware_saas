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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import supabase from "@/lib/supabase";
import AdminPageHeader from "@/components/AdminPageHeader";
import AlertComponent from "@/components/ui/alert-component";

export default function AddBlogPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    thumbnail: "",
    author: "",
    status: "Draft",
    category_id: "",
    meta_title: "",
    meta_description: "",
    keywords: "",
  });

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("blog_categories")
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
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name, checked) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all required fields
    const requiredFields = [
      "title",
      "excerpt",
      "content",
      "author",
      "meta_title",
      "meta_description",
      "keywords",
    ];

    const missingFields = requiredFields.filter((field) => !formData[field]);

    if (missingFields.length > 0) {
      setErrorMessage(`Please fill in all required fields: ${missingFields.join(", ")}`);
      setErrorDialogOpen(true);
      return;
    }

    try {
      setIsLoading(true);

      // Generate slug from title
      const slug = slugify(formData.title, { lower: true, strict: true });

      // Get the current user ID for audit
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const { data, error } = await supabase.from("blogs").insert({
        title: formData.title,
        slug: slug,
        excerpt: formData.excerpt,
        content: formData.content,
        thumbnail: formData.thumbnail,
        author: formData.author,
        status: formData.status,
        category_id: formData.category_id || null,
        meta_title: formData.meta_title,
        meta_description: formData.meta_description,
        keywords: formData.keywords,
        published_at: formData.status === "Published" ? new Date() : null,
        created_by: userId,
        updated_by: userId,
      });

      if (error) {
        throw error;
      }

      // Show success dialog
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error creating blog post:", error);
      setErrorMessage(error.message || "Failed to create blog post");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Add Blog Post"
          description="Create a new blog post"
          actionLabel="Back to Blogs"
          onAction={() => router.push("/admin/blogs")}
        />

        <form
          onSubmit={handleSubmit}
          onClick={(e) => {
            // Prevent form submission when clicking on select elements
            if (
              e.target.tagName === "BUTTON" &&
              e.target.getAttribute("role") === "combobox"
            ) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Left Column - Main Information */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Blog Information</CardTitle>
                  <CardDescription>
                    Enter the main details for your blog post
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder="Enter blog title"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="excerpt">Excerpt *</Label>
                    <Textarea
                      id="excerpt"
                      name="excerpt"
                      value={formData.excerpt}
                      onChange={handleInputChange}
                      placeholder="Enter a short summary of the blog post"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Content *</Label>
                    <Textarea
                      id="content"
                      name="content"
                      value={formData.content}
                      onChange={handleInputChange}
                      placeholder="Enter the full content of the blog post"
                      className="min-h-[200px]"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thumbnail">Thumbnail URL</Label>
                    <Input
                      id="thumbnail"
                      name="thumbnail"
                      value={formData.thumbnail}
                      onChange={handleInputChange}
                      placeholder="Enter thumbnail image URL"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="author">Author *</Label>
                    <Input
                      id="author"
                      name="author"
                      value={formData.author}
                      onChange={handleInputChange}
                      placeholder="Enter author name"
                      required
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Additional Information */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Publishing Options</CardTitle>
                  <CardDescription>
                    Configure publishing settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        handleSelectChange("status", value)
                      }
                      onOpenChange={(open) => {
                        // Prevent form submission when dropdown opens/closes
                        if (open) {
                          document.activeElement.blur();
                          // Stop any ongoing form submission
                          const form = document.querySelector('form');
                          if (form) {
                            const submitEvent = new Event('submit', { cancelable: true });
                            form.dispatchEvent(submitEvent);
                            submitEvent.preventDefault();
                          }
                        }
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) =>
                        handleSelectChange("category_id", value)
                      }
                      onOpenChange={(open) => {
                        // Prevent form submission when dropdown opens/closes
                        if (open) {
                          document.activeElement.blur();
                          // Stop any ongoing form submission
                          const form = document.querySelector('form');
                          if (form) {
                            const submitEvent = new Event('submit', { cancelable: true });
                            form.dispatchEvent(submitEvent);
                            submitEvent.preventDefault();
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SEO Information</CardTitle>
                  <CardDescription>
                    Optimize your blog post for search engines
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="meta_title">Meta Title *</Label>
                    <Input
                      id="meta_title"
                      name="meta_title"
                      value={formData.meta_title}
                      onChange={handleInputChange}
                      placeholder="Enter meta title"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meta_description">Meta Description *</Label>
                    <Textarea
                      id="meta_description"
                      name="meta_description"
                      value={formData.meta_description}
                      onChange={handleInputChange}
                      placeholder="Enter meta description"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="keywords">Keywords *</Label>
                    <Input
                      id="keywords"
                      name="keywords"
                      value={formData.keywords}
                      onChange={handleInputChange}
                      placeholder="Enter keywords separated by commas"
                      required
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Blog Post"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>

        {/* Error Dialog */}
        <AlertComponent 
          open={errorDialogOpen}
          onOpenChange={setErrorDialogOpen}
          title="Error"
          message={errorMessage}
          actionLabel="OK"
        />
        
        {/* Success Dialog */}
        <AlertComponent 
          open={successDialogOpen}
          onOpenChange={setSuccessDialogOpen}
          title="Success"
          message="Blog post created successfully!"
          actionLabel="OK"
          onAction={() => {
            router.push('/admin/blogs');
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
