"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Lock, User, Mail, BellRing, Globe, Key } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";

export default function SettingsPage() {
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
          title="Settings" 
          description="Manage your account and website preferences"
          actionLabel={saving ? "Saving..." : "Save Changes"}
          actionIcon={<Save size={16} />}
          onAction={handleSave}
          actionDisabled={saving}
        />
        
        <Tabs defaultValue="account" className="space-y-4">
          <TabsList className="border border-gray-200 shadow-sm">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="website">Website</TabsTrigger>
          </TabsList>
          
          <TabsContent value="account" className="space-y-4">
            <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your account information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="John" defaultValue="John" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Doe" defaultValue="Doe" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" placeholder="john.doe@example.com" defaultValue="john.doe@example.com" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select defaultValue="admin">
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  Update your business details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input id="companyName" placeholder="Wehoware" defaultValue="Wehoware" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" placeholder="+1 (555) 123-4567" defaultValue="+1 (555) 123-4567" />
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" placeholder="123 Business St, City, State, 12345" defaultValue="123 Business St, City, State, 12345" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="security" className="space-y-4">
            <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col space-y-1">
                    <span className="font-medium">Enable 2FA</span>
                    <span className="text-sm text-muted-foreground">Protect your account with two-factor authentication</span>
                  </div>
                  <Switch />
                </div>
                
                <div className="border-t pt-4">
                  <Button variant="outline">
                    <Lock className="h-4 w-4 mr-2" />
                    Set Up Two-Factor Authentication
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="notifications" className="space-y-4">
            <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>
                  Manage email notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {[
                    { title: 'New Inquiries', description: 'Receive notifications when a new inquiry is submitted' },
                    { title: 'Comment Notifications', description: 'Receive notifications when someone comments on a blog post' },
                    { title: 'System Updates', description: 'Receive notifications about system updates and maintenance' },
                    { title: 'Marketing Emails', description: 'Receive promotional emails and newsletters' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <Switch />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="website" className="space-y-4">
            <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure your website functionality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-medium">Maintenance Mode</p>
                      <p className="text-sm text-muted-foreground">Put your website in maintenance mode</p>
                    </div>
                    <Switch />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Default Timezone</Label>
                    <Select defaultValue="america_newyork">
                      <SelectTrigger id="timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="america_newyork">America/New York</SelectItem>
                        <SelectItem value="america_chicago">America/Chicago</SelectItem>
                        <SelectItem value="america_denver">America/Denver</SelectItem>
                        <SelectItem value="america_los_angeles">America/Los Angeles</SelectItem>
                        <SelectItem value="asia_tokyo">Asia/Tokyo</SelectItem>
                        <SelectItem value="europe_london">Europe/London</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="language">Default Language</Label>
                    <Select defaultValue="en">
                      <SelectTrigger id="language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Manage API keys for third-party services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="google-maps-key">Google Maps API Key</Label>
                    <div className="flex space-x-2">
                      <Input id="google-maps-key" type="password" value="●●●●●●●●●●●●●●●●" readOnly />
                      <Button variant="outline" size="icon">
                        <Key className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mailchimp-key">Mailchimp API Key</Label>
                    <div className="flex space-x-2">
                      <Input id="mailchimp-key" type="password" value="●●●●●●●●●●●●●●●●" readOnly />
                      <Button variant="outline" size="icon">
                        <Key className="h-4 w-4" />
                      </Button>
                    </div>
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