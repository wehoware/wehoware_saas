"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Save,
  FileText,
  Tag,
  ImagePlus,
  UploadCloud,
  X as XIcon,
} from "lucide-react";
import supabase from "@/lib/supabase";
import AdminPageHeader from "@/components/AdminPageHeader";
import AlertComponent from "@/components/ui/alert-component";
import { useAuth } from "@/contexts/auth-context";
import { uploadThumbnail, deleteThumbnailByUrl } from "@/lib/storageUtils";
import { toast } from "react-hot-toast";

export default function EditBlogPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [id, setId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const fileInputRef = useRef(null);

  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [originalThumbnailUrl, setOriginalThumbnailUrl] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    thumbnail: "",
    status: "Draft",
    category_id: "",
    tags: "",
    featured: false,
    read_time: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
  });

  useEffect(() => {
    if (params?.id) {
      setId(params.id);
    }
  }, [params]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsFetching(true);
        const blogPost = await fetchBlogPost();
        if (blogPost?.client_id) {
          await fetchCategories(blogPost.client_id);
        } else {
          console.warn(
            "Blog post or client_id not found, cannot fetch categories."
          );
          setCategories([]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setErrorMessage(error.message || "Failed to fetch data");
        setErrorDialogOpen(true);
      } finally {
        setIsFetching(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchBlogPost = async () => {
    if (!id) return null;
    try {
      const { data: blogPostData, error } = await supabase
        .from("wehoware_blogs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        throw error;
      }

      if (!blogPostData) {
        throw new Error("Blog post not found");
      }

      const initialThumbnailUrl = blogPostData.thumbnail || "";
      setFormData({
        title: blogPostData.title || "",
        slug: blogPostData.slug || "",
        excerpt: blogPostData.excerpt || "",
        content: blogPostData.content || "",
        thumbnail: blogPostData.thumbnail || "",
        status: blogPostData.status || "Draft",
        category_id: blogPostData.category_id || "",
        tags: Array.isArray(blogPostData.tags)
          ? blogPostData.tags.join(", ")
          : "",
        featured: blogPostData.featured === true,
        read_time:
          blogPostData.read_time !== null ? String(blogPostData.read_time) : "",
        seo_title: blogPostData.meta_title || "",
        seo_description: blogPostData.meta_description || "",
        seo_keywords: blogPostData.meta_keywords || "",
      });
      setOriginalThumbnailUrl(initialThumbnailUrl);
      setPreviewUrl(initialThumbnailUrl);

      return blogPostData;
    } catch (error) {
      console.error("Error fetching blog post:", error);
      throw error;
    }
  };

  const fetchCategories = async (clientId) => {
    try {
      const { data, error } = await supabase
        .from("wehoware_blog_categories")
        .select("*")
        .eq("client_id", clientId)
        .order("name");

      if (error) {
        throw error;
      }

      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size exceeds 5MB limit.");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setThumbnailFile(null);
      setPreviewUrl(originalThumbnailUrl || null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const clearThumbnail = () => {
    setThumbnailFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    const previousTitle = formData.title;

    let processedValue;
    if (type === "checkbox" && name === "featured") {
      processedValue = checked;
    } else if (name === "read_time") {
      processedValue = value;
    } else {
      processedValue = value;
    }

    const newFormData = {
      ...formData,
      [name]: processedValue,
    };

    if (name === "title") {
      const currentSlug = formData.slug;
      const previousSlug = slugify(previousTitle || "", {
        lower: true,
        strict: true,
      });
      const newSlug = slugify(value || "", { lower: true, strict: true });

      if (currentSlug === "" || currentSlug === previousSlug) {
        newFormData.slug = newSlug;
      }
    }

    if (name === "slug") {
      newFormData.slug = slugify(value || "", { lower: true, strict: true });
    }

    setFormData(newFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsLoading(true);
    setIsUploading(false);
    let newThumbnailUrl = originalThumbnailUrl;
    let shouldDeleteOldThumbnail = false;

    try {
      if (thumbnailFile) {
        setIsUploading(true);
        toast.loading("Uploading new thumbnail...", { id: "thumb-upload" });
        try {
          newThumbnailUrl = await uploadThumbnail(thumbnailFile, "blogs");
          toast.success("New thumbnail uploaded!", { id: "thumb-upload" });
          if (originalThumbnailUrl) {
            shouldDeleteOldThumbnail = true;
          }
        } catch (uploadError) {
          console.error("Thumbnail upload error:", uploadError);
          toast.error(`Thumbnail upload failed: ${uploadError.message}`, {
            id: "thumb-upload",
          });
          throw new Error(
            `Failed to upload thumbnail: ${uploadError.message}.`
          );
        }
        setIsUploading(false);
      } else if (!previewUrl && originalThumbnailUrl) {
        newThumbnailUrl = "";
        shouldDeleteOldThumbnail = true;
        toast.loading("Removing existing thumbnail...", { id: "thumb-delete" });
      }

      const dataToUpdate = {
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        excerpt: formData.excerpt.trim(),
        content: formData.content.trim(),
        thumbnail: newThumbnailUrl,
        status: formData.status,
        category_id: formData.category_id || null,
        tags: formData.tags
          ? formData.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
        featured: formData.featured,
        read_time: formData.read_time ? parseInt(formData.read_time, 10) : null,
        meta_title: formData.seo_title.trim(),
        meta_description: formData.seo_description.trim(),
        meta_keywords: formData.seo_keywords.trim(),
        updated_by: user?.id,
      };

      const { data, error } = await supabase
        .from("wehoware_blogs")
        .update(dataToUpdate)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        shouldDeleteOldThumbnail = false;
        toast.dismiss("thumb-delete");
        throw error;
      }

      if (shouldDeleteOldThumbnail && originalThumbnailUrl) {
        try {
          await deleteThumbnailByUrl(originalThumbnailUrl);
          toast.success("Old thumbnail removed.", { id: "thumb-delete" });
        } catch (deleteError) {
          console.error("Failed to delete old thumbnail:", deleteError);
          toast.error(
            `Failed to remove old thumbnail: ${deleteError.message}`,
            { id: "thumb-delete" }
          );
        }
      } else {
        toast.dismiss("thumb-delete");
      }

      toast.success("Blog post updated successfully!");
      setFormData((prev) => ({ ...prev, thumbnail: newThumbnailUrl }));
      setOriginalThumbnailUrl(newThumbnailUrl);
      setThumbnailFile(null);
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error updating blog post:", error);
      setErrorMessage(
        error.message ||
          "An unexpected error occurred while updating the blog post."
      );
      setErrorDialogOpen(true);
      toast.dismiss("thumb-upload");
      toast.dismiss("thumb-delete");
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Loading blog post...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Edit Blog Post"
          description="Update blog post details"
          actionLabel="Back to Blogs"
          onAction={() => router.push("/admin/blogs")}
        />

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList>
              <TabsTrigger value="basic">
                <FileText className="mr-2 h-4 w-4" /> Basic Info
              </TabsTrigger>
              <TabsTrigger value="details">
                <Tag className="mr-2 h-4 w-4" /> Details & Settings
              </TabsTrigger>
              <TabsTrigger value="seo">
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                SEO
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Core Information</CardTitle>
                  <CardDescription>
                    Essential details about the blog post. Fields marked with *
                    are required.
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
                      placeholder="Enter blog post title"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category_id">Category *</Label>
                    <select
                      id="category_id"
                      name="category_id"
                      value={formData.category_id}
                      onChange={handleInputChange}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select a category...</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="excerpt">Excerpt *</Label>
                    <Textarea
                      id="excerpt"
                      name="excerpt"
                      value={formData.excerpt}
                      onChange={handleInputChange}
                      placeholder="Short summary of the post"
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
                      placeholder="Write your blog post content here..."
                      rows={10}
                      required
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Details & Settings</CardTitle>
                  <CardDescription>
                    Additional settings for the blog post.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Thumbnail</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* Preview */}
                      <div className="w-24 h-24 rounded border border-dashed flex items-center justify-center bg-muted overflow-hidden flex-shrink-0">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImagePlus className="w-10 h-10 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-grow space-y-2 w-full">
                        {/* File Input Button */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          <UploadCloud className="mr-2 h-4 w-4" />
                          {thumbnailFile ? "Change File" : "Upload File"}
                        </Button>
                        <Input
                          ref={fileInputRef}
                          id="thumbnail-file"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden" // Hide the actual input, trigger via button
                          disabled={isUploading}
                        />
                        {thumbnailFile && (
                          <div className="flex items-center justify-between text-xs">
                            <p className="text-muted-foreground truncate flex-grow mr-2">
                              Selected: {thumbnailFile.name}
                            </p>
                          </div>
                        )}
                        <div className="relative flex items-center">
                          <span className="flex-shrink px-2 text-xs text-muted-foreground">
                            OR
                          </span>
                          <div className="flex-grow border-t border-muted"></div>
                        </div>
                        {/* URL Input */}
                        <Input
                          id="thumbnail"
                          name="thumbnail"
                          type="url"
                          placeholder="Enter Image URL"
                          value={formData.thumbnail} // Controlled by formData
                          onChange={handleInputChange}
                          disabled={!!thumbnailFile || isUploading} // Disable if file is selected or uploading
                        />
                      </div>
                      {/* Clear Button */}
                      {(thumbnailFile || formData.thumbnail) &&
                        !isUploading && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={clearThumbnail}
                            title="Clear Thumbnail"
                            className="self-start sm:self-center"
                          >
                            <XIcon className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload an image (max 5MB) or provide a URL. Uploads are
                      stored in Supabase Storage.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Published">Published</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags (optional)</Label>
                    <Input
                      id="tags"
                      name="tags"
                      value={formData.tags}
                      onChange={handleInputChange}
                      placeholder="e.g. tech, news, updates"
                    />
                    <p className="text-sm text-muted-foreground">
                      Comma-separated tags.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="read_time">Read Time (minutes)</Label>
                    <Input
                      id="read_time"
                      name="read_time"
                      type="number"
                      value={formData.read_time}
                      onChange={handleInputChange}
                      placeholder="e.g. 5"
                      min="0"
                    />
                    <p className="text-sm text-muted-foreground">
                      Estimated reading time in minutes (optional).
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="featured"
                      name="featured"
                      checked={formData.featured}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, featured: checked }))
                      }
                    />
                    <Label htmlFor="featured">Feature this Post</Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>SEO Information *</CardTitle>
                  <CardDescription>
                    Optimize your blog post for search engines. All fields are
                    required.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug *</Label>
                    <Input
                      id="slug"
                      name="slug"
                      placeholder="e.g. my-awesome-blog-post"
                      value={formData.slug}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Unique identifier for the post URL.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seo_title">Meta Title *</Label>
                    <Input
                      id="seo_title"
                      name="seo_title"
                      value={formData.seo_title}
                      onChange={handleInputChange}
                      placeholder="Enter meta title"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seo_description">Meta Description *</Label>
                    <Textarea
                      id="seo_description"
                      name="seo_description"
                      value={formData.seo_description}
                      onChange={handleInputChange}
                      placeholder="Enter meta description"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seo_keywords">Keywords *</Label>
                    <Input
                      id="seo_keywords"
                      name="seo_keywords"
                      value={formData.seo_keywords}
                      onChange={handleInputChange}
                      placeholder="Enter keywords separated by commas"
                      required
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          <div className="mt-6 flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/blogs")}
              disabled={isLoading || isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isUploading || isFetching}
            >
              {isLoading || isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isUploading
                ? "Uploading..."
                : isLoading
                ? "Updating..."
                : "Update Blog Post"}
            </Button>
          </div>
        </form>

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
          message="Blog post updated successfully!"
          actionLabel="OK"
          onAction={() => {
            router.push("/admin/blogs");
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
