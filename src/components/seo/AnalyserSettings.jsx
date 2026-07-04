"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Settings } from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/auth-context";

const CHECK_CATEGORIES = [
  { key: "checkMetaTags", label: "Meta Tags" },
  { key: "checkOpenGraph", label: "Open Graph" },
  { key: "checkTwitterCards", label: "Twitter Cards" },
  { key: "checkCanonical", label: "Canonical URLs" },
  { key: "checkRobotsMeta", label: "Robots Meta" },
  { key: "checkHeadingStructure", label: "Heading Structure" },
  { key: "checkImageAlt", label: "Image Alt Text" },
  { key: "checkContentStructure", label: "Content Structure" },
  { key: "checkKeywordUsage", label: "Keyword Usage" },
  { key: "checkEeat", label: "E-E-A-T Signals" },
  { key: "checkReadability", label: "Readability" },
  { key: "checkContentFreshness", label: "Content Freshness" },
  { key: "checkUrlOptimization", label: "URL Optimization" },
  { key: "checkIndexability", label: "Indexability" },
  { key: "checkHttps", label: "HTTPS" },
  { key: "checkWebVitals", label: "Core Web Vitals" },
  { key: "checkRichSnippets", label: "Rich Snippets" },
  { key: "checkSerpFeatures", label: "SERP Features" },
  { key: "checkMultimediaSeo", label: "Multimedia SEO" },
  { key: "checkInternalLinks", label: "Internal Links" },
  { key: "checkSchema", label: "Schema Markup" },
  { key: "checkTfidf", label: "TF-IDF Analysis" },
  { key: "checkDuplicateContent", label: "Duplicate Content" },
  { key: "checkAeo", label: "AEO (Answer Engine)" },
  { key: "checkGeo", label: "GEO (Generative Engine)" },
  { key: "checkSxo", label: "SXO (Search Experience)" },
];

export default function AnalyserSettings() {
  const { user, activeClient } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/seo-analyser/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setSettings(data.data);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && activeClient?.id) {
      fetchSettings();
    } else if (user && !activeClient?.id) {
      setLoading(false);
    }
  }, [user, activeClient?.id, fetchSettings]);

  const handleToggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/seo-analyser/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeClient?.id) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please select a client to configure SEO analyser settings.
      </div>
    );
  }

  if (!settings) {
    return <div className="text-center py-12 text-muted-foreground">No settings found</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Analyser Configuration
          </CardTitle>
          <CardDescription>Configure which checks to run and the scan schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* General settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Analyser Enabled</p>
                <p className="text-sm text-muted-foreground">Enable/disable the SEO analyser</p>
              </div>
              <Switch checked={settings.enabled} onCheckedChange={() => handleToggle("enabled")} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-Suggest Fixes</p>
                <p className="text-sm text-muted-foreground">Generate LLM-powered fix suggestions</p>
              </div>
              <Switch checked={settings.autoSuggestFixes} onCheckedChange={() => handleToggle("autoSuggestFixes")} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Scan Blogs</p>
                <p className="text-sm text-muted-foreground">Include blog posts in scans</p>
              </div>
              <Switch checked={settings.scanBlogs} onCheckedChange={() => handleToggle("scanBlogs")} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Scan Services</p>
                <p className="text-sm text-muted-foreground">Include service pages in scans</p>
              </div>
              <Switch checked={settings.scanServices} onCheckedChange={() => handleToggle("scanServices")} />
            </div>

            <div>
              <p className="font-medium mb-1">Schedule Frequency</p>
              <Select value={settings.scheduleFrequency} onValueChange={(v) => handleSelectChange("scheduleFrequency", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="font-medium mb-1">Schedule Hour (UTC)</p>
              <Select value={String(settings.scheduleHour)} onValueChange={(v) => handleSelectChange("scheduleHour", Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((h) => (
                    <SelectItem key={h} value={String(h)}>{`${h}:00 UTC`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Check Categories</CardTitle>
          <CardDescription>Enable or disable individual SEO checks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CHECK_CATEGORIES.map((cat) => (
              <div key={cat.key} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{cat.label}</span>
                <Switch checked={settings[cat.key] !== false} onCheckedChange={() => handleToggle(cat.key)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
