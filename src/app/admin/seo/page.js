"use client";

import { useState, useEffect, useCallback } from 'react';
import supabase from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "react-hot-toast";
import { Globe, CheckCircle2, PlusCircle, Loader2 } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import { useAuth } from "@/contexts/auth-context";
import ConfirmDialog from "@/components/ConfirmDialog";
import StaticPagesTable from '@/components/seo/StaticPagesTable';
import StaticPageDialog from '@/components/seo/StaticPageDialog';
import { KeywordManager } from '@/components/seo/KeywordManager';

const defaultGlobalSettings = {
  site_title: '',
  meta_description: '',
  meta_keywords: '',
  og_title: '',
  og_description: '',
  og_image: '',
};

export default function SEOPage() {
  const { activeClient, isEmployee } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);
  const [isSavingStaticPage, setIsSavingStaticPage] = useState(false);
  const [globalSettings, setGlobalSettings] = useState(defaultGlobalSettings);
  const [staticPages, setStaticPages] = useState([]);
  const [editingPage, setEditingPage] = useState(null);
  const [isStaticPageDialogOpen, setIsStaticPageDialogOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!activeClient?.id) return;
    setIsLoading(true);
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from('wehoware_settings')
        .select('setting_key, setting_value')
        .eq('client_id', activeClient.id)
        .in('setting_key', Object.keys(defaultGlobalSettings));

      if (settingsError) throw settingsError;

      const fetchedSettings = { ...defaultGlobalSettings };
      settingsData.forEach(item => {
        if (item.setting_key in fetchedSettings) {
          fetchedSettings[item.setting_key] = item.setting_value;
        }
      });
      setGlobalSettings(fetchedSettings);

      const { data: pagesData, error: pagesError } = await supabase
        .from('wehoware_static_pages')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('page_slug', { ascending: true });

      if (pagesError) throw pagesError;
      setStaticPages(pagesData || []);

    } catch (error) {
      console.error('Error fetching SEO data:', error);
      toast.error("Failed to load SEO settings. " + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeClient?.id]);

  useEffect(() => {
    if (activeClient?.id) {
      fetchSettings();
    } else if (isEmployee) {
      setIsLoading(false);
      setGlobalSettings(defaultGlobalSettings);
      setStaticPages([]);
    }
  }, [activeClient, isEmployee, fetchSettings]);

  const handleGlobalSettingChange = (key, value) => {
    setGlobalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveGlobalSettings = async () => {
    if (!activeClient?.id) {
      toast.error("Please select an active client first.");
      return;
    }
    setIsSavingGlobal(true);
    try {
      const updates = Object.entries(globalSettings)
        .filter(([key]) => key in defaultGlobalSettings)
        .map(([key, value]) => ({
          client_id: activeClient.id,
          setting_key: key,
          setting_value: String(value || ''),
          setting_group: 'seo_global',
          updated_at: new Date().toISOString(),
        }));

      const { error } = await supabase
        .from('wehoware_settings')
        .upsert(updates, { onConflict: 'client_id, setting_key' });

      if (error) throw error;
      toast.success("Global SEO settings saved successfully!");
    } catch (error) {
      console.error('Error saving global settings:', error);
      if (error.message?.includes('unique constraint')) {
        toast.error("Failed to save: A unique setting already exists. Ensure your database schema is updated.");
      } else {
        toast.error("Failed to save global settings. " + error.message);
      }
    } finally {
      setIsSavingGlobal(false);
    }
  };

  const openAddStaticPageDialog = () => {
    setEditingPage(null);
    setIsStaticPageDialogOpen(true);
  };

  const openEditStaticPageDialog = (page) => {
    setEditingPage(page);
    setIsStaticPageDialogOpen(true);
  };

  const handleSaveStaticPage = async (pageFormData) => {
    if (!activeClient?.id) return;

    const pageData = {
      ...pageFormData,
      client_id: activeClient.id,
      updated_at: new Date().toISOString(),
    };

    const isNewPage = !pageData.id;
    if (isNewPage) {
      delete pageData.id;
      pageData.created_at = new Date().toISOString();
    } else {
      delete pageData.created_at;
    }

    delete pageData.content;
    delete pageData.template_name;

    setIsSavingStaticPage(true);
    try {
      let error;
      if (isNewPage) {
        const { data: existing, error: checkError } = await supabase
          .from('wehoware_static_pages')
          .select('id')
          .eq('client_id', activeClient.id)
          .eq('page_slug', pageData.page_slug)
          .maybeSingle();

        if (checkError) throw checkError;
        if (existing) {
          toast.error(`Page slug "${pageData.page_slug}" already exists.`);
          setIsSavingStaticPage(false);
          return;
        }

        const { error: insertError } = await supabase
          .from('wehoware_static_pages')
          .insert(pageData);
        error = insertError;
      } else {
        const { data: existing, error: checkError } = await supabase
          .from('wehoware_static_pages')
          .select('id')
          .eq('client_id', activeClient.id)
          .eq('page_slug', pageData.page_slug)
          .neq('id', pageData.id)
          .maybeSingle();

        if (checkError) throw checkError;
        if (existing) {
          toast.error(`Page slug "${pageData.page_slug}" already exists.`);
          setIsSavingStaticPage(false);
          return;
        }

        const { error: updateError } = await supabase
          .from('wehoware_static_pages')
          .update(pageData)
          .eq('id', pageData.id)
          .eq('client_id', activeClient.id);
        error = updateError;
      }

      if (error) throw error;

      toast.success(`Static page ${isNewPage ? 'added' : 'updated'} successfully!`);
      setIsStaticPageDialogOpen(false);
      fetchSettings();
    } catch (error) {
      console.error('Error saving static page:', error);
      toast.error(`Failed to ${isNewPage ? 'add' : 'update'} static page. ${error.message}`);
    } finally {
      setIsSavingStaticPage(false);
    }
  };

  const openDeleteDialog = (page) => {
    setPageToDelete(page);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteStaticPage = async () => {
    if (!activeClient?.id || !pageToDelete?.id) return;

    setIsSavingStaticPage(true);
    try {
      const { error } = await supabase
        .from('wehoware_static_pages')
        .delete()
        .eq('id', pageToDelete.id)
        .eq('client_id', activeClient.id);

      if (error) throw error;

      toast.success("Static page deleted successfully!");
      setIsDeleteDialogOpen(false);
      setPageToDelete(null);
      fetchSettings();
    } catch (error) {
      console.error('Error deleting static page:', error);
      toast.error(`Failed to delete static page. ${error.message}`);
    } finally {
      setIsSavingStaticPage(false);
      setIsDeleteDialogOpen(false);
      setPageToDelete(null);
    }
  };

  if (isEmployee && !activeClient) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a client from the header dropdown to manage SEO settings.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      <AdminPageHeader
        title="SEO Management"
        description="Control how your website appears in search results"
      />

      <Tabs defaultValue="global" className="space-y-4">
        <TabsList className="border border-gray-200 shadow-sm">
          <TabsTrigger value="global">Global Settings</TabsTrigger>
          <TabsTrigger value="pages">Static Pages</TabsTrigger>
          <TabsTrigger value="sitemap">Sitemap Config</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-4">
          <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
            <CardHeader>
              <CardTitle>Website Metadata</CardTitle>
              <CardDescription>
                These settings apply sitewide unless overridden on a specific page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="site_title">Website Title</Label>
                  <Input
                    id="site_title"
                    placeholder="Your Website Name"
                    value={globalSettings.site_title}
                    onChange={(e) => handleGlobalSettingChange('site_title', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_keywords">Meta Keywords (Comma-separated)</Label>
                  <Input
                    id="meta_keywords"
                    placeholder="keyword1, keyword2, keyword3"
                    value={globalSettings.meta_keywords}
                    onChange={(e) => handleGlobalSettingChange('meta_keywords', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="meta_description">Meta Description</Label>
                  <Textarea
                    id="meta_description"
                    placeholder="Describe your website concisely ( ideally < 160 characters)."
                    value={globalSettings.meta_description}
                    onChange={(e) => handleGlobalSettingChange('meta_description', e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Optimal length is under 160 characters for search results.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
            <CardHeader>
              <CardTitle>Social Media (Open Graph)</CardTitle>
              <CardDescription>
                Control how your website appears when shared on social media platforms like Facebook, LinkedIn, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="og_title">OG Title</Label>
                  <Input
                    id="og_title"
                    placeholder="Title for social sharing (defaults to Website Title if empty)"
                    value={globalSettings.og_title}
                    onChange={(e) => handleGlobalSettingChange('og_title', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="og_image">OG Image URL</Label>
                  <Input
                    id="og_image"
                    placeholder="https://yourdomain.com/og-image.jpg"
                    value={globalSettings.og_image}
                    onChange={(e) => handleGlobalSettingChange('og_image', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="og_description">OG Description</Label>
                  <Textarea
                    id="og_description"
                    placeholder="Description for social sharing (defaults to Meta Description if empty)."
                    value={globalSettings.og_description}
                    onChange={(e) => handleGlobalSettingChange('og_description', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSaveGlobalSettings} disabled={isSavingGlobal || isLoading}>
              {isSavingGlobal ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><CheckCircle2 size={16} className="mr-2"/> Save Global Settings</>}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="pages" className="space-y-4">
          <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Static Page Metadata & Sitemap</CardTitle>
                <CardDescription>
                  Manage SEO settings for individual static pages (e.g., /about, /contact).
                </CardDescription>
              </div>
              <Button size="sm" onClick={openAddStaticPageDialog} disabled={isLoading}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Static Page
              </Button>
            </CardHeader>
            <CardContent>
              <StaticPagesTable 
                pages={staticPages} 
                onEdit={openEditStaticPageDialog} 
                onDelete={openDeleteDialog} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sitemap" className="space-y-4">
          <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
            <CardHeader>
              <CardTitle>Sitemap Configuration</CardTitle>
              <CardDescription>
                Manage automatic inclusion of content types in your sitemap.
                <span className="block text-xs text-muted-foreground mt-1">(Note: Actual sitemap.xml generation requires backend setup.)</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center p-4 border border-gray-200 rounded-lg bg-muted/50 mb-4">
                <Globe className="h-5 w-5 mr-2 text-muted-foreground" />
                <p className="text-sm">Your sitemap should be available at: <span className="font-mono font-medium">/sitemap.xml</span> (relative to your domain)</p>
              </div>
              <div className="text-center text-muted-foreground py-8">Sitemap dynamic content settings coming soon...</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="keywords" className="space-y-4">
          <KeywordManager />
        </TabsContent>

      </Tabs>

      <StaticPageDialog
        isOpen={isStaticPageDialogOpen}
        onOpenChange={setIsStaticPageDialogOpen}
        pageData={editingPage} 
        onSave={handleSaveStaticPage}
        isSaving={isSavingStaticPage}
      />

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Static Page?"
        message={`Are you sure you want to delete the page "${pageToDelete?.page_slug}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteStaticPage}
        isLoading={isSavingStaticPage} 
        loadingLabel="Deleting..."
        variant="destructive"
      />

    </div>
  );
}
