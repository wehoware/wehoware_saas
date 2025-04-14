"use client";

import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import slugify from "slugify";

const defaultStaticPage = {
  id: null,
  page_slug: "",
  title: "",
  meta_description: "",
  meta_keywords: "",
  sitemap_changefreq: "monthly",
  sitemap_priority: 0.5,
};

export default function StaticPageDialog({
  isOpen,
  onOpenChange,
  pageData,
  onSave,
  isSaving,
}) {
  const [formData, setFormData] = useState(defaultStaticPage);
  const isEditing = Boolean(pageData?.id);

  useEffect(() => {
    if (isOpen) {
      setFormData(
        isEditing
          ? {
              ...pageData,
              sitemap_priority: String(pageData.sitemap_priority || "0.5"),
            }
          : defaultStaticPage
      );
    }
  }, [isOpen, pageData, isEditing]);

  const handleChange = (key, value) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSlugChange = (e) => {
    const rawSlug = e.target.value;
    handleChange("page_slug", rawSlug.replace(/^\/+/, ""));
  };

  const handleSubmit = () => {
    if (!formData.page_slug || !formData.title) {
      toast.error("Slug and Title are required.");
      return;
    }

    const finalSlug =
      "/" + slugify(formData.page_slug, { lower: true, strict: true });

    onSave({
      ...formData,
      page_slug: finalSlug,
      sitemap_priority: parseFloat(formData.sitemap_priority),
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[600px]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isEditing ? "Edit Static Page" : "Add New Static Page"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Provide page details clearly for SEO optimization.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-4">
          <div>
            <Label>Slug *</Label>
            <Input
              value={formData.page_slug}
              onChange={handleSlugChange}
              placeholder="your-page-slug"
              required
            />
          </div>

          <div>
            <Label>Meta Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="Meta Title"
              required
            />
          </div>

          <div>
            <Label>Meta Description</Label>
            <Textarea
              value={formData.meta_description}
              onChange={(e) => handleChange("meta_description", e.target.value)}
              placeholder="Meta Description (max 160 chars)"
            />
          </div>

          <div>
            <Label>Meta Keywords</Label>
            <Input
              value={formData.meta_keywords}
              onChange={(e) => handleChange("meta_keywords", e.target.value)}
              placeholder="keyword1, keyword2"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save Page"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
