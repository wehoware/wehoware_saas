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
  Save,
  ImagePlus,
  FileText,
  Tag,
  Loader2,
  UploadCloud,
  X as XIcon,
  Eye,
  ArrowLeft,
  Plus,
  Trash2,
  Car,
  ArrowDownUp,
  TrendingUp,
  TrendingDown,
  History,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";

import slugify from "slugify";
import { uploadThumbnail, deleteThumbnailByUrl } from "@/lib/storageUtils";
import { toast } from "react-hot-toast";
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

const MOVEMENT_TYPE_OPTIONS = [
  { value: "restock", label: "Restock (In)" },
  { value: "sale", label: "Sale (Out)" },
  { value: "adjustment", label: "Adjustment" },
  { value: "return", label: "Return (In)" },
  { value: "damage", label: "Damage/Loss (Out)" },
  { value: "transfer", label: "Transfer" },
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
  { key: "condition", label: "Condition", type: "text", placeholder: "e.g. New, Used, Certified" },
];

async function resolveThumbnailUrl(thumbnailFile, formData, originalThumbnailUrl) {
  if (thumbnailFile) {
    if (originalThumbnailUrl) await deleteThumbnailByUrl(originalThumbnailUrl);
    return await uploadThumbnail(thumbnailFile, "inventory");
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

export default function EditInventoryPage({ params }) {
  const router = useRouter();
  const { activeClient } = useAuth();
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

  const [customAttributes, setCustomAttributes] = useState([{ key: "", value: "" }]);
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);

  const [stockMovements, setStockMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [activeStockTab, setActiveStockTab] = useState(false);
  const [movementForm, setMovementForm] = useState({
    movement_type: "restock",
    quantity: "1",
    reason: "",
  });
  const [savingMovement, setSavingMovement] = useState(false);

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
  });

  const categoryOptions = useMemo(() => {
    return categories.map((cat) => ({ value: cat.id, label: cat.name }));
  }, [categories]);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        setIsFetching(true);
        const res = await fetch(`/api/v1/inventory/${id}`);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Item not found");
        const json = await res.json();
        const data = json.item;
        if (!data) throw new Error("Item not found");

        const initialThumbnailUrl = data.thumbnail || "";
        const attrs = data.attributes || {};
        const vehicleAttrs = {};
        if (data.type === "vehicle") {
          VEHICLE_ATTRIBUTE_FIELDS.forEach((field) => {
            vehicleAttrs[`vehicle_${field.key}`] = attrs[field.key] || "";
          });
        }

        const nonVehicleAttrs = Object.keys(attrs)
          .filter((key) => !VEHICLE_ATTRIBUTE_FIELDS.some((f) => f.key === key))
          .map((key) => ({ key, value: String(attrs[key]) }));

        setFormData({
          title: data.title || "",
          slug: data.slug || "",
          category_id: data.category_id || "",
          type: data.type || "product",
          sku: data.sku || "",
          short_description: data.description || "",
          content: data.content || "",
          thumbnail: initialThumbnailUrl,
          thumbnail_alt: data.thumbnail_alt || "",
          price: data.price != null ? String(data.price) : "",
          currency: data.currency || "CAD",
          quantity: data.quantity != null ? String(data.quantity) : "0",
          reorder_threshold: data.reorder_threshold != null ? String(data.reorder_threshold) : "0",
          status: data.status || "draft",
          tags: Array.isArray(data.tags) ? data.tags.join(", ") : "",
          featured: data.featured === true,
          active: data.active === true,
          price_visible: data.price_visible !== false,
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
          schema_type: data.schema_type || "Product",
          target_keywords: Array.isArray(data.target_keywords) ? data.target_keywords.join(", ") : (data.target_keywords || ""),
          cta_heading: data.cta_heading || "",
          cta_body: data.cta_body || "",
          cta_button_text: data.cta_button_text || "",
          cta_button_url: data.cta_button_url || "",
          allow_social_share: data.allow_social_share !== false,
          slug_locked: true,
          ...vehicleAttrs,
        });
        setOriginalThumbnailUrl(initialThumbnailUrl);
        setPreviewUrl(initialThumbnailUrl);
        setCustomAttributes(nonVehicleAttrs.length > 0 ? nonVehicleAttrs : [{ key: "", value: "" }]);
        setImages((data.images || []).map((img) => ({ url: img.url, alt: img.alt || "" })));
        setVideos((data.videos || []).map((vid) => ({ url: vid.url, title: vid.title || "" })));
      } catch (error) {
        console.error("Error fetching inventory item:", error);
        setErrorDialogOpen(true);
        setErrorMessage(error.message || "Failed to fetch item");
        setTimeout(() => router.push("/admin/inventory"), 100);
      } finally {
        setIsFetching(false);
      }
    };

    fetchItem();
  }, [id, activeClient?.id, router]);

  useEffect(() => {
    const fetchCategories = async () => {
      if (!activeClient?.id) {
        setCategories([]);
        return;
      }
      try {
        const res = await fetch("/api/v1/inventory/categories");
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch categories");
        const json = await res.json();
        setCategories(json.data || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchCategories();
  }, [activeClient]);

  useEffect(() => {
    if (!activeStockTab || !id) return;
    const fetchMovements = async () => {
      setMovementsLoading(true);
      try {
        const res = await fetch(`/api/v1/inventory/${id}/stock-movements`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || `Failed to fetch stock movements (${res.status})`);
        }
        const json = await res.json();
        setStockMovements(json.movements || []);
      } catch (err) {
        console.error("Error fetching stock movements:", err);
        toast.error(err.message || "Failed to fetch stock movements");
      } finally {
        setMovementsLoading(false);
      }
    };
    fetchMovements();
  }, [activeStockTab, id]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const updatedValue = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: updatedValue }));
  };

  const handleContentChange = (html) => {
    setFormData((prev) => ({ ...prev, content: html }));
  };

  const handleShortDescriptionChange = (html) => {
    setFormData((prev) => ({ ...prev, short_description: html }));
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
    reader.onloadend = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(file);
    setFormData((prev) => ({ ...prev, thumbnail: "" }));
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

  const handleAddImage = () => {
    setImages((prev) => [...prev, { url: "", alt: "" }]);
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

    if (!formData.title || !formData.category_id) {
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
        slug: formData.slug || slugify(formData.title, { lower: true, strict: true }),
        type: formData.type,
        sku: formData.sku || null,
        description: formData.short_description,
        content: formData.content || null,
        thumbnail: thumbnailUrlToSave,
        thumbnail_alt: formData.thumbnail_alt || null,
        price: formData.price === "" ? null : parseFloat(formData.price),
        currency: formData.currency || "CAD",
        price_visible: formData.price_visible,
        quantity: formData.quantity === "" ? 0 : parseInt(formData.quantity, 10),
        reorder_threshold: formData.reorder_threshold === "" ? 0 : parseInt(formData.reorder_threshold, 10),
        status: formData.status,
        tags: formData.tags ? formData.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
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
      };

      toast.loading("Saving item...");
      const res = await fetch(`/api/v1/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      toast.dismiss();
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to update item");

      setSuccessDialogOpen(true);
      setOriginalThumbnailUrl(thumbnailUrlToSave);
      setThumbnailFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast.dismiss();
      console.error("Error during item update:", error);
      setErrorMessage(error.message || "Failed to update item");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  const handleStockMovementSubmit = async (e) => {
    e.preventDefault();
    if (!movementForm.quantity || movementForm.quantity === "0") {
      toast.error("Quantity is required");
      return;
    }
    setSavingMovement(true);
    try {
      const res = await fetch(`/api/v1/inventory/${id}/stock-movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movement_type: movementForm.movement_type,
          quantity: parseInt(movementForm.quantity, 10),
          reason: movementForm.reason || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to record stock movement");
      const json = await res.json();
      setStockMovements((prev) => [json.movement, ...prev].filter(Boolean));
      if (json.item) {
        setFormData((prev) => ({ ...prev, quantity: String(json.item.quantity) }));
      }
      setMovementForm({ movement_type: "restock", quantity: "1", reason: "" });
      toast.success("Stock movement recorded");
    } catch (err) {
      toast.error(err.message || "Failed to record stock movement");
    } finally {
      setSavingMovement(false);
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
  const saveIcon = isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />;

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title="Edit Inventory Item"
        backLink="/admin/inventory"
        backIcon={<ArrowLeft size={16} />}
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
                <Tag className="mr-2 h-4 w-4" /> Details & Pricing
              </TabsTrigger>
              {formData.type === "vehicle" && (
                <TabsTrigger value="vehicle">
                  <Car className="mr-2 h-4 w-4" /> Vehicle Specs
                </TabsTrigger>
              )}
              <TabsTrigger value="attributes">
                <Tag className="mr-2 h-4 w-4" /> Attributes & Images
              </TabsTrigger>
              <TabsTrigger value="seo">
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                SEO
              </TabsTrigger>
              <TabsTrigger value="stock" onClick={() => setActiveStockTab(true)}>
                <ArrowDownUp className="mr-2 h-4 w-4" /> Stock
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Core Information</CardTitle>
                  <CardDescription>Essential details about this item. Fields marked with * are required.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input id="title" name="title" placeholder="Item Title" value={formData.title} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU / Stock Number</Label>
                      <Input id="sku" name="sku" placeholder="e.g. INV-001" value={formData.sku} onChange={handleInputChange} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category_id">Category *</Label>
                      <SelectInput id="category_id" name="category_id" options={categoryOptions} value={formData.category_id} onChange={handleInputChange} placeholder="Select a category" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Item Type</Label>
                      <SelectInput id="type" name="type" value={formData.type} onChange={handleInputChange} options={ITEM_TYPE_OPTIONS} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <SelectInput id="status" name="status" value={formData.status} onChange={handleInputChange} options={STATUS_OPTIONS} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="short_description">Short Description</Label>
                    <RichTextEditor value={formData.short_description} onChange={handleShortDescriptionChange} placeholder="A brief summary of the item" className="min-h-[120px]" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Full Description</Label>
                    <RichTextEditor value={formData.content} onChange={handleContentChange} placeholder="Detailed description of the item" className="min-h-[200px]" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pricing & Stock</CardTitle>
                  <CardDescription>Set pricing, stock levels, and visibility</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Price</Label>
                      <Input id="price" name="price" type="number" placeholder="e.g. 25000.00" value={formData.price} onChange={handleInputChange} step="0.01" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <SelectInput id="currency" name="currency" value={formData.currency} onChange={handleInputChange} options={CURRENCY_OPTIONS} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <SelectInput id="status" name="status" value={formData.status} onChange={handleInputChange} options={STATUS_OPTIONS} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity / Stock</Label>
                      <Input id="quantity" name="quantity" type="number" placeholder="e.g. 1" value={formData.quantity} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reorder_threshold">Reorder Threshold</Label>
                      <Input id="reorder_threshold" name="reorder_threshold" type="number" placeholder="e.g. 5" value={formData.reorder_threshold} onChange={handleInputChange} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Thumbnail</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="w-24 h-24 rounded border border-dashed flex items-center justify-center bg-muted overflow-hidden flex-shrink-0">
                        {previewUrl ? (
                          <Image src={previewUrl} alt="Preview" width={96} height={96} className="w-full h-full object-cover" />
                        ) : (
                          <ImagePlus className="w-10 h-10 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-grow space-y-2 w-full">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                          <UploadCloud className="mr-2 h-4 w-4" />
                          {thumbnailFile ? "Change File" : "Upload File"}
                        </Button>
                        <Input ref={fileInputRef} id="thumbnail-file" type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={isUploading || isFetching} />
                        {thumbnailFile && (
                          <p className="text-xs text-muted-foreground truncate">Selected: {thumbnailFile.name}</p>
                        )}
                        <div className="relative flex items-center">
                          <span className="flex-shrink px-2 text-xs text-muted-foreground">OR</span>
                          <div className="flex-grow border-t border-muted"></div>
                        </div>
                        <Input id="thumbnail" name="thumbnail" type="url" placeholder="Enter Image URL" value={formData.thumbnail} onChange={handleInputChange} disabled={!!thumbnailFile || isUploading} />
                      </div>
                      {(thumbnailFile || formData.thumbnail) && !isUploading && (
                        <Button type="button" variant="ghost" size="icon" onClick={clearThumbnail} title="Clear Thumbnail" className="self-start sm:self-center">
                          <XIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thumbnail_alt">Thumbnail Alt Text</Label>
                    <Input id="thumbnail_alt" name="thumbnail_alt" placeholder="Describe the image for accessibility" value={formData.thumbnail_alt} onChange={handleInputChange} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input id="tags" name="tags" placeholder="e.g. sedan, automatic, low-mileage" value={formData.tags} onChange={handleInputChange} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="active" checked={formData.active} onCheckedChange={(checked) => handleInputChange({ target: { name: "active", type: "checkbox", checked } })} />
                      <Label htmlFor="active">Active</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="featured" checked={formData.featured} onCheckedChange={(checked) => handleInputChange({ target: { name: "featured", type: "checkbox", checked } })} />
                      <Label htmlFor="featured">Featured</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="price_visible" checked={formData.price_visible} onCheckedChange={(checked) => handleInputChange({ target: { name: "price_visible", type: "checkbox", checked } })} />
                      <Label htmlFor="price_visible">Show Price</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {formData.type === "vehicle" && (
              <TabsContent value="vehicle" className="space-y-4 pt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Vehicle Specifications</CardTitle>
                    <CardDescription>Vehicle-specific details displayed on the detail page.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {VEHICLE_ATTRIBUTE_FIELDS.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={`vehicle_${field.key}`}>{field.label}</Label>
                          <Input
                            id={`vehicle_${field.key}`}
                            name={`vehicle_${field.key}`}
                            type={field.type}
                            placeholder={field.placeholder}
                            value={formData[`vehicle_${field.key}`]}
                            onChange={handleInputChange}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="attributes" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Custom Attributes</CardTitle>
                  <CardDescription>Flexible key-value attributes for this item.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customAttributes.map((attr, index) => (
                    <div key={`attr-${index}`} className="flex items-center gap-2">
                      <Input placeholder="Key (e.g. warranty)" value={attr.key} onChange={(e) => handleCustomAttributeChange(index, "key", e.target.value)} className="flex-1" />
                      <Input placeholder="Value (e.g. 2 years)" value={attr.value} onChange={(e) => handleCustomAttributeChange(index, "value", e.target.value)} className="flex-1" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveCustomAttribute(index)} title="Remove">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={handleAddCustomAttribute}>
                    <Plus className="h-4 w-4 mr-2" /> Add Attribute
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Image Gallery</CardTitle>
                  <CardDescription>Upload images or paste image URLs for this item</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {images.map((img, index) => (
                    <div key={`img-${index}`} className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded border border-dashed flex items-center justify-center bg-muted overflow-hidden flex-shrink-0">
                        {img.url ? (
                          <img src={img.url} alt={img.alt || "Gallery"} className="w-full h-full object-cover" />
                        ) : (
                          <ImagePlus className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <Input placeholder="Image URL" value={img.url} onChange={(e) => handleImageChange(index, "url", e.target.value)} className="flex-1" disabled={img.uploading} />
                      <Input placeholder="Alt text (optional)" value={img.alt} onChange={(e) => handleImageChange(index, "alt", e.target.value)} className="flex-1" />
                      <Button type="button" variant="outline" size="icon" disabled={img.uploading} onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = (e) => {
                          if (e.target.files[0]) handleImageUpload(index, e.target.files[0]);
                        };
                        input.click();
                      }} title="Upload image">
                        {img.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveImage(index)} title="Remove">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={handleAddImage}>
                    <Plus className="h-4 w-4 mr-2" /> Add Image
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Video Gallery</CardTitle>
                  <CardDescription>Add video URLs for this item (YouTube, Vimeo, or direct links)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {videos.map((vid, index) => (
                    <div key={`vid-${index}`} className="flex items-center gap-2">
                      <Input placeholder="Video URL (e.g. https://youtube.com/watch?v=...)" value={vid.url} onChange={(e) => handleVideoChange(index, "url", e.target.value)} className="flex-1" />
                      <Input placeholder="Title (optional)" value={vid.title} onChange={(e) => handleVideoChange(index, "title", e.target.value)} className="flex-1" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveVideo(index)} title="Remove">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={handleAddVideo}>
                    <Plus className="h-4 w-4 mr-2" /> Add Video
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>SEO Information</CardTitle>
                  <CardDescription>Optimize this item page for search engines</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="seo_title">Meta Title</Label>
                    <Input id="seo_title" name="seo_title" placeholder="Title for search engines" value={formData.seo_title} onChange={handleInputChange} />
                    <p className="text-sm text-muted-foreground">SEO optimized title for search engines</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seo_description">Meta Description</Label>
                    <Textarea id="seo_description" name="seo_description" placeholder="Brief description for search engines" value={formData.seo_description} onChange={handleInputChange} />
                    <p className="text-sm text-muted-foreground">Short description for search engines (max 160 characters)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seo_keywords">Keywords</Label>
                    <Input id="seo_keywords" name="seo_keywords" placeholder="e.g. used toyota camry 2023" value={formData.seo_keywords} onChange={handleInputChange} />
                    <p className="text-sm text-muted-foreground">Comma-separated keywords related to this item</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input id="slug" name="slug" placeholder="e.g. 2023-toyota-camry-xse" value={formData.slug} onChange={handleInputChange} required />
                    <p className="text-sm text-muted-foreground">Unique identifier for the item URL</p>
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h4 className="text-sm font-semibold">Open Graph</h4>
                    <div className="space-y-2">
                      <Label htmlFor="open_graph_title">OG Title</Label>
                      <Input id="open_graph_title" name="open_graph_title" placeholder="Title for social sharing" value={formData.open_graph_title} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="open_graph_description">OG Description</Label>
                      <Textarea id="open_graph_description" name="open_graph_description" placeholder="Description for social sharing" value={formData.open_graph_description} onChange={handleInputChange} rows={2} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="open_graph_image">OG Image URL</Label>
                      <Input id="open_graph_image" name="open_graph_image" type="url" placeholder="https://example.com/image.jpg" value={formData.open_graph_image} onChange={handleInputChange} />
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h4 className="text-sm font-semibold">Twitter Cards</h4>
                    <div className="space-y-2">
                      <Label htmlFor="twitter_title">Twitter Title</Label>
                      <Input id="twitter_title" name="twitter_title" placeholder="Title for Twitter" value={formData.twitter_title} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="twitter_description">Twitter Description</Label>
                      <Textarea id="twitter_description" name="twitter_description" placeholder="Description for Twitter" value={formData.twitter_description} onChange={handleInputChange} rows={2} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="twitter_image">Twitter Image URL</Label>
                      <Input id="twitter_image" name="twitter_image" type="url" placeholder="https://example.com/image.jpg" value={formData.twitter_image} onChange={handleInputChange} />
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h4 className="text-sm font-semibold">Advanced SEO</h4>
                    <div className="space-y-2">
                      <Label htmlFor="canonical_url">Canonical URL</Label>
                      <Input id="canonical_url" name="canonical_url" type="url" placeholder="https://example.com/canonical-page" value={formData.canonical_url} onChange={handleInputChange} />
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
                        <Input id="schema_type" name="schema_type" placeholder="Product" value={formData.schema_type} onChange={handleInputChange} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="target_keywords">Target Keywords</Label>
                      <Input id="target_keywords" name="target_keywords" placeholder="e.g. keyword1, keyword2" value={formData.target_keywords} onChange={handleInputChange} />
                      <p className="text-sm text-muted-foreground">Comma-separated target keywords for SEO scoring.</p>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h4 className="text-sm font-semibold">Call to Action</h4>
                    <div className="space-y-2">
                      <Label htmlFor="cta_heading">CTA Heading</Label>
                      <Input id="cta_heading" name="cta_heading" placeholder="e.g. Contact us for more info" value={formData.cta_heading} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cta_body">CTA Body</Label>
                      <Textarea id="cta_body" name="cta_body" placeholder="Body text for the call to action" value={formData.cta_body} onChange={handleInputChange} rows={2} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cta_button_text">CTA Button Text</Label>
                        <Input id="cta_button_text" name="cta_button_text" placeholder="e.g. Get Quote" value={formData.cta_button_text} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cta_button_url">CTA Button URL</Label>
                        <Input id="cta_button_url" name="cta_button_url" placeholder="https://example.com/contact" value={formData.cta_button_url} onChange={handleInputChange} />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h4 className="text-sm font-semibold">Social Sharing</h4>
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

            <TabsContent value="stock" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Current Stock</CardTitle>
                  <CardDescription>Current quantity: {formData.quantity}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">Current Quantity</div>
                      <div className="text-2xl font-bold">{formData.quantity}</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">Reorder Threshold</div>
                      <div className="text-2xl font-bold">{formData.reorder_threshold}</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">Status</div>
                      <div className="text-2xl font-bold">{formData.status}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Record Stock Movement</CardTitle>
                  <CardDescription>Add a new stock movement to adjust quantity</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleStockMovementSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="movement_type">Movement Type</Label>
                        <SelectInput
                          id="movement_type"
                          name="movement_type"
                          value={movementForm.movement_type}
                          onChange={(e) => setMovementForm((prev) => ({ ...prev, movement_type: e.target.value }))}
                          options={MOVEMENT_TYPE_OPTIONS}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="movement_qty">Quantity</Label>
                        <Input
                          id="movement_qty"
                          type="number"
                          placeholder="e.g. 10"
                          value={movementForm.quantity}
                          onChange={(e) => setMovementForm((prev) => ({ ...prev, quantity: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="movement_reason">Reason / Note</Label>
                        <Input
                          id="movement_reason"
                          placeholder="e.g. Restocked from supplier"
                          value={movementForm.reason}
                          onChange={(e) => setMovementForm((prev) => ({ ...prev, reason: e.target.value }))}
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={savingMovement}>
                      {savingMovement ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownUp className="h-4 w-4 mr-2" />}
                      Record Movement
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Stock Movement History</CardTitle>
                  <CardDescription>Audit trail of all stock changes</CardDescription>
                </CardHeader>
                <CardContent>
                  {movementsLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : stockMovements.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No stock movements recorded yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-auto rounded-md border">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
                            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Qty Change</th>
                            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Reason</th>
                            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockMovements.map((m) => (
                            <tr key={m.id} className="border-b last:border-0">
                              <td className="p-3 text-sm">{m.created_at ? new Date(m.created_at).toLocaleString() : "-"}</td>
                              <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  m.movement_type === "restock" || m.movement_type === "return"
                                    ? "bg-green-50 text-green-700"
                                    : m.movement_type === "sale" || m.movement_type === "damage"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-yellow-50 text-yellow-700"
                                }`}>
                                  {m.movement_type === "restock" || m.movement_type === "return" ? (
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                  ) : m.movement_type === "sale" || m.movement_type === "damage" ? (
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                  ) : null}
                                  {m.movement_type}
                                </span>
                              </td>
                              <td className="p-3 text-sm font-medium">
                                {m.quantity_change > 0 ? "+" : ""}{m.quantity_change}
                                <span className="text-muted-foreground ml-1">(→ {m.quantity_after})</span>
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">{m.reason || "-"}</td>
                              <td className="p-3 text-sm text-muted-foreground">{m.user?.name || m.created_by || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => router.push("/admin/inventory")}>
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
        message="Inventory item updated successfully!"
        actionLabel="OK"
      />
    </div>
  );
}
