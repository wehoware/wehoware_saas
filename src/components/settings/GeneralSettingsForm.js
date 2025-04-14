"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";

export default function GeneralSettingsForm({ 
    settings,
    onSettingChange,
    onSave,
    isSaving 
}) {
    
    // Helper to get value or default
    const getSetting = (key) => settings?.[key] || '';

    return (
        <Card>
            <CardHeader>
                <CardTitle>General Application Settings</CardTitle>
                <CardDescription>Manage basic application configurations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="app_name">Application Name</Label>
                    <Input 
                        id="app_name"
                        value={getSetting('app_name')}
                        onChange={(e) => onSettingChange('app_name', e.target.value)}
                        placeholder="Your SaaS Name"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="support_email">Support Email</Label>
                    <Input 
                        id="support_email"
                        type="email"
                        value={getSetting('support_email')}
                        onChange={(e) => onSettingChange('support_email', e.target.value)}
                        placeholder="support@example.com"
                    />
                </div>
                {/* Add more general settings fields here as needed */}
                {/* Example: Timezone Select (using a simple Input for now) */}
                <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input 
                        id="timezone"
                        value={getSetting('timezone')}
                        onChange={(e) => onSettingChange('timezone', e.target.value)}
                        placeholder="e.g., America/New_York"
                    />
                    {/* TODO: Consider replacing with a proper Timezone Select component */}
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={() => onSave(['app_name', 'support_email', 'timezone'])} disabled={isSaving}> 
                        {isSaving ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                        ) : (
                            <><Save className="mr-2 h-4 w-4" /> Save General Settings</>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
