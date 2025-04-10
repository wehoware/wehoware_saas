"use client";

import { useState, useEffect } from "react";
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

export default function EditServicePage({ params }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;

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

  useEffect(() => {
    const fetchService = async () => {
      try {
        setIsFetching(true);

        const { data, error } = await supabase
          .from("services")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          setFormData({
            title: data.title || "",
            description: data.description || "",
            content: data.content || "",
            fee: data.fee ? data.fee.toString() : "",
            thumbnail: data.thumbnail || "",
            featured: data.featured === true, // Ensure boolean values are correctly set
            active: data.active === true, // Ensure boolean values are correctly set
            meta_title: data.meta_title || "",
            meta_description: data.meta_description || "",
            keywords: data.keywords || "",
          });
        } else {
          setErrorDialogOpen(true);
          setErrorMessage("Service not found");
          // Will redirect after error dialog is closed
          setTimeout(() => router.push("/admin/services"), 100);
        }
      } catch (error) {
        console.error("Error fetching service:", error);
        setErrorDialogOpen(true);
        setErrorMessage(error.message || "Failed to fetch service");
        // Will redirect after error dialog is closed
        setTimeout(() => router.push("/admin/services"), 100);
      } finally {
        setIsFetching(false);
      }
    };

    fetchService();
  }, [id, router]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    // Simply update the specific field that changed
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
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
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const { data, error } = await supabase
        .from("services")
        .update({
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
          updated_at: new Date(),
          updated_by: userId,
        })
        .eq("id", id);

      if (error) {
        throw error;
      }

      setSuccessDialogOpen(true);
      // Will redirect after user confirms success dialog
    } catch (error) {
      console.error("Error updating service:", error);
      setErrorMessage(error.message || "Failed to update service");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading service...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Edit Service"
          description="Update this immigration service"
          backLink="/admin/services"
          backIcon={<ArrowLeft size={16} />}
        />

        <form
          onSubmit={handleSubmit}
        >
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="content">
                <FileText className="h-4 w-4 mr-2" />
                Content
              </TabsTrigger>
              <TabsTrigger value="seo">
                <Tag className="h-4 w-4 mr-2" />
                SEO
              </TabsTrigger>
            </TabsList>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Service Information</CardTitle>
                  <CardDescription>
                    Update the details about this immigration service
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
                  Update Service
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
          message="Service updated successfully!"
          actionLabel="OK"
          onAction={() => {
            router.push('/admin/services');
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
