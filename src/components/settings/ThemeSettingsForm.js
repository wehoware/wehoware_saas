"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Palette } from "lucide-react";

// Example theme settings keys
const themeSettingKeys = [
  "theme_primary_color",
  "theme_secondary_color",
  "theme_accent_color",
  "logo_url_light",
  "logo_url_dark",
  "favicon_url",
];

export default function ThemeSettingsForm({
  settings,
  onSettingChange,
  onSave,
  isSaving,
}) {
  // Helper to get value or default
  const getSetting = (key) => settings?.[key] || "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme & Branding</CardTitle>
        <CardDescription>
          Customize the look and feel of your application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="logo_url_light">Logo URL (Light Background)</Label>
            <Input
              id="logo_url_light"
              value={getSetting("logo_url_light")}
              onChange={(e) =>
                onSettingChange("logo_url_light", e.target.value)
              }
              placeholder="https://.../logo_light.png"
            />
            {getSetting("logo_url_light") && (
              <img
                src={getSetting("logo_url_light")}
                alt="Light Logo Preview"
                className="mt-2 h-8 object-contain"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo_url_dark">Logo URL (Dark Background)</Label>
            <Input
              id="logo_url_dark"
              value={getSetting("logo_url_dark")}
              onChange={(e) => onSettingChange("logo_url_dark", e.target.value)}
              placeholder="https://.../logo_dark.png"
            />
            {getSetting("logo_url_dark") && (
              <img
                src={getSetting("logo_url_dark")}
                alt="Dark Logo Preview"
                className="mt-2 h-8 object-contain bg-gray-800 p-1 rounded"
              />
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="favicon_url">Favicon URL (.ico, .png, .svg)</Label>
          <Input
            id="favicon_url"
            value={getSetting("favicon_url")}
            onChange={(e) => onSettingChange("favicon_url", e.target.value)}
            placeholder="https://.../favicon.ico"
          />
          {getSetting("favicon_url") && (
            <img
              src={getSetting("favicon_url")}
              alt="Favicon Preview"
              className="mt-2 h-6 w-6 object-contain"
            />
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => onSave(themeSettingKeys)} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Palette className="mr-2 h-4 w-4" /> Save Theme Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
