"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AlertComponent from "@/components/ui/alert-component";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RichTextEditor from "@/components/ui/rich-text-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Save,
  ImagePlus,
  FileText,
  Tag,
  Loader2,
  UploadCloud,
  X as XIcon,
  Eye,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  Plus,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";

import slugify from "slugify";
import { uploadThumbnail, deleteThumbnailByUrl } from "@/lib/storageUtils";
import { toast } from "react-hot-toast";
import SelectInput from "@/components/ui/select";

async function resolveThumbnailUrl(thumbnailFile, formData, originalThumbnailUrl) {
  if (thumbnailFile) {
    if (originalThumbnailUrl) await deleteThumbnailByUrl(originalThumbnailUrl);
    return await uploadThumbnail(thumbnailFile, "services");
  }
  const currentUrl = formData.thumbnail ? formData.thumbnail.trim() : "";
  if (currentUrl === originalThumbnailUrl) return originalThumbnailUrl;
  if (originalThumbnailUrl) await deleteThumbnailByUrl(originalThumbnailUrl);
  return currentUrl || null;
}

function validateImageFile(file, fileInputRef) {
  if (!file.type.startsWith("image/")) {
    toast.error("Invalid file type. Please select an image.");
    if (fileInputRef.current) fileInputRef.current.value = "";
    return false;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error("File size exceeds 5MB limit.");
    if (fileInputRef.current) fileInputRef.current.value = "";
    return false;
  }
  return true;
}

