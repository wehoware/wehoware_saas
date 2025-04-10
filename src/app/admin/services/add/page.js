"use client";

import { useState } from "react";
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
import {
  ArrowLeft,
  Save,
  ImagePlus,
  FileText,
  Tag,
  Loader2,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import supabase from "@/lib/supabase";
import slugify from "slugify";


export default function AddServicePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    // Content Tab
    title: "",
    description: "",
    content: "",
    fee: "",
    thumbnail: "",
    featured: false,
    active: true,

    // SEO Tab
    meta_title: "",
    meta_description: "",
    keywords: "",
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    // Simply update the specific field that changed
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSelectChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check all required fields including dropdowns
    if (
      !formData.title ||
      !formData.description ||
      !formData.content ||
      !formData.meta_title ||
      !formData.meta_description ||
      !formData.keywords ||
      !formData.fee
    ) {
      setErrorMessage("Please fill in all required fields");
      setErrorDialogOpen(true);
      return;
    }

    try {
      setIsLoading(true);

      // Generate slug from title
      const slug = slugify(formData.title, { lower: true, strict: true });

      // Get the current user ID for audit
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id;

      const { data, error } = await supabase.from("services").insert([
        {
          title: formData.title,
          slug: slug,
          description: formData.description,
          content: formData.content,
          fee: formData.fee ? parseFloat(formData.fee) : null,
          thumbnail: formData.thumbnail,
          featured: formData.featured,
          active: formData.active,
          meta_title: formData.meta_title,
          meta_description: formData.meta_description,
          keywords: formData.keywords,
          created_by: userId,
          updated_by: userId,
        },
      ]);

      if (error) {
        throw error;
      }

      setSuccessDialogOpen(true);
      // Will redirect after user confirms success dialog
    } catch (error) {
      console.error("Error creating service:", error);
      setErrorMessage(error.message || "Failed to create service");
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
          description="Create a new immigration service for your clients"
          backLink="/admin/services"
          backIcon={<ArrowLeft size={16} />}
        />

        <form
          onSubmit={handleSubmit}
        >
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-10">
              <TabsTrigger value="content">
                <FileText className="h-6 w-6 mr-2" />
                Content
              </TabsTrigger>
              <TabsTrigger value="seo">
                <Tag className="h-6 w-6 mr-2" />
                SEO
              </TabsTrigger>
            </TabsList>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Service Information</CardTitle>
                  <CardDescription>
                    Enter the details about this immigration service
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="title">
                        Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="title"
                        name="title"
                        placeholder="e.g. Business Visa Services"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fee">Fee ($)</Label>
                        <Input
                          id="fee"
                          name="fee"
                          type="number"
                          placeholder="e.g. 1500"
                          min="0"
                          step="0.01"
                          value={formData.fee}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      Short Description <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Brief overview of the service"
                      value={formData.description}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      This will appear in service listings and cards (max 300
                      characters)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">
                      Full Content <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="content"
                      name="content"
                      placeholder="Detailed information about the service"
                      className="min-h-[200px]"
                      value={formData.content}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      The full description of the service that will appear on
                      the service detail page
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="thumbnail">Thumbnail URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="thumbnail"
                          name="thumbnail"
                          placeholder="URL to image"
                          value={formData.thumbnail}
                          onChange={handleInputChange}
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0"
                        >
                          <ImagePlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 pt-2 md:flex-row md:items-center">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="featured"
                        name="featured"
                        checked={formData.featured}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, featured: checked })
                        }
                      />
                      <Label htmlFor="featured">Featured Service</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="active"
                        name="active"
                        checked={formData.active}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, active: checked })
                        }
                      />
                      <Label htmlFor="active">Active</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SEO Tab */}
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
                    <Label htmlFor="meta_title">Meta Title</Label>
                    <Input
                      id="meta_title"
                      name="meta_title"
                      placeholder="Title for search engines"
                      value={formData.meta_title}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      SEO optimized title for search engines (required)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meta_description">Meta Description</Label>
                    <Textarea
                      id="meta_description"
                      name="meta_description"
                      placeholder="Brief description for search engines"
                      value={formData.meta_description}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Short description for search engines (required, max 160
                      characters)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="keywords">Keywords</Label>
                    <Input
                      id="keywords"
                      name="keywords"
                      placeholder="e.g. business visa, work permit, immigration consultant"
                      value={formData.keywords}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Comma-separated keywords related to this service
                      (required)
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
