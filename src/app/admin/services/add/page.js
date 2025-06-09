"use client";
import { useState, useEffect, useRef, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import AlertComponent from "@/components/ui/alert-component";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RichTextEditor from "@/components/ui/rich-text-editor";
import {
  ArrowLeft,
  Save,
  FileText,
  Tag,
  Loader2,
  ImagePlus,
  UploadCloud,
  X as XIcon,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import supabase from "@/lib/supabase";
import slugify from "slugify";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "react-hot-toast";
import { uploadThumbnail, deleteThumbnailByUrl } from "@/lib/storageUtils";
import SelectInput from "@/components/ui/select";

export default function AddServicePage() {
  const router = useRouter();
  const { activeClient, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInputRef = useRef(null);
  const [originalThumbnailUrl, setOriginalThumbnailUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [categories, setCategories] = useState([]);

  const categoryOptions = useMemo(() => {
    return categories.map((category) => ({
      value: category.id,
      label: category.name,
    }));
  }, [categories]);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    category_id: "",
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
          .eq("active", true)
          .order("name");

        if (error) throw error;
        setCategories(data || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
        setErrorMessage("Failed to load service categories.");
        setErrorDialogOpen(true);
        setCategories([]);
      }
    };

    fetchCategories();
  }, [activeClient]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const previousTitle = formData.title;

    let processedValue;
    if (type === "checkbox" && (name === "featured" || name === "active")) {
      processedValue = checked;
    } else if (name === "price") {
      processedValue = value === "" ? "" : parseFloat(value);
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

  // Handler for rich text editor content changes
  const handleContentChange = (html) => {
    setFormData({
      ...formData,
      content: html,
    });
  };

  // Handler for short description rich text editor changes
  const handleShortDescriptionChange = (html) => {
    setFormData({
      ...formData,
      short_description: html,
    });
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
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
      setFormData((prev) => ({ ...prev, thumbnail: "" }));
    } else {
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

    if (!activeClient?.id) {
      setErrorMessage(
        "Please select an active client from the header dropdown before adding a service."
      );
      return;
    }
    if (
      !formData.title ||
      !formData.slug ||
      !formData.short_description ||
      !formData.content ||
      !formData.seo_title ||
      !formData.seo_description
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }

    let dataToSubmit = { ...formData };

    try {
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

      const finalData = {
        client_id: activeClient.id,
        category_id: dataToSubmit.category_id,
        title: dataToSubmit.title,
        slug:
          dataToSubmit.slug ||
          slugify(dataToSubmit.title, { lower: true, strict: true }),
        description: dataToSubmit.short_description,
        content: dataToSubmit.content,
        thumbnail: thumbnailUrlToSave || formData.thumbnail || null,
        fee: dataToSubmit.price === "" ? null : parseFloat(dataToSubmit.price),
        fee_currency: dataToSubmit.fee_currency || "CAD",
        service_code: dataToSubmit.service_code || null,
        tags: dataToSubmit.tags
          ? dataToSubmit.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag)
          : [],
        duration: dataToSubmit.duration || null,
        active: dataToSubmit.active,
        featured: dataToSubmit.featured,
        meta_title: dataToSubmit.seo_title,
        meta_description: dataToSubmit.seo_description,
        meta_keywords: dataToSubmit.seo_keywords,
        created_by: user?.id,
        updated_by: user?.id,
      };

      const { data, error } = await supabase
        .from("wehoware_services")
        .insert([finalData])
        .select();
      if (error) {
        console.error("Supabase insert error:", error);
        // Check for specific Supabase errors if needed
        if (error.code === "23505") {
          // Example: unique constraint violation
          throw new Error(
            `Database Error: A service with this slug or another unique field might already exist. ${error.details}`
          );
        } else {
          throw new Error(`Database Error: ${error.message}`);
        }
      }
      setOriginalThumbnailUrl(thumbnailUrlToSave);
      toast.success("Service added successfully!");
      setIsLoading(false);
      setSuccessDialogOpen(true);
      router.push("/admin/services");
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      if (!errorMessage) {
        setErrorMessage(error.message || "An unexpected error occurred.");
      }
      toast.error(errorMessage || error.message || "Failed to add service.");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Add New Service"
          description="Create a new service for your clients"
          backLink="/admin/services"
          backIcon={<ArrowLeft size={16} />}
        />
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="w-full">
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
                  <CardTitle>Service Information</CardTitle>
                  <CardDescription>
                    Enter the details about this service
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="title">
                        Service Title
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="title"
                        name="title"
                        placeholder="e.g. Business Visa Application"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category_id">
                          Category <span className="text-destructive">*</span>
                        </Label>
                        <SelectInput
                          id="category_id"
                          name="category_id"
                          placeholder="Select a category"
                          value={formData.category_id}
                          onChange={handleInputChange}
                          required
                          options={categoryOptions}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price">Price/Fee</Label>
                        <Input
                          id="price"
                          name="price"
                          type="number"
                          placeholder="e.g. 1500.00"
                          value={formData.price}
                          onChange={handleInputChange}
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="short_description">
                      Short Description
                      <span className="text-destructive">*</span>
                    </Label>
                    <RichTextEditor
                      value={formData.short_description}
                      onChange={handleShortDescriptionChange}
                      placeholder="Brief summary of the service"
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
                  <CardTitle>Details & Settings</CardTitle>
                  <CardDescription>
                    Enter the details about this service
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duration">
                        Duration (e.g., hours, days)
                      </Label>
                      <Input
                        id="duration"
                        name="duration"
                        placeholder="e.g., 3 months, 1 year, Varies"
                        value={formData.duration}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fee_currency">Fee Currency</Label>
                    <Input
                      id="fee_currency"
                      name="fee_currency"
                      placeholder="e.g., CAD"
                      value={formData.fee_currency}
                      onChange={handleInputChange}
                    />
                    <p className="text-sm text-muted-foreground">
                      Currency code for the price (default: CAD).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="service_code">Service Code</Label>
                    <Input
                      id="service_code"
                      name="service_code"
                      placeholder="Internal code for the service"
                      value={formData.service_code}
                      onChange={handleInputChange}
                    />
                    <p className="text-sm text-muted-foreground">
                      Optional internal code for this service.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      name="tags"
                      placeholder="e.g. visa, application, consultation"
                      value={formData.tags}
                      onChange={handleInputChange}
                    />
                    <p className="text-sm text-muted-foreground">
                      Comma-separated list of tags.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="active"
                      name="active"
                      checked={formData.active}
                      onCheckedChange={(checked) =>
                        handleInputChange({
                          target: { name: "active", type: "checkbox", checked },
                        })
                      }
                    />
                    <Label htmlFor="active">Active</Label>
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="featured"
                      name="featured"
                      checked={formData.featured}
                      onCheckedChange={(checked) =>
                        handleInputChange({
                          target: {
                            name: "featured",
                            type: "checkbox",
                            checked,
                          },
                        })
                      }
                    />
                    <Label htmlFor="featured">Featured</Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>SEO Information</CardTitle>
                  <CardDescription>
                    Optimize this service page for search engines
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="seo_title">Meta Title</Label>
                    <Input
                      id="seo_title"
                      name="seo_title"
                      placeholder="Title for search engines"
                      value={formData.seo_title}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      SEO optimized title for search engines (required)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seo_description">Meta Description</Label>
                    <Textarea
                      id="seo_description"
                      name="seo_description"
                      placeholder="Brief description for search engines"
                      value={formData.seo_description}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Short description for search engines (required, max 160
                      characters)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seo_keywords">Keywords</Label>
                    <Input
                      id="seo_keywords"
                      name="seo_keywords"
                      placeholder="e.g. business service"
                      value={formData.seo_keywords}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Comma-separated keywords related to this service
                      (required)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      name="slug"
                      placeholder="e.g. business-visa-application"
                      value={formData.slug}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Unique identifier for the service URL (required)
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
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Service
                </>
              )}
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
          message="Service created successfully!"
          actionLabel="OK"
          onAction={() => {
            router.push("/admin/services");
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