export default function EditServicePage({ params }) {
  const router = useRouter();
  const { activeClient, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;
  const fileInputRef = useRef(null);

  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [originalThumbnailUrl, setOriginalThumbnailUrl] = useState(null);

  const [previewOpen, setPreviewOpen] = useState(false);

  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);

  const [relatedBlogsOpen, setRelatedBlogsOpen] = useState(false);
  const [relatedBlogs, setRelatedBlogs] = useState([]);
  const [relatedBlogsLoading, setRelatedBlogsLoading] = useState(false);
  const [blogSearch, setBlogSearch] = useState("");
  const [blogSearchResults, setBlogSearchResults] = useState([]);
  const [blogSearching, setBlogSearching] = useState(false);
  const [linkingBlog, setLinkingBlog] = useState(false);

  const [faqs, setFaqs] = useState([]);
  const [faqsLoading, setFaqsLoading] = useState(false);
  const [activeFaqTab, setActiveFaqTab] = useState(false);
  const [savingFaqId, setSavingFaqId] = useState(null);
  const [deletingFaqId, setDeletingFaqId] = useState(null);

  const [formData, setFormData] = useState({
    category_id: "",
    title: "",
    slug: "",
    short_description: "",
    content: "",
    thumbnail: "",
    thumbnail_alt: "",
    price: "",
    fee_currency: "CAD",
    service_code: "",
    tags: "",
    duration: "",
    active: true,
    featured: false,
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
    schema_type: "Service",
    target_keywords: "",
    cta_heading: "",
    cta_body: "",
    cta_button_text: "",
    cta_button_url: "",
    allow_social_share: true,
    scheduled_publish_at: "",
  });

  const categoryOptions = useMemo(() => {
    return categories.map((cat) => ({
      value: cat.id,
      label: cat.name,
    }));
  }, [categories]);

  useEffect(() => {
    const fetchService = async () => {
      try {
        setIsFetching(true);
        const res = await fetch(`/api/v1/services/${id}`);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Service not found");
        const json = await res.json();
        const data = json.service;
        if (!data) throw new Error("Service not found");

        const initialThumbnailUrl = data.thumbnail || "";
        setFormData({
          category_id: data.category_id || "",
          title: data.title || "",
          slug: data.slug || "",
          short_description: data.description || "",
          content: data.content || "",
          thumbnail: initialThumbnailUrl,
          thumbnail_alt: data.thumbnail_alt || "",
          price: data.fee ? String(data.fee) : "",
          fee_currency: data.fee_currency || "CAD",
          service_code: data.service_code || "",
          tags: Array.isArray(data.tags) ? data.tags.join(", ") : "",
          duration: data.duration || "",
          active: data.active === true,
          featured: data.featured === true,
          seo_title: data.meta_title || "",
          seo_description: data.meta_description || "",
          seo_keywords: data.meta_keywords || "",
          open_graph_title: data.open_graph_title || "",
          open_graph_description: data.open_graph_description || "",
          open_graph_image: data.open_graph_image || "",
          twitter_title: data.twitter_title || "",
          twitter_description: data.twitter_description || "",
          twitter_image: data.twitter_image || "",
          canonical_url: data.canonical_url || "",
          robots_meta: data.robots_meta || "index,follow",
          schema_type: data.schema_type || "Service",
          target_keywords: Array.isArray(data.target_keywords) ? data.target_keywords.join(", ") : "",
          cta_heading: data.cta_heading || "",
          cta_body: data.cta_body || "",
          cta_button_text: data.cta_button_text || "",
          cta_button_url: data.cta_button_url || "",
          allow_social_share: data.allow_social_share !== false,
          scheduled_publish_at: data.scheduled_publish_at || "",
        });
        setOriginalThumbnailUrl(initialThumbnailUrl);
        setPreviewUrl(initialThumbnailUrl);
      } catch (error) {
        console.error("Error fetching service:", error);
        setErrorDialogOpen(true);
        setErrorMessage(error.message || "Failed to fetch service");
        setTimeout(() => router.push("/admin/services"), 100);
      } finally {
        setIsFetching(false);
      }
    };

    fetchService();
  }, [id, activeClient?.id, router]);

  useEffect(() => {
    const fetchCategories = async () => {
      if (!activeClient?.id) {
        setCategories([]);
        return;
      }
      try {
        const res = await fetch("/api/v1/services/categories");
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch categories");
        const json = await res.json();
        setCategories(json.data || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
        setErrorMessage(error.message || "Failed to fetch service categories");
        setErrorDialogOpen(true);
      }
    };

    fetchCategories();
  }, [activeClient]);

  useEffect(() => {
    if (!versionsOpen || versions.length > 0) return;
    const fetchVersions = async () => {
      setVersionsLoading(true);
      try {
        const res = await fetch(`/api/v1/services/${id}/versions`);
        if (!res.ok) throw new Error("Failed to fetch versions");
        const json = await res.json();
        setVersions(json.versions || []);
      } catch (err) {
        console.error(err);
      } finally {
        setVersionsLoading(false);
      }
    };
    fetchVersions();
  }, [versionsOpen, id]);

  useEffect(() => {
    if (!relatedBlogsOpen || relatedBlogs.length > 0) return;
    const fetchRelatedBlogs = async () => {
      setRelatedBlogsLoading(true);
      try {
        const res = await fetch(`/api/v1/services/${id}/related-blogs`);
        if (!res.ok) throw new Error("Failed to fetch related blogs");
        const json = await res.json();
        setRelatedBlogs(json.blogs || []);
      } catch (err) {
        console.error(err);
      } finally {
        setRelatedBlogsLoading(false);
      }
    };
    fetchRelatedBlogs();
  }, [relatedBlogsOpen, id]);

  useEffect(() => {
    if (!activeFaqTab || !id) return;
    const fetchFaqs = async () => {
      setFaqsLoading(true);
      try {
        const res = await fetch(`/api/v1/services/${id}/faqs`);
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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const updatedValue = type === "checkbox" ? checked : value;

    if (name === "thumbnail") {
      handleThumbnailUrlChange(value);
    }

    setFormData((prev) => ({ ...prev, [name]: updatedValue }));
  };

  const handleContentChange = (html) => {
    setFormData({
      ...formData,
      content: html,
    });
  };

  const handleShortDescriptionChange = (html) => {
    setFormData({
      ...formData,
      short_description: html,
    });
  };

  const handleThumbnailUrlChange = (value) => {
    setThumbnailFile(null);
    setPreviewUrl(value);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setThumbnailFile(null);
      setPreviewUrl(formData.thumbnail || originalThumbnailUrl || "");
      return;
    }
    if (!validateImageFile(file, fileInputRef)) return;
    setThumbnailFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
    setFormData((prev) => ({ ...prev, thumbnail: "" }));
  };

  const clearThumbnail = () => {
    setThumbnailFile(null);
    setPreviewUrl("");
    setFormData((prev) => ({ ...prev, thumbnail: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.title ||
      !formData.category_id ||
      !formData.content ||
      !formData.price ||
      !formData.seo_title ||
      !formData.seo_description ||
      !formData.seo_keywords
    ) {
      setErrorMessage("Please fill in all required fields (marked with *).");
      setErrorDialogOpen(true);
      return;
    }

    try {
      setIsLoading(true);
      if (thumbnailFile) setIsUploading(true);

      if (thumbnailFile) toast.loading("Uploading thumbnail...");
      const thumbnailUrlToSave = await resolveThumbnailUrl(thumbnailFile, formData, originalThumbnailUrl);
      if (thumbnailFile) {
        toast.dismiss();
        toast.success("Thumbnail uploaded!");
        setIsUploading(false);
      }

      const updateData = {
        category_id: formData.category_id,
        title: formData.title,
        slug:
          formData.slug ||
          slugify(formData.title, { lower: true, strict: true }),
        description: formData.short_description,
        content: formData.content,
        thumbnail: thumbnailUrlToSave,
        thumbnail_alt: formData.thumbnail_alt || null,
        fee: formData.price === "" ? null : parseFloat(formData.price),
        fee_currency: formData.fee_currency || "CAD",
        service_code: formData.service_code || null,
        tags: formData.tags
          ? formData.tags.split(",").map((tag) => tag.trim())
          : [],
        duration: formData.duration || null,
        active: formData.active,
        featured: formData.featured,
        meta_title: formData.seo_title,
        meta_description: formData.seo_description,
        meta_keywords: formData.seo_keywords,
        open_graph_title: formData.open_graph_title || null,
        open_graph_description: formData.open_graph_description || null,
        open_graph_image: formData.open_graph_image || null,
        twitter_title: formData.twitter_title || null,
        twitter_description: formData.twitter_description || null,
        twitter_image: formData.twitter_image || null,
        canonical_url: formData.canonical_url || null,
        robots_meta: formData.robots_meta || "index,follow",
        schema_type: formData.schema_type || "Service",
        target_keywords: formData.target_keywords
          ? formData.target_keywords.split(",").map((k) => k.trim()).filter(Boolean)
          : [],
        cta_heading: formData.cta_heading || null,
        cta_body: formData.cta_body || null,
        cta_button_text: formData.cta_button_text || null,
        cta_button_url: formData.cta_button_url || null,
        allow_social_share: formData.allow_social_share,
        scheduled_publish_at: formData.scheduled_publish_at || null,
        updated_at: new Date(),
        updated_by: user?.id,
      };

      toast.loading("Saving service...");
      const res = await fetch(`/api/v1/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      toast.dismiss();
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to update service");

      setSuccessDialogOpen(true);
      setOriginalThumbnailUrl(thumbnailUrlToSave);
      setThumbnailFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast.dismiss();
      console.error("Error during service update process:", error);
      setErrorMessage(error.message || "Failed to update service");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  const handleSaveVersion = async () => {
    setSavingVersion(true);
    try {
      const res = await fetch(`/api/v1/services/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to save version");
      const json = await res.json();
      setVersions((prev) => [json.version, ...prev].filter(Boolean));
      toast.success("Version saved!");
    } catch (err) {
      toast.error(err.message || "Failed to save version");
    } finally {
      setSavingVersion(false);
    }
  };

  const handleBlogSearch = async () => {
    if (!blogSearch.trim()) return;
    setBlogSearching(true);
    try {
      const res = await fetch(`/api/v1/blogs?search=${encodeURIComponent(blogSearch)}&limit=10`);
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json();
      setBlogSearchResults(json.blogs || json.data || []);
    } catch (err) {
      toast.error(err.message || "Blog search failed");
    } finally {
      setBlogSearching(false);
    }
  };

  const handleLinkBlog = async (blogId) => {
    setLinkingBlog(true);
    try {
      const res = await fetch(`/api/v1/services/${id}/related-blogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId }),
      });
      if (!res.ok) throw new Error("Failed to link blog");
      const json = await res.json();
      setRelatedBlogs((prev) => [...prev, json.blog].filter(Boolean));
      setBlogSearchResults((prev) => prev.filter((b) => b.id !== blogId));
      toast.success("Blog linked!");
    } catch (err) {
      toast.error(err.message || "Failed to link blog");
    } finally {
      setLinkingBlog(false);
    }
  };

  const handleUnlinkBlog = async (blogId) => {
    try {
      const res = await fetch(`/api/v1/services/${id}/related-blogs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId }),
      });
      if (!res.ok) throw new Error("Failed to unlink blog");
      setRelatedBlogs((prev) => prev.filter((b) => b.id !== blogId));
      toast.success("Blog unlinked!");
    } catch (err) {
      toast.error(err.message || "Failed to unlink blog");
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
        const res = await fetch(`/api/v1/services/${id}/faqs`, {
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
        const res = await fetch(`/api/v1/services/${id}/faqs/${faq.id}`, {
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
      const res = await fetch(`/api/v1/services/${id}/faqs/${faq.id}`, {
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

    // Persist order for existing FAQs only
    const existingFaqs = updated.filter((f) => !f.isNew);
    for (const faq of existingFaqs) {
      try {
        await fetch(`/api/v1/services/${id}/faqs/${faq.id}`, {
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

  if (isFetching) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const isBusy = isLoading || isUploading;
  let saveLabel = "Update";
  if (isUploading) saveLabel = "Uploading...";
  else if (isLoading) saveLabel = "Saving...";
  const saveIcon = isBusy
    ? <Loader2 className="h-4 w-4 animate-spin" />
    : <Save className="h-4 w-4" />;

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title="Edit Service"
        backLink="/admin/services"
        secondaryActionLabel="Preview"
        secondaryActionIcon={<Eye className="h-4 w-4" />}
        onSecondaryAction={() => setPreviewOpen(true)}
        actionLabel={saveLabel}
        actionIcon={saveIcon}
        onAction={handleSubmit}
        actionDisabled={isBusy}
      />
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
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
                  xmlns="http://www.w3.org/2000/svg"
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
                    Essential details about the service. Fields marked with *
                    are required.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        name="title"
                        placeholder="Service Title"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
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
                    <Label htmlFor="short_description">Short Description</Label>
                    <RichTextEditor
                      value={formData.short_description}
                      onChange={handleShortDescriptionChange}
                      placeholder="A brief summary of the service"
                      className="min-h-[150px]"
                    />
                    <p className="text-sm text-muted-foreground">
                      A short description displayed in list views.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">
                      Content
                      <span className="text-destructive">*</span>
                    </Label>
                    <RichTextEditor
                      value={formData.content}
                      onChange={handleContentChange}
                      placeholder="Detailed description of the service"
                      className="min-h-[150px]"
                    />
                    <p className="text-sm text-muted-foreground">
                      The main content/description for the service page
                      (required). You can add images, videos, headings, and more
                      using the toolbar.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Details & Configuration</CardTitle>
                  <CardDescription>
                    Pricing, appearance, and other settings. Fields marked with
                    * are required.
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
                          disabled={isUploading || isFetching}
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
                    <Label htmlFor="thumbnail_alt">Alt Text</Label>
                    <Input
                      id="thumbnail_alt"
                      name="thumbnail_alt"
                      placeholder="Describe the image for accessibility"
                      value={formData.thumbnail_alt}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Price *</Label>
                      <Input
                        id="price"
                        name="price"
                        type="number"
                        placeholder="e.g. 99.99"
                        value={formData.price}
                        onChange={handleInputChange}
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fee_currency">Currency</Label>
                      <SelectInput
                        id="fee_currency"
                        name="fee_currency"
                        placeholder="Select a currency"
                        value={formData.fee_currency}
                        onChange={handleInputChange}
                        required
                        options={[
                          { value: "CAD", label: "CAD" },
                          { value: "USD", label: "USD" },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="service_code">Service Code</Label>
                      <Input
                        id="service_code"
                        name="service_code"
                        placeholder="Optional internal code"
                        value={formData.service_code}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration</Label>
                      <Input
                        id="duration"
                        name="duration"
                        placeholder="e.g., 1 hour, 2 weeks"
                        value={formData.duration}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      name="tags"
                      placeholder="Comma-separated tags (e.g., web, design, seo)"
                      value={formData.tags}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scheduled_publish_at">Schedule Publish At</Label>
                    <Input
                      id="scheduled_publish_at"
                      name="scheduled_publish_at"
                      type="datetime-local"
                      value={formData.scheduled_publish_at}
                      onChange={handleInputChange}
                    />
                    <p className="text-sm text-muted-foreground">
                      Leave blank to activate manually.
                    </p>
                  </div>

                  <div className="flex items-center space-x-4 pt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="featured"
                        name="featured"
                        checked={formData.featured}
                        onCheckedChange={(checked) =>
                          handleInputChange({
                            target: { name: "featured", checked },
                          })
                        }
                      />
                      <Label htmlFor="featured">Featured</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="active"
                        name="active"
                        checked={formData.active}
                        onCheckedChange={(checked) =>
                          handleInputChange({
                            target: { name: "active", checked },
                          })
                        }
                      />
                      <Label htmlFor="active">Active</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>SEO Information *</CardTitle>
                  <CardDescription>
                    Optimize this service page for search engines. All fields
                    are required.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="seo_title">Meta Title *</Label>
                    <Input
                      id="seo_title"
                      name="seo_title"
                      placeholder="Title for search engines"
                      value={formData.seo_title}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seo_description">Meta Description *</Label>
                    <Textarea
                      id="seo_description"
                      name="seo_description"
                      placeholder="Brief description for search engines (max 160 chars)"
                      value={formData.seo_description}
                      onChange={handleInputChange}
                      rows={3}
                      maxLength={160}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seo_keywords">Keywords *</Label>
                    <Input
                      id="seo_keywords"
                      name="seo_keywords"
                      placeholder="e.g. business service keywords"
                      value={formData.seo_keywords}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Comma-separated keywords related to this service.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      name="slug"
                      placeholder="auto-generated-from-title"
                      value={formData.slug}
                      onChange={handleInputChange}
                    />
                    <p className="text-sm text-muted-foreground">
                      URL-friendly identifier (leave blank to auto-generate).
                    </p>
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
                          placeholder="Service"
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
                    <h4 className="text-sm font-semibold">Call to Action</h4>
                    <div className="space-y-2">
                      <Label htmlFor="cta_heading">CTA Heading</Label>
                      <Input
                        id="cta_heading"
                        name="cta_heading"
                        placeholder="e.g. Get Started Today"
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
                          placeholder="e.g. Contact Us"
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
                          placeholder="https://example.com/contact"
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
                        handleInputChange({
                          target: { name: "allow_social_share", type: "checkbox", checked },
                        })
                      }
                    />
                    <Label htmlFor="allow_social_share">Allow Social Share</Label>
                  </div>
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
              onClick={() => router.push("/admin/services")}
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
                ? "Saving..."
                : "Update Service"}
            </Button>
          </div>
        </form>

        <Card className="mt-6">
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setVersionsOpen((v) => !v)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Version History</CardTitle>
              {versionsOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {versionsOpen && (
            <CardContent className="space-y-3">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveVersion}
                  disabled={savingVersion}
                >
                  {savingVersion ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save Version
                </Button>
              </div>
              {versionsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No versions saved yet.
                </p>
              ) : (
                <div className="divide-y divide-border rounded border">
                  {versions.map((v, i) => (
                    <div
                      key={v.id || i}
                      className="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-muted-foreground">
                          v{v.version_number ?? i + 1}
                        </span>
                        <span className="truncate max-w-[200px]">{v.title}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        {v.saved_by && <span>{v.saved_by}</span>}
                        {v.saved_at && (
                          <span>
                            {new Date(v.saved_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        <Card className="mt-4">
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setRelatedBlogsOpen((v) => !v)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Related Blog Posts</CardTitle>
              {relatedBlogsOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {relatedBlogsOpen && (
            <CardContent className="space-y-4">
              {relatedBlogsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : relatedBlogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No linked blog posts.
                </p>
              ) : (
                <div className="divide-y divide-border rounded border">
                  {relatedBlogs.map((blog) => (
                    <div
                      key={blog.id}
                      className="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <span className="truncate flex-grow mr-4">{blog.title}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnlinkBlog(blog.id)}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Search blog posts..."
                  value={blogSearch}
                  onChange={(e) => {
                    setBlogSearch(e.target.value);
                    setBlogSearchResults([]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBlogSearch();
                    }
                  }}
                  className="flex-grow"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBlogSearch}
                  disabled={blogSearching}
                >
                  {blogSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
              {blogSearchResults.length > 0 && (
                <div className="divide-y divide-border rounded border">
                  {blogSearchResults.map((blog) => (
                    <div
                      key={blog.id}
                      className="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <span className="truncate flex-grow mr-4">{blog.title}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLinkBlog(blog.id)}
                        disabled={linkingBlog}
                      >
                        Link
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

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
          message="Service updated successfully!"
          actionLabel="OK"
          onAction={() => {
            setSuccessDialogOpen(false);
            router.push("/admin/services");
          }}
        />

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Service Preview</DialogTitle>
            </DialogHeader>
            <div className="prose max-w-none dark:prose-invert">
              <h1>{formData.title}</h1>
              <div
                dangerouslySetInnerHTML={{ __html: formData.short_description }}
              />
              <div
                dangerouslySetInnerHTML={{ __html: formData.content }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
