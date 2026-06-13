"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import slugify from "slugify";
import RichTextEditor from "@/components/ui/rich-text-editor";
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
import {
  Loader2,
  Eye,
  FileText,
  Tag,
  ImagePlus,
  UploadCloud,
  X as XIcon,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import AdminPageHeader from "@/components/AdminPageHeader";
import AlertComponent from "@/components/ui/alert-component";
import { useAuth } from "@/contexts/auth-context";
import { uploadThumbnail } from "@/lib/storageUtils";
import { toast } from "react-hot-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SelectInput from "@/components/ui/select";

export default function AddBlogPage() {
  const router = useRouter();
  const { activeClient } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef(null);

  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    thumbnail: "",
    thumbnail_alt: "",
    status: "Draft",
    category_id: "",
    tags: "",
    featured: false,
    read_time: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    open_graph_title: "",
    open_graph_description: "",
    open_graph_image: "",
    twitter_title: "",
    twitter_description: "",
    twitter_image: "",
    canonical_url: "",
    robots_meta: "index,follow",
    schema_type: "BlogPosting",
    target_keywords: "",
    show_toc: false,
    show_author_box: true,
    cta_heading: "",
    cta_body: "",
    cta_button_text: "",
    cta_button_url: "",
    allow_social_share: true,
    scheduled_publish_at: "",
  });

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/v1/blogs/categories");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch categories");
      const json = await res.json();
      setCategories(json.data || []);
    } catch (error) {
      toast.error(error.message || "Failed to fetch categories");
      setErrorMessage(error.message || "Failed to fetch categories");
      setErrorDialogOpen(true);
    }
  };

  useEffect(() => {
    if (activeClient?.id) {
      fetchCategories();
    } else {
      setCategories([]);
    }
  }, [activeClient?.id]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    const previousTitle = formData.title;

    let processedValue;
    if (type === "checkbox") {
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
      setPreviewUrl(null);
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!activeClient?.id) {
      setErrorMessage(
        "Please select an active client from the header dropdown before adding a blog post."
      );
      setErrorDialogOpen(true);
      return;
    }

    const requiredFields = [
      "title",
      "slug",
      "content",
      "excerpt",
      "seo_title",
      "seo_description",
      "seo_keywords",
    ];

    const missingFields = requiredFields.filter((field) => !formData[field]);

    if (missingFields.length > 0) {
      setErrorMessage(
        `Please fill in all required fields: ${missingFields.join(", ")}`
      );
      setErrorDialogOpen(true);
      return;
    }

    if (formData.read_time && isNaN(parseInt(formData.read_time, 10))) {
      setErrorMessage("Read time must be a number.");
      setErrorDialogOpen(true);
      return;
    }

    setIsLoading(true);
    let uploadedThumbnailUrl = "";

    try {
      if (thumbnailFile) {
        setIsUploading(true);
        toast.loading("Uploading thumbnail...", { id: "thumbnail-upload" });
        try {
          uploadedThumbnailUrl = await uploadThumbnail(thumbnailFile, "blogs");
          toast.success("Thumbnail uploaded!", { id: "thumbnail-upload" });
        } catch (uploadError) {
          console.error("Thumbnail upload error:", uploadError);
          toast.error(`Thumbnail upload failed: ${uploadError.message}`, {
            id: "thumbnail-upload",
          });
          setErrorMessage(
            `Failed to upload thumbnail: ${uploadError.message}. Please try again.`
          );
          setErrorDialogOpen(true);
          setIsUploading(false);
          setIsLoading(false);
          return;
        }
        setIsUploading(false);
      }

      const dataToInsert = {
        client_id: activeClient.id,
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        excerpt: formData.excerpt.trim(),
        content: formData.content.trim(),
        thumbnail: uploadedThumbnailUrl || formData.thumbnail || "",
        thumbnail_alt: formData.thumbnail_alt.trim(),
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
        open_graph_title: formData.open_graph_title.trim() || null,
        open_graph_description: formData.open_graph_description.trim() || null,
        open_graph_image: formData.open_graph_image.trim() || null,
        twitter_title: formData.twitter_title.trim() || null,
        twitter_description: formData.twitter_description.trim() || null,
        twitter_image: formData.twitter_image.trim() || null,
        canonical_url: formData.canonical_url.trim() || null,
        robots_meta: formData.robots_meta || "index,follow",
        schema_type: formData.schema_type || "BlogPosting",
        target_keywords: formData.target_keywords
          ? formData.target_keywords.split(",").map((k) => k.trim()).filter(Boolean)
          : [],
        show_toc: formData.show_toc,
        show_author_box: formData.show_author_box,
        cta_heading: formData.cta_heading.trim() || null,
        cta_body: formData.cta_body.trim() || null,
        cta_button_text: formData.cta_button_text.trim() || null,
        cta_button_url: formData.cta_button_url.trim() || null,
        allow_social_share: formData.allow_social_share,
        scheduled_publish_at:
          (formData.status === "Draft" || !formData.status) && formData.scheduled_publish_at
            ? new Date(formData.scheduled_publish_at).toISOString()
            : null,
      };

      if (dataToInsert.read_time !== null && isNaN(dataToInsert.read_time)) {
        throw new Error("Invalid read time provided.");
      }

      const res = await fetch("/api/v1/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToInsert),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to create blog post");

      toast.success("Blog post created successfully!");
      router.push("/admin/blogs");
      router.refresh();
    } catch (error) {
      console.error("Error creating blog post:", error);
      setErrorMessage(
        error.message ||
          "An unexpected error occurred while creating the blog post."
      );
      setErrorDialogOpen(true);
      toast.dismiss("thumbnail-upload");
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader title="Add New Blog Post" />
        <div className="mt-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-4 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
            </div>

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
                      Essential details about the blog post. Fields marked with
                      * are required.
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
                      <Label htmlFor="category_id">Category</Label>
                      <SelectInput
                        id="category_id"
                        name="category_id"
                        options={categories.map((category) => ({
                          value: category.id,
                          label: category.name,
                        }))}
                        value={formData.category_id}
                        onChange={handleInputChange}
                        placeholder="Select a category"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="excerpt">Excerpt *</Label>
                      <RichTextEditor
                        value={formData.excerpt}
                        onChange={(html) =>
                          setFormData({ ...formData, excerpt: html })
                        }
                        placeholder="Short summary of the post"
                        className="min-h-[150px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="content">Content *</Label>
                      <RichTextEditor
                        value={formData.content}
                        onChange={(html) =>
                          setFormData({ ...formData, content: html })
                        }
                        placeholder="Write your blog post content here..."
                        className="min-h-[150px]"
                      />
                      <p className="text-sm text-muted-foreground">
                        Use the toolbar to format your content with headings,
                        lists, images, videos, and more.
                      </p>
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
                        <div className="w-24 h-24 rounded border border-dashed flex items-center justify-center bg-muted overflow-hidden flex-shrink-0">
                          {previewUrl ? (
                            <Image
                              src={previewUrl}
                              alt="Preview"
                              width={96}
                              height={96}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImagePlus className="w-10 h-10 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-grow space-y-2 w-full">
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
                            className="hidden"
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
                          <Input
                            id="thumbnail"
                            name="thumbnail"
                            type="url"
                            placeholder="Enter Image URL"
                            value={formData.thumbnail}
                            onChange={handleInputChange}
                            disabled={!!thumbnailFile || isUploading}
                          />
                          <div className="space-y-1">
                            <Label htmlFor="thumbnail_alt">Alt Text</Label>
                            <Input
                              id="thumbnail_alt"
                              name="thumbnail_alt"
                              type="text"
                              placeholder="Describe the image for accessibility"
                              value={formData.thumbnail_alt}
                              onChange={handleInputChange}
                            />
                          </div>
                        </div>
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
                      <SelectInput
                        id="status"
                        name="status"
                        options={[
                          { value: "Draft", label: "Draft" },
                          { value: "Published", label: "Published" },
                          { value: "Archived", label: "Archived" },
                        ]}
                        value={formData.status}
                        onChange={handleInputChange}
                      />
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
                          setFormData((prev) => ({
                            ...prev,
                            featured: checked,
                          }))
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
                        Unique identifier for the post URL (auto-generated from
                        title if empty).
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
                      <Label htmlFor="seo_description">
                        Meta Description *
                      </Label>
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

                    <div className="border-t pt-4 space-y-4">
                      <h4 className="text-sm font-semibold">Open Graph</h4>
                      <div className="space-y-2">
                        <Label htmlFor="open_graph_title">OG Title</Label>
                        <Input
                          id="open_graph_title"
                          name="open_graph_title"
                          placeholder="Title for social sharing"
                          value={formData.open_graph_title}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="open_graph_description">OG Description</Label>
                        <Textarea
                          id="open_graph_description"
                          name="open_graph_description"
                          placeholder="Description for social sharing"
                          value={formData.open_graph_description}
                          onChange={handleInputChange}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="open_graph_image">OG Image URL</Label>
                        <Input
                          id="open_graph_image"
                          name="open_graph_image"
                          type="url"
                          placeholder="https://example.com/image.jpg"
                          value={formData.open_graph_image}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <h4 className="text-sm font-semibold">Twitter Cards</h4>
                      <div className="space-y-2">
                        <Label htmlFor="twitter_title">Twitter Title</Label>
                        <Input
                          id="twitter_title"
                          name="twitter_title"
                          placeholder="Title for Twitter"
                          value={formData.twitter_title}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="twitter_description">Twitter Description</Label>
                        <Textarea
                          id="twitter_description"
                          name="twitter_description"
                          placeholder="Description for Twitter"
                          value={formData.twitter_description}
                          onChange={handleInputChange}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="twitter_image">Twitter Image URL</Label>
                        <Input
                          id="twitter_image"
                          name="twitter_image"
                          type="url"
                          placeholder="https://example.com/image.jpg"
                          value={formData.twitter_image}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <h4 className="text-sm font-semibold">Advanced SEO</h4>
                      <div className="space-y-2">
                        <Label htmlFor="canonical_url">Canonical URL</Label>
                        <Input
                          id="canonical_url"
                          name="canonical_url"
                          type="url"
                          placeholder="https://example.com/canonical-page"
                          value={formData.canonical_url}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="robots_meta">Robots Meta</Label>
                          <SelectInput
                            id="robots_meta"
                            name="robots_meta"
                            value={formData.robots_meta}
                            onChange={handleInputChange}
                            options={[
                              { value: "index,follow", label: "Index, Follow" },
                              { value: "noindex,follow", label: "No Index, Follow" },
                              { value: "index,nofollow", label: "Index, No Follow" },
                              { value: "noindex,nofollow", label: "No Index, No Follow" },
                            ]}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="schema_type">Schema Type</Label>
                          <Input
                            id="schema_type"
                            name="schema_type"
                            placeholder="BlogPosting"
                            value={formData.schema_type}
                            onChange={handleInputChange}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="target_keywords">Target Keywords</Label>
                        <Input
                          id="target_keywords"
                          name="target_keywords"
                          placeholder="e.g. keyword1, keyword2"
                          value={formData.target_keywords}
                          onChange={handleInputChange}
                        />
                        <p className="text-sm text-muted-foreground">
                          Comma-separated target keywords for SEO scoring.
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <h4 className="text-sm font-semibold">Display Options</h4>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="show_toc"
                          name="show_toc"
                          checked={formData.show_toc}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({ ...prev, show_toc: checked }))
                          }
                        />
                        <Label htmlFor="show_toc">Show Table of Contents</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="show_author_box"
                          name="show_author_box"
                          checked={formData.show_author_box}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({ ...prev, show_author_box: checked }))
                          }
                        />
                        <Label htmlFor="show_author_box">Show Author Box</Label>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <h4 className="text-sm font-semibold">Call to Action</h4>
                      <div className="space-y-2">
                        <Label htmlFor="cta_heading">CTA Heading</Label>
                        <Input
                          id="cta_heading"
                          name="cta_heading"
                          placeholder="e.g. Subscribe to our newsletter"
                          value={formData.cta_heading}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cta_body">CTA Body</Label>
                        <Textarea
                          id="cta_body"
                          name="cta_body"
                          placeholder="Short call-to-action message"
                          value={formData.cta_body}
                          onChange={handleInputChange}
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cta_button_text">Button Text</Label>
                          <Input
                            id="cta_button_text"
                            name="cta_button_text"
                            placeholder="e.g. Subscribe"
                            value={formData.cta_button_text}
                            onChange={handleInputChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cta_button_url">Button URL</Label>
                          <Input
                            id="cta_button_url"
                            name="cta_button_url"
                            type="url"
                            placeholder="https://example.com/subscribe"
                            value={formData.cta_button_url}
                            onChange={handleInputChange}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                      <Switch
                        id="allow_social_share"
                        name="allow_social_share"
                        checked={formData.allow_social_share}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, allow_social_share: checked }))
                        }
                      />
                      <Label htmlFor="allow_social_share">Allow Social Share</Label>
                    </div>

                    {(formData.status === "Draft" || !formData.status) && (
                      <div className="space-y-2 border-t pt-4">
                        <Label htmlFor="scheduled_publish_at">Schedule Publish At</Label>
                        <Input
                          id="scheduled_publish_at"
                          name="scheduled_publish_at"
                          type="datetime-local"
                          value={formData.scheduled_publish_at}
                          onChange={handleInputChange}
                        />
                        <p className="text-sm text-muted-foreground">
                          Leave blank to publish manually.
                        </p>
                      </div>
                    )}
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
              <Button type="submit" disabled={isLoading || isUploading}>
                {isLoading || isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isUploading
                  ? "Uploading..."
                  : isLoading
                  ? "Creating..."
                  : "Create Blog Post"}
              </Button>
            </div>
          </form>
        </div>
      </div>

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
        message="Blog post created successfully!"
        actionLabel="OK"
        onAction={() => {
          router.push("/admin/blogs");
          router.refresh();
        }}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">{formData.title}</h1>
            {(previewUrl || formData.thumbnail) && (
              <img
                src={previewUrl || formData.thumbnail}
                alt={formData.thumbnail_alt || formData.title}
                className="w-full rounded object-cover max-h-64"
              />
            )}
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: formData.content }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
