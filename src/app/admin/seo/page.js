"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, Globe, FileText, CheckCircle2, PlusCircle } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";

export default function SEOPage() {
  const [saving, setSaving] = useState(false);
  
  const handleSave = () => {
    setSaving(true);
    // Simulate save
    setTimeout(() => {
      setSaving(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader 
          title="SEO Management" 
          description="Control how your website appears in search results"
          actionLabel="Save Changes"
          actionIcon={<CheckCircle2 size={16} />}
          onAction={handleSave}
        />
        
        <Tabs defaultValue="global" className="space-y-4">
          <TabsList className="border border-gray-200 shadow-sm">
            <TabsTrigger value="global">Global Settings</TabsTrigger>
            <TabsTrigger value="pages">Page Metadata</TabsTrigger>
            <TabsTrigger value="sitemap">Sitemap</TabsTrigger>
          </TabsList>
          
          <TabsContent value="global" className="space-y-4">
            <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
              <CardHeader>
                <CardTitle>Website Metadata</CardTitle>
                <CardDescription>
                  These settings apply to your entire website
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid w-full gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="site-title">Website Title</Label>
                    <Input id="site-title" placeholder="Wehoware" defaultValue="Wehoware" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="site-description">Meta Description</Label>
                    <Textarea 
                      id="site-description" 
                      placeholder="Professional immigration services helping you navigate the complex immigration process."
                      defaultValue="Professional immigration services helping you navigate the complex immigration process."
                    />
                    <p className="text-sm text-muted-foreground">
                      Keep your description under 160 characters for optimal display in search results.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="keywords">Meta Keywords</Label>
                    <Input 
                      id="keywords" 
                      placeholder="immigration, visa, green card, citizenship, legal help"
                      defaultValue="immigration, visa, green card, citizenship, legal help"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
              <CardHeader>
                <CardTitle>Social Media</CardTitle>
                <CardDescription>
                  Control how your website appears when shared on social media
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid w-full gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="og-title">Open Graph Title</Label>
                    <Input id="og-title" placeholder="Wehoware" defaultValue="Wehoware" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="og-description">Open Graph Description</Label>
                    <Textarea 
                      id="og-description" 
                      placeholder="Professional immigration services helping you navigate the complex immigration process."
                      defaultValue="Professional immigration services helping you navigate the complex immigration process."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="og-image">Open Graph Image URL</Label>
                    <Input id="og-image" placeholder="https://example.com/images/og-image.jpg" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="pages" className="space-y-4">
            <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
              <CardHeader>
                <CardTitle>Page-Specific SEO</CardTitle>
                <CardDescription>
                  Customize metadata for individual pages
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex w-full max-w-sm items-center space-x-2 mb-4">
                  <Input type="text" placeholder="Search pages..." />
                  <Button type="submit">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid gap-4">
                  {['Home', 'Services', 'Blog', 'Contact', 'About Us'].map((page, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow transition-shadow duration-200">
                      <div className="flex items-center space-x-4">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{page}</p>
                          <p className="text-sm text-muted-foreground">/{page.toLowerCase().replace(' ', '-')}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Edit SEO
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="sitemap" className="space-y-4">
            <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
              <CardHeader>
                <CardTitle>Sitemap Configuration</CardTitle>
                <CardDescription>
                  Manage your website sitemap for search engines
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center p-4 border border-gray-200 rounded-lg bg-muted/50">
                  <Globe className="h-5 w-5 mr-2 text-muted-foreground" />
                  <p className="text-sm">Your sitemap is available at: <span className="font-mono font-medium">https://wehoware.com/sitemap.xml</span></p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Included Pages</h3>
                    <Button size="sm" variant="outline">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Page
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50 border-b border-gray-200">
                          <th className="text-left p-3 font-medium">URL</th>
                          <th className="text-left p-3 font-medium">Change Freq</th>
                          <th className="text-left p-3 font-medium">Priority</th>
                          <th className="text-left p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { url: '/', changefreq: 'weekly', priority: '1.0' },
                          { url: '/services', changefreq: 'weekly', priority: '0.8' },
                          { url: '/blog', changefreq: 'daily', priority: '0.7' },
                          { url: '/contact', changefreq: 'monthly', priority: '0.5' },
                          { url: '/about', changefreq: 'monthly', priority: '0.5' },
                        ].map((item, i) => (
                          <tr key={i} className="border-b border-gray-200 last:border-0">
                            <td className="p-3 font-mono text-sm">{item.url}</td>
                            <td className="p-3 text-sm">{item.changefreq}</td>
                            <td className="p-3 text-sm">{item.priority}</td>
                            <td className="p-3 text-sm">
                              <Button variant="ghost" size="sm">Edit</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}