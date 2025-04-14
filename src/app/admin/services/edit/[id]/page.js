"use client";

import { useState, useEffect, useRef } from "react"; // Added useRef
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
import {
  Save,
  ImagePlus,
  FileText,
  Tag,
  Loader2,
  UploadCloud, // Added UploadCloud
  X as XIcon, // Added XIcon
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import supabase from "@/lib/supabase";
import slugify from "slugify";
import { uploadThumbnail, deleteThumbnailByUrl } from "@/lib/storageUtils";
import { toast } from "react-hot-toast";

export default function EditServicePage({ params }) {
  const router = useRouter();
  const { activeClient, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isUploading, setIsUploading] = useState(false); // Added upload state
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;
  const fileInputRef = useRef(null); // Ref for file input

  // State for thumbnail handling
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [originalThumbnailUrl, setOriginalThumbnailUrl] = useState(null); // Store original URL

  const [formData, setFormData] = useState({
    category_id: "",
    title: "",
    slug: "",
    short_description: "",
    content: "",
    thumbnail: "",
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
  });

  useEffect(() => {
    const fetchService = async () => {
      try {
        setIsFetching(true);

        const { data, error } = await supabase
          .from("wehoware_services")
          .select("*, category_id(id, name)")
          .eq("id", id)
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const initialThumbnailUrl = data.thumbnail || "";
          setFormData({
            category_id: data.category_id || "",
            title: data.title || "",
            slug: data.slug || "",
            short_description: data.description || "",
            content: data.content || "",
            thumbnail: initialThumbnailUrl,
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
          });
          setOriginalThumbnailUrl(initialThumbnailUrl); // Store original
          setPreviewUrl(initialThumbnailUrl); // Set initial preview
        } else {
          setErrorDialogOpen(true);
          setErrorMessage("Service not found");
          setTimeout(() => router.push("/admin/services"), 100);
        }
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
  }, [id, router]);

  useEffect(() => {
    const fetchCategories = async () => {
      if (!activeClient?.id) {
        setCategories([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("wehoware_service_categories")
          .select("id, name")
          .eq("client_id", activeClient.id)
          .order("name");

        if (error) throw error;
        setCategories(data || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
        setErrorMessage(error.message || "Failed to fetch service categories");
        setErrorDialogOpen(true);
      }
    };

    fetchCategories();
  }, [activeClient]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" || type === "switch" ? checked : value,
    }));

    // If user manually changes the thumbnail URL, clear the file input/preview
    if (name === "thumbnail") {
      setThumbnailFile(null);
      setPreviewUrl(value); // Show the URL they typed
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear the file input visually
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Basic validation (optional: add size/type checks)
      if (!file.type.startsWith("image/")) {
        toast.error("Invalid file type. Please select an image.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit example
        toast.error("File size exceeds 5MB limit.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setThumbnailFile(file);
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
      // Clear the URL input field if a file is chosen
      setFormData((prev) => ({ ...prev, thumbnail: "" }));
    } else {
      // If file selection is cancelled, revert preview to original/saved URL
      setThumbnailFile(null);
      setPreviewUrl(formData.thumbnail || originalThumbnailUrl || "");
    }
  };

  const clearThumbnail = () => {
    setThumbnailFile(null);
    setPreviewUrl(""); // Clear preview
    setFormData((prev) => ({ ...prev, thumbnail: "" })); // Clear URL in form
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear the actual file input element
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
      setIsUploading(false);

      let thumbnailUrlToSave = originalThumbnailUrl;

      if (thumbnailFile) {
        setIsUploading(true);
        toast.loading("Uploading thumbnail...");
        if (originalThumbnailUrl) {
          await deleteThumbnailByUrl(originalThumbnailUrl);
        }
        thumbnailUrlToSave = await uploadThumbnail(thumbnailFile, "services");
        toast.dismiss();
        toast.success("Thumbnail uploaded!");
        setIsUploading(false);
      } else {
        const currentUrl = formData.thumbnail ? formData.thumbnail.trim() : "";
        if (currentUrl !== originalThumbnailUrl) {
          if (originalThumbnailUrl) {
            await deleteThumbnailByUrl(originalThumbnailUrl);
          }
          thumbnailUrlToSave = currentUrl || null;
        } else {
          thumbnailUrlToSave = originalThumbnailUrl;
        }
      }

      const categoryIdToSend =
        typeof formData.category_id === "object" &&
        formData.category_id !== null
          ? formData.category_id.id
          : formData.category_id;

      const updateData = {
        category_id: categoryIdToSend,
        title: formData.title,
        slug:
          formData.slug ||
          slugify(formData.title, { lower: true, strict: true }),
        description: formData.short_description,
        content: formData.content,
        thumbnail: thumbnailUrlToSave, // Use the determined URL
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
        updated_at: new Date(),
        updated_by: user?.id,
      };

      toast.loading("Saving service...");
      const { error } = await supabase
        .from("wehoware_services")
        .update(updateData)
        .eq("id", id);

      toast.dismiss();

      if (error) {
        // If update fails after upload, the uploaded file remains.
        // Consider adding manual cleanup later if needed.
        console.error(
          "Database update failed AFTER potential storage action:",
          error
        );
        throw error;
      }

      setSuccessDialogOpen(true);
      // Update original URL state after successful save
      setOriginalThumbnailUrl(thumbnailUrlToSave);
      setThumbnailFile(null); // Clear file state
      if (fileInputRef.current) fileInputRef.current.value = ""; // Clear file input visually
    } catch (error) {
      toast.dismiss(); // Dismiss any loading toasts
      console.error("Error during service update process:", error);
      setErrorMessage(error.message || "Failed to update service");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title="Edit Service"
        backHref="/admin/services"
        ActionItem={() => (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isLoading || isUploading}
          >
            {isLoading || isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isUploading ? "Uploading..." : isLoading ? "Saving..." : "Update"}
          </Button>
        )}
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
                    <select
                      id="category_id"
                      name="category_id"
                      value={
                        typeof formData.category_id === "object" &&
                        formData.category_id !== null
                          ? formData.category_id.id
                          : formData.category_id
                      }
                      onChange={handleInputChange}
                      required
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="" disabled>
                        Select a category
                      </option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="short_description">Short Description</Label>
                    <Textarea
                      id="short_description"
                      name="short_description"
                      placeholder="A brief summary of the service"
                      value={formData.short_description}
                      onChange={handleInputChange}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Content *</Label>
                    <Textarea
                      id="content"
                      name="content"
                      placeholder="Detailed description of the service"
                      value={formData.content}
                      onChange={handleInputChange}
                      rows={8}
                      required
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Details Tab */}
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
                        {/* URL Input */}
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
                      <select
                        id="fee_currency"
                        name="fee_currency"
                        value={formData.fee_currency}
                        onChange={handleInputChange}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="CAD">CAD</option>
                        <option value="USD">USD</option>
                        {/* Add other currencies as needed */}
                      </select>
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
                      placeholder="e.g. business visa, work permit, immigration consultant"
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
      </div>
    </div>
  );
}
