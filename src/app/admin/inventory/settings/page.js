"use client";

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Save,
  Loader2,
  Settings as SettingsIcon,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import AlertComponent from "@/components/ui/alert-component";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "react-hot-toast";
import SelectInput from "@/components/ui/select";

const CURRENCY_OPTIONS = [
  { value: "CAD", label: "CAD" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "INR", label: "INR" },
];

const DEFAULT_ITEM_TYPE_OPTIONS = [
  { value: "vehicle", label: "Vehicle" },
  { value: "furniture", label: "Furniture" },
  { value: "food", label: "Food" },
  { value: "menu", label: "Menu" },
  { value: "product", label: "Product" },
  { value: "digital", label: "Digital" },
  { value: "custom", label: "Custom" },
];

export default function InventorySettingsPage() {
  const router = useRouter();
  const { activeClient } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    default_currency: "CAD",
    low_stock_threshold: "5",
    auto_archive_days: "90",
    enable_stock_tracking: true,
    enable_low_stock_alerts: true,
    enable_public_listing: true,
    enable_inquiries: true,
    enable_test_drive: false,
    default_item_type: "product",
    listing_page_title: "Our Inventory",
    listing_page_description: "",
    contact_email: "",
    contact_phone: "",
    business_hours: "",
    address: "",
    social_facebook: "",
    social_instagram: "",
    social_twitter: "",
    social_youtube: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!activeClient?.id) {
        setIsFetching(false);
        return;
      }
      try {
        setIsFetching(true);
        const res = await fetch("/api/v1/inventory/settings");
        if (!res.ok) {
          if (res.status === 404) return;
          throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch settings");
        }
        const json = await res.json();
        const data = json.settings || {};
        setFormData({
          default_currency: data.default_currency || "CAD",
          low_stock_threshold: data.low_stock_threshold != null ? String(data.low_stock_threshold) : "5",
          auto_archive_days: data.auto_archive_days != null ? String(data.auto_archive_days) : "90",
          enable_stock_tracking: data.enable_stock_tracking !== false,
          enable_low_stock_alerts: data.enable_low_stock_alerts !== false,
          enable_public_listing: data.enable_public_listing !== false,
          enable_inquiries: data.enable_inquiries !== false,
          enable_test_drive: data.enable_test_drive === true,
          default_item_type: data.default_item_type || "product",
          listing_page_title: data.listing_page_title || "Our Inventory",
          listing_page_description: data.listing_page_description || "",
          contact_email: data.contact_email || "",
          contact_phone: data.contact_phone || "",
          business_hours: data.business_hours || "",
          address: data.address || "",
          social_facebook: data.social_facebook || "",
          social_instagram: data.social_instagram || "",
          social_twitter: data.social_twitter || "",
          social_youtube: data.social_youtube || "",
          seo_title: data.seo_title || "",
          seo_description: data.seo_description || "",
          seo_keywords: data.seo_keywords || "",
        });
      } catch (error) {
        console.error("Error fetching inventory settings:", error);
        setErrorMessage(error.message || "Failed to fetch settings");
        setErrorDialogOpen(true);
      } finally {
        setIsFetching(false);
      }
    };

    fetchSettings();
  }, [activeClient]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const processedValue = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: processedValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!activeClient?.id) {
      setErrorMessage("No active client selected. Cannot save settings.");
      setErrorDialogOpen(true);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/v1/inventory/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_currency: formData.default_currency,
          low_stock_threshold: parseInt(formData.low_stock_threshold, 10) || 5,
          auto_archive_days: parseInt(formData.auto_archive_days, 10) || 90,
          enable_stock_tracking: formData.enable_stock_tracking,
          enable_low_stock_alerts: formData.enable_low_stock_alerts,
          enable_public_listing: formData.enable_public_listing,
          enable_inquiries: formData.enable_inquiries,
          enable_test_drive: formData.enable_test_drive,
          default_item_type: formData.default_item_type,
          listing_page_title: formData.listing_page_title || null,
          listing_page_description: formData.listing_page_description || null,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          business_hours: formData.business_hours || null,
          address: formData.address || null,
          social_facebook: formData.social_facebook || null,
          social_instagram: formData.social_instagram || null,
          social_twitter: formData.social_twitter || null,
          social_youtube: formData.social_youtube || null,
          seo_title: formData.seo_title || null,
          seo_description: formData.seo_description || null,
          seo_keywords: formData.seo_keywords || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to save settings");
      toast.success("Inventory settings saved successfully!");
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error saving inventory settings:", error);
      setErrorMessage(error.message || "Failed to save settings");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
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
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Inventory Settings"
          description="Configure your inventory module"
          backLink="/admin/inventory"
          backIcon={<ArrowLeft size={16} />}
          actionLabel={isLoading ? "Saving..." : "Save Settings"}
          actionIcon={isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          onAction={handleSubmit}
          actionDisabled={isLoading}
        />

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Default configuration for inventory items</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="default_currency">Default Currency</Label>
                    <SelectInput
                      id="default_currency"
                      name="default_currency"
                      value={formData.default_currency}
                      onChange={handleInputChange}
                      options={CURRENCY_OPTIONS}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_item_type">Default Item Type</Label>
                    <SelectInput
                      id="default_item_type"
                      name="default_item_type"
                      value={formData.default_item_type}
                      onChange={handleInputChange}
                      options={DEFAULT_ITEM_TYPE_OPTIONS}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
                    <Input
                      id="low_stock_threshold"
                      name="low_stock_threshold"
                      type="number"
                      placeholder="e.g. 5"
                      value={formData.low_stock_threshold}
                      onChange={handleInputChange}
                    />
                    <p className="text-xs text-muted-foreground">Alert when stock falls to this level.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto_archive_days">Auto-Archive After (Days)</Label>
                  <Input
                    id="auto_archive_days"
                    name="auto_archive_days"
                    type="number"
                    placeholder="e.g. 90"
                    value={formData.auto_archive_days}
                    onChange={handleInputChange}
                  />
                  <p className="text-xs text-muted-foreground">Automatically archive items sold/inactive for this many days. Set to 0 to disable.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable_stock_tracking"
                      checked={formData.enable_stock_tracking}
                      onCheckedChange={(checked) => handleInputChange({ target: { name: "enable_stock_tracking", type: "checkbox", checked } })}
                    />
                    <Label htmlFor="enable_stock_tracking">Enable Stock Tracking</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable_low_stock_alerts"
                      checked={formData.enable_low_stock_alerts}
                      onCheckedChange={(checked) => handleInputChange({ target: { name: "enable_low_stock_alerts", type: "checkbox", checked } })}
                    />
                    <Label htmlFor="enable_low_stock_alerts">Enable Low Stock Alerts</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable_public_listing"
                      checked={formData.enable_public_listing}
                      onCheckedChange={(checked) => handleInputChange({ target: { name: "enable_public_listing", type: "checkbox", checked } })}
                    />
                    <Label htmlFor="enable_public_listing">Enable Public Listing Page</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable_inquiries"
                      checked={formData.enable_inquiries}
                      onCheckedChange={(checked) => handleInputChange({ target: { name: "enable_inquiries", type: "checkbox", checked } })}
                    />
                    <Label htmlFor="enable_inquiries">Enable Inquiries</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable_test_drive"
                      checked={formData.enable_test_drive}
                      onCheckedChange={(checked) => handleInputChange({ target: { name: "enable_test_drive", type: "checkbox", checked } })}
                    />
                    <Label htmlFor="enable_test_drive">Enable Test Drive Booking (Vehicles)</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Public Listing Page</CardTitle>
                <CardDescription>Configure the public-facing inventory listing page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="listing_page_title">Listing Page Title</Label>
                  <Input
                    id="listing_page_title"
                    name="listing_page_title"
                    placeholder="e.g. Our Inventory"
                    value={formData.listing_page_title}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="listing_page_description">Listing Page Description</Label>
                  <Textarea
                    id="listing_page_description"
                    name="listing_page_description"
                    placeholder="Brief description shown on the listing page"
                    value={formData.listing_page_description}
                    onChange={handleInputChange}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Displayed on item detail pages and inquiry forms</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_email">Contact Email</Label>
                    <Input
                      id="contact_email"
                      name="contact_email"
                      type="email"
                      placeholder="e.g. sales@example.com"
                      value={formData.contact_email}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Contact Phone</Label>
                    <Input
                      id="contact_phone"
                      name="contact_phone"
                      placeholder="e.g. +1 555-123-4567"
                      value={formData.contact_phone}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business_hours">Business Hours</Label>
                  <Input
                    id="business_hours"
                    name="business_hours"
                    placeholder="e.g. Mon-Fri 9AM-6PM, Sat 10AM-4PM"
                    value={formData.business_hours}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    name="address"
                    placeholder="Business address shown on listing pages"
                    value={formData.address}
                    onChange={handleInputChange}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Social Media Links</CardTitle>
                <CardDescription>Social profiles displayed on the inventory pages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="social_facebook">Facebook URL</Label>
                    <Input
                      id="social_facebook"
                      name="social_facebook"
                      type="url"
                      placeholder="https://facebook.com/yourpage"
                      value={formData.social_facebook}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social_instagram">Instagram URL</Label>
                    <Input
                      id="social_instagram"
                      name="social_instagram"
                      type="url"
                      placeholder="https://instagram.com/yourpage"
                      value={formData.social_instagram}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social_twitter">Twitter/X URL</Label>
                    <Input
                      id="social_twitter"
                      name="social_twitter"
                      type="url"
                      placeholder="https://twitter.com/yourpage"
                      value={formData.social_twitter}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social_youtube">YouTube URL</Label>
                    <Input
                      id="social_youtube"
                      name="social_youtube"
                      type="url"
                      placeholder="https://youtube.com/@yourchannel"
                      value={formData.social_youtube}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SEO Settings</CardTitle>
                <CardDescription>Search engine optimization for the inventory listing page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="seo_title">SEO Meta Title</Label>
                  <Input
                    id="seo_title"
                    name="seo_title"
                    placeholder="Title for search engines"
                    value={formData.seo_title}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo_description">SEO Meta Description</Label>
                  <Textarea
                    id="seo_description"
                    name="seo_description"
                    placeholder="Description for search engines"
                    value={formData.seo_description}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo_keywords">SEO Keywords</Label>
                  <Input
                    id="seo_keywords"
                    name="seo_keywords"
                    placeholder="Comma-separated keywords"
                    value={formData.seo_keywords}
                    onChange={handleInputChange}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/admin/inventory")}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {isLoading ? "Saving..." : "Save Settings"}
              </Button>
            </div>
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
        message="Inventory settings saved successfully!"
        actionLabel="OK"
      />
    </div>
  );
}
