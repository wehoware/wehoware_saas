"use client";

import Image from "next/image";
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
  Plus,
  Trash2,
  Car,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";

import slugify from "slugify";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "react-hot-toast";
import { uploadThumbnail, deleteThumbnailByUrl } from "@/lib/storageUtils";
import SelectInput from "@/components/ui/select";

const ITEM_TYPE_OPTIONS = [
  { value: "vehicle", label: "Vehicle" },
  { value: "furniture", label: "Furniture" },
  { value: "food", label: "Food" },
  { value: "menu", label: "Menu" },
  { value: "product", label: "Product" },
  { value: "digital", label: "Digital" },
  { value: "custom", label: "Custom" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
  { value: "sold", label: "Sold" },
  { value: "reserved", label: "Reserved" },
  { value: "archived", label: "Archived" },
];

const CURRENCY_OPTIONS = [
  { value: "CAD", label: "CAD" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "INR", label: "INR" },
];

const VEHICLE_ATTRIBUTE_FIELDS = [
  { key: "make", label: "Make", type: "text", placeholder: "e.g. Toyota" },
  { key: "model", label: "Model", type: "text", placeholder: "e.g. Camry" },
  { key: "year", label: "Year", type: "number", placeholder: "e.g. 2023" },
  { key: "vin", label: "VIN", type: "text", placeholder: "e.g. 1HGBH41JXMN109186" },
  { key: "mileage", label: "Mileage (km)", type: "number", placeholder: "e.g. 25000" },
  { key: "transmission", label: "Transmission", type: "text", placeholder: "e.g. Automatic" },
  { key: "fuel_type", label: "Fuel Type", type: "text", placeholder: "e.g. Gasoline" },
  { key: "body_type", label: "Body Type", type: "text", placeholder: "e.g. Sedan" },
  { key: "exterior_color", label: "Exterior Color", type: "text", placeholder: "e.g. Silver" },
  { key: "interior_color", label: "Interior Color", type: "text", placeholder: "e.g. Black" },
  { key: "engine_size", label: "Engine Size", type: "text", placeholder: "e.g. 2.5L" },
  { key: "doors", label: "Doors", type: "number", placeholder: "e.g. 4" },
  { key: "seats", label: "Seats", type: "number", placeholder: "e.g. 5" },
  { key: "condition", label: "Condition", type: "select", options: [
    { value: "new", label: "New" },
    { value: "used", label: "Used" },
    { value: "certified", label: "Certified Pre-Owned" },
    { value: "excellent", label: "Excellent" },
    { value: "good", label: "Good" },
    { value: "fair", label: "Fair" },
  ] },
];

export default function AddInventoryPage() {
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
  const [customAttributes, setCustomAttributes] = useState([{ key: "", value: "" }]);
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);

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
    type: "product",
    sku: "",
    short_description: "",
    content: "",
    thumbnail: "",
    thumbnail_alt: "",
    price: "",
    currency: "CAD",
    quantity: "1",
    reorder_threshold: "0",
    status: "draft",
    tags: "",
    featured: false,
    active: true,
    price_visible: true,
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
    schema_type: "Product",
    target_keywords: "",
    cta_heading: "",
    cta_body: "",
    cta_button_text: "",
    cta_button_url: "",
    allow_social_share: true,
    slug_locked: false,
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
    vehicle_vin: "",
    vehicle_mileage: "",
    vehicle_transmission: "",
    vehicle_fuel_type: "",
    vehicle_body_type: "",
    vehicle_exterior_color: "",
    vehicle_interior_color: "",
    vehicle_engine_size: "",
    vehicle_doors: "",
    vehicle_seats: "",
    vehicle_condition: "",
  });

  useEffect(() => {
    const fetchCategories = async () => {
      if (!activeClient?.id) {
        setCategories([]);
        return;
      }
      try {
        const res = await fetch("/api/v1/inventory/categories?active=true");
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to load categories");
        const json = await res.json();
        setCategories(json.data || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
        setErrorMessage("Failed to load inventory categories.");
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
    if (type === "checkbox") {
      processedValue = checked;
    } else if (name === "price" || name === "quantity" || name === "reorder_threshold") {
      processedValue = value === "" ? "" : value;
    } else {
      processedValue = value;
    }

    const newFormData = {
      ...formData,
      [name]: processedValue,
    };

    if (name === "title" && !formData.slug_locked) {
      const currentSlug = formData.slug;
      const previousSlug = slugify(previousTitle || "", { lower: true, strict: true });
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

  const handleContentChange = (html) => {
    setFormData({ ...formData, content: html });
  };

  const handleShortDescriptionChange = (html) => {
    setFormData({ ...formData, short_description: html });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Invalid file type. Please select an image.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size exceeds 5MB limit.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
      setFormData((prev) => ({ ...prev, thumbnail: "" }));
    } else {
      setThumbnailFile(null);
      setPreviewUrl(formData.thumbnail || originalThumbnailUrl || "");
    }
  };

  const clearThumbnail = () => {
    setThumbnailFile(null);
    setPreviewUrl("");
    setFormData((prev) => ({ ...prev, thumbnail: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddCustomAttribute = () => {
    setCustomAttributes((prev) => [...prev, { key: "", value: "" }]);
  };

  const handleCustomAttributeChange = (index, field, value) => {
    setCustomAttributes((prev) =>
      prev.map((attr, i) => (i === index ? { ...attr, [field]: value } : attr))
    );
  };

  const handleRemoveCustomAttribute = (index) => {
    setCustomAttributes((prev) => prev.filter((_, i) => i !== index));
  };

  const galleryFileInputRef = useRef(null);
  const [isBatchUploading, setIsBatchUploading] = useState(false);

  const handleAddImage = () => {
    setImages((prev) => [...prev, { url: "", alt: "" }]);
  };

  const handleBatchImageUpload = async (files) => {
    const valid = [];
    let rejected = 0;
    for (const file of files) {
      if (!file.type.startsWith("image/")) { rejected++; continue; }
      if (file.size > 5 * 1024 * 1024) { rejected++; continue; }
      valid.push(file);
    }
    if (rejected > 0) {
      toast.error(`${rejected} file(s) rejected (invalid type or exceeds 5MB).`);
    }
    if (valid.length === 0) return;

    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const placeholders = valid.map((_, i) => ({ url: "", alt: "", uploading: true, _batchId: `${batchId}-${i}` }));

    setIsBatchUploading(true);
    setImages((prev) => [...prev, ...placeholders]);

    const CONCURRENCY = 5;
    let successCount = 0;
    let failCount = 0;
    const failedBatchIds = [];

    for (let i = 0; i < valid.length; i += CONCURRENCY) {
      const chunk = valid.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((file) => uploadThumbnail(file, "inventory"))
      );
      for (let j = 0; j < results.length; j++) {
        const entryBatchId = `${batchId}-${i + j}`;
        if (results[j].status === "fulfilled") {
          setImages((prev) =>
            prev.map((img) =>
              img._batchId === entryBatchId
                ? { url: results[j].value, alt: img.alt, uploading: false }
                : img
            )
          );
          successCount++;
        } else {
          failedBatchIds.push(entryBatchId);
          failCount++;
        }
      }
    }

    if (failedBatchIds.length > 0) {
      setImages((prev) => prev.filter((img) => !failedBatchIds.includes(img._batchId)));
    }

    setImages((prev) => prev.map((img) => {
      const { _batchId, ...rest } = img;
      return rest;
    }));

    setIsBatchUploading(false);

    if (successCount > 0 && failCount === 0) {
      toast.success(`Uploaded ${successCount} image(s)!`);
    } else if (successCount > 0 && failCount > 0) {
      toast.error(`Uploaded ${successCount}, failed ${failCount}.`);
    } else {
      toast.error("All uploads failed. Please try again.");
    }
  };

  const handleImageChange = (index, field, value) => {
    setImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, [field]: value } : img))
    );
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageUpload = async (index, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file type. Please select an image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit.");
      return;
    }
    try {
      setImages((prev) =>
        prev.map((img, i) => (i === index ? { ...img, uploading: true } : img))
      );
      const url = await uploadThumbnail(file, "inventory");
      setImages((prev) =>
        prev.map((img, i) => (i === index ? { ...img, url, uploading: false } : img))
      );
      toast.success("Image uploaded!");
    } catch (err) {
      setImages((prev) =>
        prev.map((img, i) => (i === index ? { ...img, uploading: false } : img))
      );
      toast.error(err.message || "Failed to upload image");
    }
  };

  const handleAddVideo = () => {
    setVideos((prev) => [...prev, { url: "", title: "" }]);
  };

  const handleVideoChange = (index, field, value) => {
    setVideos((prev) =>
      prev.map((vid, i) => (i === index ? { ...vid, [field]: value } : vid))
    );
  };

  const handleRemoveVideo = (index) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
  };

  const buildAttributes = () => {
    const attrs = {};
    if (formData.type === "vehicle") {
      VEHICLE_ATTRIBUTE_FIELDS.forEach((field) => {
        const formKey = `vehicle_${field.key}`;
        if (formData[formKey]) {
          attrs[field.key] = formData[formKey];
        }
      });
    }
    customAttributes.forEach((attr) => {
      if (attr.key.trim() && attr.value.trim()) {
        attrs[attr.key.trim()] = attr.value.trim();
      }
    });
    return Object.keys(attrs).length > 0 ? attrs : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!activeClient?.id) {
      setErrorMessage("Please select an active client from the header dropdown before adding an inventory item.");
      setErrorDialogOpen(true);
      return;
    }
    if (!formData.title || !formData.slug || !formData.category_id || !formData.short_description) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      setIsLoading(true);

      let thumbnailUrlToSave = originalThumbnailUrl;
      if (thumbnailFile) {
        setIsUploading(true);
        toast.loading("Uploading thumbnail...");
        if (originalThumbnailUrl) {
          await deleteThumbnailByUrl(originalThumbnailUrl);
        }
        thumbnailUrlToSave = await uploadThumbnail(thumbnailFile, "inventory");
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
        category_id: formData.category_id,
        title: formData.title,
        slug: formData.slug || slugify(formData.title, { lower: true, strict: true }),
        type: formData.type,
        sku: formData.sku || null,
        description: formData.short_description,
        content: formData.content || null,
        thumbnail: thumbnailUrlToSave || formData.thumbnail || null,
        thumbnail_alt: formData.thumbnail_alt || null,
        price: formData.price === "" ? null : parseFloat(formData.price),
        currency: formData.currency || "CAD",
        price_visible: formData.price_visible,
        quantity: formData.quantity === "" ? 0 : parseInt(formData.quantity, 10),
        reorder_threshold: formData.reorder_threshold === "" ? 0 : parseInt(formData.reorder_threshold, 10),
        status: formData.status,
        tags: formData.tags
          ? formData.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
          : [],
        featured: formData.featured,
        active: formData.active,
        attributes: buildAttributes(),
        images: images.filter((img) => img.url).map((img) => ({ url: img.url, alt: img.alt || null })),
        videos: videos.filter((vid) => vid.url).map((vid) => ({ url: vid.url, title: vid.title || null })),
        meta_title: formData.seo_title || null,
        meta_description: formData.seo_description || null,
        meta_keywords: formData.seo_keywords || null,
        open_graph_title: formData.open_graph_title || null,
        open_graph_description: formData.open_graph_description || null,
        open_graph_image: formData.open_graph_image || null,
        twitter_title: formData.twitter_title || null,
        twitter_description: formData.twitter_description || null,
        twitter_image: formData.twitter_image || null,
        canonical_url: formData.canonical_url || null,
        robots_meta: formData.robots_meta || "index,follow",
        schema_type: formData.schema_type || "Product",
        target_keywords: formData.target_keywords || null,
        cta_heading: formData.cta_heading || null,
        cta_body: formData.cta_body || null,
        cta_button_text: formData.cta_button_text || null,
        cta_button_url: formData.cta_button_url || null,
        allow_social_share: formData.allow_social_share,
        created_by: user?.id,
        updated_by: user?.id,
      };

      const res = await fetch("/api/v1/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalData),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to add inventory item");
      setOriginalThumbnailUrl(thumbnailUrlToSave);
      toast.success("Inventory item added successfully!");
      setSuccessDialogOpen(true);
      router.push("/admin/inventory");
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      setErrorMessage(error.message || "An unexpected error occurred.");
      toast.error(error.message || "Failed to add inventory item.");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const isBusy = isLoading || isUploading;
  let saveLabel = "Save Item";
  if (isUploading) saveLabel = "Uploading...";
  else if (isLoading) saveLabel = "Saving...";
  const saveIcon = isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />;

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Add New Inventory Item"
          description="Create a new inventory item"
          backLink="/admin/inventory"
          backIcon={<ArrowLeft size={16} />}
          actionLabel={saveLabel}
          actionIcon={saveIcon}
          onAction={handleSubmit}
          actionDisabled={isBusy}
        />
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList>
              <TabsTrigger value="basic">
                <FileText className="mr-1.5 h-4 w-4" /> Basic Info
              </TabsTrigger>
              <TabsTrigger value="details">
                <Tag className="mr-1.5 h-4 w-4" /> Details & Pricing
              </TabsTrigger>
              {formData.type === "vehicle" && (
                <TabsTrigger value="vehicle">
                  <Car className="mr-1.5 h-4 w-4" /> Vehicle Specs
                </TabsTrigger>
              )}
              <TabsTrigger value="attributes">
                <Tag className="mr-1.5 h-4 w-4" /> Attributes & Images
              </TabsTrigger>
              <TabsTrigger value="seo">
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                SEO
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Item Information</CardTitle>
                  <CardDescription>Enter the basic details about this inventory item</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="title">Item Title <span className="text-destructive">*</span></Label>
                      <Input
                        id="title"
                        name="title"
                        placeholder="e.g. 2023 Toyota Camry XSE"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU / Stock Number</Label>
                      <Input
                        id="sku"
                        name="sku"
                        placeholder="e.g. INV-001"
                        value={formData.sku}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="category_id">Category <span className="text-destructive">*</span></Label>
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
                      <Label htmlFor="type">Item Type <span className="text-destructive">*</span></Label>
                      <SelectInput
                        id="type"
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        options={ITEM_TYPE_OPTIONS}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <SelectInput
                        id="status"
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        options={STATUS_OPTIONS}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="short_description">Short Description <span className="text-destructive">*</span></Label>
                    <RichTextEditor
                      value={formData.short_description}
                      onChange={handleShortDescriptionChange}
                      placeholder="Brief summary of the item"
                      className="min-h-[120px]"
                    />
                    <p className="text-sm text-muted-foreground">A short description displayed in list views.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Full Description</Label>
                    <RichTextEditor
                      value={formData.content}
                      onChange={handleContentChange}
                      placeholder="Detailed description of the item"
                      className="min-h-[200px]"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 pt-4">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Pricing & Stock</CardTitle>
                  <CardDescription>Set pricing, stock levels, and visibility</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="price">Price</Label>
                      <Input
                        id="price"
                        name="price"
                        type="number"
                        placeholder="e.g. 25000.00"
                        value={formData.price}
                        onChange={handleInputChange}
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <SelectInput
                        id="currency"
                        name="currency"
                        value={formData.currency}
                        onChange={handleInputChange}
                        options={CURRENCY_OPTIONS}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <SelectInput
                        id="status"
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        options={STATUS_OPTIONS}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity / Stock</Label>
                      <Input
                        id="quantity"
                        name="quantity"
                        type="number"
                        placeholder="e.g. 1"
                        value={formData.quantity}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reorder_threshold">Reorder Threshold</Label>
                      <Input
                        id="reorder_threshold"
                        name="reorder_threshold"
                        type="number"
                        placeholder="e.g. 5"
                        value={formData.reorder_threshold}
                        onChange={handleInputChange}
                      />
                      <p className="text-xs text-muted-foreground">Alert when stock falls to this level.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Thumbnail</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg border border-border/40 bg-muted/20">
                      <div className="w-24 h-24 rounded-lg border border-dashed border-border flex items-center justify-center bg-background overflow-hidden flex-shrink-0">
                        {previewUrl ? (
                          <Image src={previewUrl} alt="Preview" width={96} height={96} className="w-full h-full object-cover" />
                        ) : (
                          <ImagePlus className="w-8 h-8 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-grow space-y-2 w-full">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                          <UploadCloud className="mr-1.5 h-4 w-4" />
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
                          <p className="text-xs text-muted-foreground truncate">Selected: {thumbnailFile.name}</p>
                        )}
                        <div className="relative flex items-center">
                          <span className="flex-shrink px-2 text-xs text-muted-foreground">OR</span>
                          <div className="flex-grow border-t border-border/40"></div>
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
                      {(thumbnailFile || formData.thumbnail) && !isUploading && (
                        <Button type="button" variant="ghost" size="icon" onClick={clearThumbnail} title="Clear Thumbnail" className="self-start sm:self-center text-muted-foreground hover:text-destructive">
                          <XIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Upload an image (max 5MB) or provide a URL.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thumbnail_alt">Thumbnail Alt Text</Label>
                    <Input
                      id="thumbnail_alt"
                      name="thumbnail_alt"
                      placeholder="Describe the image for accessibility"
                      value={formData.thumbnail_alt}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      name="tags"
                      placeholder="e.g. sedan, automatic, low-mileage"
                      value={formData.tags}
                      onChange={handleInputChange}
                    />
                    <p className="text-sm text-muted-foreground">Comma-separated list of tags.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="active"
                        checked={formData.active}
                        onCheckedChange={(checked) => handleInputChange({ target: { name: "active", type: "checkbox", checked } })}
                      />
                      <Label htmlFor="active">Active</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="featured"
                        checked={formData.featured}
                        onCheckedChange={(checked) => handleInputChange({ target: { name: "featured", type: "checkbox", checked } })}
                      />
                      <Label htmlFor="featured">Featured</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="price_visible"
                        checked={formData.price_visible}
                        onCheckedChange={(checked) => handleInputChange({ target: { name: "price_visible", type: "checkbox", checked } })}
                      />
                      <Label htmlFor="price_visible">Show Price</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {formData.type === "vehicle" && (
              <TabsContent value="vehicle" className="space-y-4 pt-4">
                <Card className="border-border/60 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Vehicle Specifications</CardTitle>
                    <CardDescription>Enter vehicle-specific details. These will be displayed in the vehicle detail page.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {VEHICLE_ATTRIBUTE_FIELDS.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={`vehicle_${field.key}`}>{field.label}</Label>
                          {field.type === "select" ? (
                            <SelectInput
                              id={`vehicle_${field.key}`}
                              name={`vehicle_${field.key}`}
                              value={formData[`vehicle_${field.key}`] || ""}
                              onChange={handleInputChange}
                              options={field.options}
                              placeholder={`Select ${field.label}`}
                            />
                          ) : (
                            <Input
                              id={`vehicle_${field.key}`}
                              name={`vehicle_${field.key}`}
                              type={field.type}
                              placeholder={field.placeholder}
                              value={formData[`vehicle_${field.key}`]}
                              onChange={handleInputChange}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="attributes" className="space-y-4 pt-4">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Custom Attributes</CardTitle>
                  <CardDescription>Add flexible key-value attributes for this item. These can be used for any item type.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customAttributes.map((attr, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-lg border border-border/40 hover:border-border/60 transition-colors">
                      <Input
                        placeholder="Key (e.g. warranty)"
                        value={attr.key}
                        onChange={(e) => handleCustomAttributeChange(index, "key", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Value (e.g. 2 years)"
                        value={attr.value}
                        onChange={(e) => handleCustomAttributeChange(index, "value", e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCustomAttribute(index)}
                        title="Remove attribute"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={handleAddCustomAttribute}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Attribute
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Image Gallery</CardTitle>
                  <CardDescription>Upload images or paste image URLs for this item</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {images.map((img, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-lg border border-border/40 hover:border-border/60 transition-colors">
                      <div className="w-12 h-12 rounded-md border border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden flex-shrink-0">
                        {img.url ? (
                          <img src={img.url} alt={img.alt || "Gallery"} className="w-full h-full object-cover" />
                        ) : (
                          <ImagePlus className="w-5 h-5 text-muted-foreground/50" />
                        )}
                      </div>
                      <Input
                        placeholder="Image URL"
                        value={img.url}
                        onChange={(e) => handleImageChange(index, "url", e.target.value)}
                        className="flex-1"
                        disabled={img.uploading || isBatchUploading}
                      />
                      <Input
                        placeholder="Alt text (optional)"
                        value={img.alt}
                        onChange={(e) => handleImageChange(index, "alt", e.target.value)}
                        className="flex-1"
                        disabled={isBatchUploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={img.uploading || isBatchUploading}
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*";
                          input.onchange = (e) => {
                            if (e.target.files[0]) handleImageUpload(index, e.target.files[0]);
                          };
                          input.click();
                        }}
                        title="Upload image"
                      >
                        {img.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveImage(index)}
                        disabled={isBatchUploading}
                        title="Remove image"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleAddImage} disabled={isBatchUploading}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Image
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => galleryFileInputRef.current?.click()}
                      disabled={isBatchUploading}
                    >
                      {isBatchUploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-1.5" />}
                      Upload Multiple
                    </Button>
                    <input
                      type="file"
                      ref={galleryFileInputRef}
                      accept="image/*"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          handleBatchImageUpload(Array.from(e.target.files));
                        }
                        e.target.value = "";
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Video Gallery</CardTitle>
                  <CardDescription>Add video URLs for this item (YouTube, Vimeo, or direct links)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {videos.map((vid, index) => (
                    <div key={`vid-${index}`} className="flex items-center gap-2 p-2 rounded-lg border border-border/40 hover:border-border/60 transition-colors">
                      <Input
                        placeholder="Video URL (e.g. https://youtube.com/watch?v=...)"
                        value={vid.url}
                        onChange={(e) => handleVideoChange(index, "url", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Title (optional)"
                        value={vid.title}
                        onChange={(e) => handleVideoChange(index, "title", e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveVideo(index)}
                        title="Remove video"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={handleAddVideo}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Video
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 pt-4">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">SEO Information</CardTitle>
                  <CardDescription>Optimize this item page for search engines</CardDescription>
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
                    />
                    <p className="text-sm text-muted-foreground">SEO optimized title for search engines</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seo_description">Meta Description</Label>
                    <Textarea
                      id="seo_description"
                      name="seo_description"
                      placeholder="Brief description for search engines"
                      value={formData.seo_description}
                      onChange={handleInputChange}
                    />
                    <p className="text-sm text-muted-foreground">Short description for search engines (max 160 characters)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seo_keywords">Keywords</Label>
                    <Input
                      id="seo_keywords"
                      name="seo_keywords"
                      placeholder="e.g. used toyota camry 2023"
                      value={formData.seo_keywords}
                      onChange={handleInputChange}
                    />
                    <p className="text-sm text-muted-foreground">Comma-separated keywords related to this item</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      name="slug"
                      placeholder="e.g. 2023-toyota-camry-xse"
                      value={formData.slug}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">Unique identifier for the item URL</p>
                  </div>

                  <div className="border-t border-border/40 pt-4 space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open Graph</h4>
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

                  <div className="border-t border-border/40 pt-4 space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Twitter Cards</h4>
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

                  <div className="border-t border-border/40 pt-4 space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Advanced SEO</h4>
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
                      <p className="text-sm text-muted-foreground">Auto-generated from client domain + slug if left empty</p>
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
                          placeholder="Product"
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
                      <p className="text-sm text-muted-foreground">Comma-separated target keywords for SEO scoring.</p>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-4 space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Call to Action</h4>
                    <div className="space-y-2">
                      <Label htmlFor="cta_heading">CTA Heading</Label>
                      <Input
                        id="cta_heading"
                        name="cta_heading"
                        placeholder="e.g. Contact us for more info"
                        value={formData.cta_heading}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cta_body">CTA Body</Label>
                      <Textarea
                        id="cta_body"
                        name="cta_body"
                        placeholder="Body text for the call to action"
                        value={formData.cta_body}
                        onChange={handleInputChange}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cta_button_text">CTA Button Text</Label>
                        <Input
                          id="cta_button_text"
                          name="cta_button_text"
                          placeholder="e.g. Get Quote"
                          value={formData.cta_button_text}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cta_button_url">CTA Button URL</Label>
                        <Input
                          id="cta_button_url"
                          name="cta_button_url"
                          placeholder="https://example.com/contact"
                          value={formData.cta_button_url}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-4 space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Social Sharing</h4>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="allow_social_share"
                        name="allow_social_share"
                        checked={formData.allow_social_share}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, allow_social_share: checked }))
                        }
                      />
                      <Label htmlFor="allow_social_share">Allow Social Sharing</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border/40">
            <Button type="button" variant="ghost" onClick={() => router.push("/admin/inventory")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {saveIcon}
              <span className="ml-2">{saveLabel}</span>
            </Button>
          </div>
        </form>
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
        message="Inventory item added successfully!"
        actionLabel="OK"
      />
    </div>
  );
}
