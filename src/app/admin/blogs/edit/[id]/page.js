"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import RichTextEditor from "@/components/ui/rich-text-editor";
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
  Eye,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  Plus,
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
import { uploadThumbnail, deleteThumbnailByUrl } from "@/lib/storageUtils";
import { toast } from "react-hot-toast";
import SelectInput from "@/components/ui/select";

export default function EditBlogPage() {
  const router = useRouter();
  const params = useParams();
  const { user, activeClient } = useAuth();
  const [id, setId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef(null);

  const [versions, setVersions] = useState([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [isSavingVersion, setIsSavingVersion] = useState(false);

  const [relatedServices, setRelatedServices] = useState([]);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceResults, setServiceResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const [faqs, setFaqs] = useState([]);
  const [faqsLoading, setFaqsLoading] = useState(false);
  const [activeFaqTab, setActiveFaqTab] = useState(false);
  const [savingFaqId, setSavingFaqId] = useState(null);
  const [deletingFaqId, setDeletingFaqId] = useState(null);

  const categoryOptions = useMemo(() => {
    return categories.map((cat) => ({
      value: cat.id,
      label: cat.name,
    }));
  }, [categories]);

  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [originalThumbnailUrl, setOriginalThumbnailUrl] = useState(null);

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

  useEffect(() => {
    if (params?.id) {
      setId(params.id);
    }
  }, [params]);

  const fetchBlogPost = useCallback(async () => {
    if (!id) return null;
    try {
      const res = await fetch(`/api/v1/blogs/${id}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Blog post not found");
      const json = await res.json();
      const blogPostData = json.blog;
      if (!blogPostData) throw new Error("Blog post not found");

      const initialThumbnailUrl = blogPostData.thumbnail || "";
      setFormData({
        title: blogPostData.title || "",
        slug: blogPostData.slug || "",
        excerpt: blogPostData.excerpt || "",
        content: blogPostData.content || "",
        thumbnail: blogPostData.thumbnail || "",
        thumbnail_alt: blogPostData.thumbnail_alt || "",
        status: blogPostData.status || "Draft",
        category_id: blogPostData.category_id || "",
        tags: Array.isArray(blogPostData.tags) ? blogPostData.tags.join(", ") : "",
        featured: blogPostData.featured === true,
        read_time: blogPostData.read_time !== null ? String(blogPostData.read_time) : "",
        seo_title: blogPostData.meta_title || "",
        seo_description: blogPostData.meta_description || "",
        seo_keywords: blogPostData.meta_keywords || "",
        open_graph_title: blogPostData.open_graph_title || "",
        open_graph_description: blogPostData.open_graph_description || "",
        open_graph_image: blogPostData.open_graph_image || "",
        twitter_title: blogPostData.twitter_title || "",
        twitter_description: blogPostData.twitter_description || "",
        twitter_image: blogPostData.twitter_image || "",
        canonical_url: blogPostData.canonical_url || "",
        robots_meta: blogPostData.robots_meta || "index,follow",
        schema_type: blogPostData.schema_type || "BlogPosting",
        target_keywords: Array.isArray(blogPostData.target_keywords) ? blogPostData.target_keywords.join(", ") : "",
        show_toc: blogPostData.show_toc === true,
        show_author_box: blogPostData.show_author_box !== false,
        cta_heading: blogPostData.cta_heading || "",
        cta_body: blogPostData.cta_body || "",
        cta_button_text: blogPostData.cta_button_text || "",
        cta_button_url: blogPostData.cta_button_url || "",
        allow_social_share: blogPostData.allow_social_share !== false,
        scheduled_publish_at: blogPostData.scheduled_publish_at
          ? new Date(blogPostData.scheduled_publish_at).toISOString().slice(0, 16)
          : "",
      });
      setOriginalThumbnailUrl(initialThumbnailUrl);
      setPreviewUrl(initialThumbnailUrl);
      return blogPostData;
    } catch (error) {
      console.error("Error fetching blog post:", error);
      throw error;
    }
  }, [id]);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/v1/blogs/categories");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch categories");
      const json = await res.json();
      setCategories(json.data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }
  };

  const fetchVersions = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/v1/blogs/${id}/versions`);
      if (!res.ok) return;
      const json = await res.json();
      setVersions(json.versions || []);
    } catch (error) {
      console.error("Error fetching versions:", error);
    }
  }, [id]);

  const fetchRelatedServices = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/v1/blogs/${id}/related-services`);
      if (!res.ok) return;
      const json = await res.json();
      setRelatedServices(json.services || []);
    } catch (error) {
      console.error("Error fetching related services:", error);
    }
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsFetching(true);
        await fetchBlogPost();
        await fetchCategories();
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
      fetchVersions();
      fetchRelatedServices();
    }
  }, [id, activeClient?.id, fetchBlogPost, fetchVersions, fetchRelatedServices]);

  useEffect(() => {
    if (!activeFaqTab || !id) return;
    const fetchFaqs = async () => {
      setFaqsLoading(true);
      try {
        const res = await fetch(`/api/v1/blogs/${id}/faqs`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || `Failed to fetch FAQs (${res.status})`);
        }
        const json = await res.json();
        setFaqs(json.faqs || []);
      } catch (err) {
        console.error("Error fetching FAQs:", err);
        toast.error(err.message || "Failed to fetch FAQs");
      } finally {
        setFaqsLoading(false);
      }
    };
    fetchFaqs();
  }, [activeFaqTab, id]);

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

  const handleSaveVersion = async () => {
    if (!id) return;
    setIsSavingVersion(true);
    try {
      const res = await fetch(`/api/v1/blogs/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved_by: user?.id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to save version");
      toast.success("Version saved!");
      await fetchVersions();
    } catch (error) {
      toast.error(error.message || "Failed to save version");
    } finally {
      setIsSavingVersion(false);
    }
  };

  const handleServiceSearch = async (term) => {
    setServiceSearch(term);
    if (!term.trim()) {
      setServiceResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/v1/services?search=${encodeURIComponent(term)}&limit=10`);
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json();
      setServiceResults(json.data || json.services || []);
    } catch (error) {
      console.error("Service search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLinkService = async (serviceId) => {
    if (!id) return;
    setIsLinking(true);
    try {
      const res = await fetch(`/api/v1/blogs/${id}/related-services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to link service");
      toast.success("Service linked!");
      setServiceSearch("");
      setServiceResults([]);
      await fetchRelatedServices();
    } catch (error) {
      toast.error(error.message || "Failed to link service");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkService = async (serviceId) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/v1/blogs/${id}/related-services`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to unlink service");
      toast.success("Service unlinked!");
      await fetchRelatedServices();
    } catch (error) {
      toast.error(error.message || "Failed to unlink service");
    }
  };

  const handleAddFaq = () => {
    setFaqs((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        question: "",
        answer: "",
        display_order: prev.length,
        active: true,
        isNew: true,
      },
    ]);
  };

  const handleFaqChange = (index, field, value) => {
    setFaqs((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  };

  const handleSaveFaq = async (index) => {
    const faq = faqs[index];
    if (!faq.question.trim() || !faq.answer.trim()) {
      toast.error("Question and answer are required");
      return;
    }
    setSavingFaqId(faq.id);
    try {
      if (faq.isNew) {
        const res = await fetch(`/api/v1/blogs/${id}/faqs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: faq.question.trim(),
            answer: faq.answer.trim(),
            active: faq.active,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to create FAQ");
        const json = await res.json();
        setFaqs((prev) =>
          prev.map((f, i) => (i === index ? { ...json.faq, isNew: false } : f))
        );
        toast.success("FAQ created");
      } else {
        const res = await fetch(`/api/v1/blogs/${id}/faqs/${faq.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: faq.question.trim(),
            answer: faq.answer.trim(),
            display_order: faq.display_order,
            active: faq.active,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to update FAQ");
        const json = await res.json();
        setFaqs((prev) =>
          prev.map((f, i) => (i === index ? { ...json.faq, isNew: false } : f))
        );
        toast.success("FAQ updated");
      }
    } catch (err) {
      toast.error(err.message || "Failed to save FAQ");
    } finally {
      setSavingFaqId(null);
    }
  };

  const handleDeleteFaq = async (index) => {
    const faq = faqs[index];
    if (faq.isNew) {
      setFaqs((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    setDeletingFaqId(faq.id);
    try {
      const res = await fetch(`/api/v1/blogs/${id}/faqs/${faq.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to delete FAQ");
      setFaqs((prev) => prev.filter((_, i) => i !== index));
      toast.success("FAQ deleted");
    } catch (err) {
      toast.error(err.message || "Failed to delete FAQ");
    } finally {
      setDeletingFaqId(null);
    }
  };

  const handleMoveFaq = async (index, direction) => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === faqs.length - 1)
    ) {
      return;
    }
    const newIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...faqs];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    updated[index] = { ...updated[index], display_order: index };
    updated[newIndex] = { ...updated[newIndex], display_order: newIndex };
    setFaqs(updated);

    const existingFaqs = updated.filter((f) => !f.isNew);
    for (const faq of existingFaqs) {
      try {
        await fetch(`/api/v1/blogs/${id}/faqs/${faq.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: faq.question,
            answer: faq.answer,
            display_order: faq.display_order,
            active: faq.active,
          }),
        });
      } catch (err) {
        console.error("Failed to update FAQ order:", err);
      }
    }
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
        updated_by: user?.id,
      };

      const res = await fetch(`/api/v1/blogs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToUpdate),
      });
      if (!res.ok) {
        shouldDeleteOldThumbnail = false;
        toast.dismiss("thumb-delete");
        throw new Error((await res.json().catch(() => ({}))).error || "Failed to update blog post");
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
              <TabsTrigger value="faq" onClick={() => setActiveFaqTab(true)}>
                <HelpCircle className="mr-2 h-4 w-4" /> Q & A
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
                    <SelectInput
                      id="category_id"
                      name="category_id"
                      options={categoryOptions}
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

            <TabsContent value="faq" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Questions & Answers</CardTitle>
                  <CardDescription>
                    Add curated FAQ pairs to improve SEO and help visitors.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {faqsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : faqs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No FAQs yet. Add your first question below.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {faqs.map((faq, index) => (
                        <div
                          key={faq.id}
                          className="border rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Question"
                              value={faq.question}
                              onChange={(e) =>
                                handleFaqChange(index, "question", e.target.value)
                              }
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveFaq(index, "up")}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveFaq(index, "down")}
                              disabled={index === faqs.length - 1}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteFaq(index)}
                              disabled={deletingFaqId === faq.id}
                            >
                              {deletingFaqId === faq.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XIcon className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <Textarea
                            placeholder="Answer"
                            value={faq.answer}
                            onChange={(e) =>
                              handleFaqChange(index, "answer", e.target.value)
                            }
                            rows={3}
                          />
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={faq.active}
                                onCheckedChange={(checked) =>
                                  handleFaqChange(index, "active", checked)
                                }
                              />
                              <Label>Active</Label>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleSaveFaq(index)}
                              disabled={savingFaqId === faq.id}
                            >
                              {savingFaqId === faq.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : null}
                              {faq.isNew ? "Create FAQ" : "Save Changes"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleAddFaq}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New FAQ
                  </Button>
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

        <div className="mt-6 border rounded-lg overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 text-sm font-medium transition-colors"
            onClick={() => {
              setVersionsOpen((v) => !v);
              if (!versionsOpen) fetchVersions();
            }}
          >
            <span>Version History</span>
            <span className="text-muted-foreground">{versionsOpen ? "▲" : "▼"}</span>
          </button>
          {versionsOpen && (
            <div className="p-4 space-y-3">
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSaveVersion}
                  disabled={isSavingVersion}
                >
                  {isSavingVersion ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : null}
                  Save Version
                </Button>
              </div>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No versions saved yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {versions.map((v) => (
                    <li key={v.id} className="py-2 flex items-center justify-between gap-2">
                      <span className="font-medium">v{v.version_number}</span>
                      <span className="flex-1 truncate text-muted-foreground">{v.title}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {v.saved_at ? new Date(v.saved_at).toLocaleString() : ""}
                      </span>
                      {v.saved_by_name && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{v.saved_by_name}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 border rounded-lg overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 text-sm font-medium transition-colors"
            onClick={() => {
              setRelatedOpen((v) => !v);
              if (!relatedOpen) fetchRelatedServices();
            }}
          >
            <span>Related Services</span>
            <span className="text-muted-foreground">{relatedOpen ? "▲" : "▼"}</span>
          </button>
          {relatedOpen && (
            <div className="p-4 space-y-3">
              {relatedServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No related services linked yet.</p>
              ) : (
                <ul className="divide-y text-sm mb-3">
                  {relatedServices.map((svc) => (
                    <li key={svc.id} className="py-2 flex items-center justify-between gap-2">
                      <span>{svc.title}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnlinkService(svc.id)}
                      >
                        Unlink
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Search services..."
                  value={serviceSearch}
                  onChange={(e) => handleServiceSearch(e.target.value)}
                  className="flex-1"
                />
                {isSearching && <Loader2 className="h-4 w-4 animate-spin self-center" />}
              </div>
              {serviceResults.length > 0 && (
                <ul className="border rounded text-sm divide-y max-h-48 overflow-y-auto">
                  {serviceResults.map((svc) => (
                    <li key={svc.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/40">
                      <span>{svc.title}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleLinkService(svc.id)}
                        disabled={isLinking}
                      >
                        Link
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
          message="Blog post updated successfully!"
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
    </div>
  );
}
