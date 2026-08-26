"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Send,
  Save,
  Calendar,
  Hash,
  Image as ImageIcon,
  Share2,
  Plus,
  X,
  Clock,
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  PLATFORM_CHAR_LIMITS,
  POST_TYPES,
  PLATFORMS_REQUIRING_MEDIA,
  toLocalDatetimeInputValue,
} from "@/lib/social-clients/constants.js";
import AdminPageHeader from "@/components/AdminPageHeader";
import DateTimePicker from "@/components/ui/date-time-picker";

export default function CreatePostPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    mediaUrls: [],
    hashtags: [],
    scheduledFor: "",
    postType: "Text",
    targetAccounts: [],
  });
  const [hashtagInput, setHashtagInput] = useState("");
  const [mediaUrlInput, setMediaUrlInput] = useState("");

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/v1/social/accounts?status=Active");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch {
      toast.error("Failed to load accounts");
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadAccounts();
  }, [user, loadAccounts]);

  function toggleAccount(accountId) {
    setFormData((prev) => ({
      ...prev,
      targetAccounts: prev.targetAccounts.includes(accountId)
        ? prev.targetAccounts.filter((id) => id !== accountId)
        : [...prev.targetAccounts, accountId],
    }));
  }

  function addHashtag() {
    const tag = hashtagInput.replace(/^#/, "").trim();
    if (!tag || formData.hashtags.includes(tag)) return;
    setFormData((prev) => ({ ...prev, hashtags: [...prev.hashtags, tag] }));
    setHashtagInput("");
  }

  function removeHashtag(tag) {
    setFormData((prev) => ({ ...prev, hashtags: prev.hashtags.filter((t) => t !== tag) }));
  }

  function addMediaUrl() {
    const url = mediaUrlInput.trim();
    if (!url || formData.mediaUrls.includes(url)) return;
    setFormData((prev) => ({ ...prev, mediaUrls: [...prev.mediaUrls, url] }));
    setMediaUrlInput("");
  }

  function removeMediaUrl(url) {
    setFormData((prev) => ({ ...prev, mediaUrls: prev.mediaUrls.filter((u) => u !== url) }));
  }

  function validatePost() {
    if (!formData.content.trim()) { toast.error("Content is required"); return false; }
    if (formData.targetAccounts.length === 0) { toast.error("Select at least one account"); return false; }
    const selectedPlatformCodes = selectedAccounts.map((a) => a.platform?.platformCode).filter(Boolean);
    const needsMedia = selectedPlatformCodes.some((code) => PLATFORMS_REQUIRING_MEDIA.has(code));
    if (needsMedia && formData.mediaUrls.length === 0) {
      toast.error("Instagram and TikTok require at least one media URL");
      return false;
    }
    return true;
  }

  async function handleSubmit(schedule = false) {
    if (!validatePost()) return;
    if (schedule && !formData.scheduledFor) { toast.error("Schedule date/time is required"); return; }

    setLoading(true);
    try {
      const payload = {
        title: formData.title || undefined,
        content: formData.content,
        media_urls: formData.mediaUrls,
        hashtags: formData.hashtags,
        scheduled_for: schedule && formData.scheduledFor ? formData.scheduledFor : undefined,
        post_type: formData.postType,
        target_accounts: formData.targetAccounts,
      };
      const res = await fetch("/api/v1/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create post");
      toast.success(schedule ? "Post scheduled!" : "Post saved as draft");
      router.push("/admin/social-media/posts");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishNow() {
    if (!validatePost()) return;

    setLoading(true);
    let created = null;
    try {
      const createRes = await fetch("/api/v1/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title || undefined,
          content: formData.content,
          media_urls: formData.mediaUrls,
          hashtags: formData.hashtags,
          post_type: formData.postType,
          target_accounts: formData.targetAccounts,
        }),
      });
      created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error || "Failed to create post");

      const publishRes = await fetch(`/api/v1/social/posts/${created.id}/publish`, { method: "POST" });
      const published = await publishRes.json();
      if (!publishRes.ok) throw new Error(published.error || "Failed to publish");

      toast.success("Post published successfully!");
      router.push(`/admin/social-media/posts/${created.id}`);
    } catch (err) {
      if (created?.id) {
        toast.error(err.message + " — redirecting to post details");
        router.push(`/admin/social-media/posts/${created.id}`);
      } else {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  const selectedAccounts = accounts.filter((a) => formData.targetAccounts.includes(a.id));
  const minCharLimit = selectedAccounts.length > 0
    ? Math.min(...selectedAccounts.map((a) => PLATFORM_CHAR_LIMITS[a.platform?.platformCode] || 10000))
    : 10000;
  const charCount = formData.content.length;
  const isOverLimit = charCount > minCharLimit;
  const needsMedia = selectedAccounts.some((a) => PLATFORMS_REQUIRING_MEDIA.has(a.platform?.platformCode));
  const isFormValid = formData.content.trim() && formData.targetAccounts.length > 0 && !isOverLimit && (!needsMedia || formData.mediaUrls.length > 0);

  // Group accounts by platform for cleaner display
  const accountsByPlatform = accounts.reduce((acc, account) => {
    const code = account.platform?.platformCode || "other";
    if (!acc[code]) acc[code] = { platform: account.platform, accounts: [] };
    acc[code].accounts.push(account);
    return acc;
  }, {});

  function renderAccountSelector() {
    if (loadingAccounts) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
        </div>
      );
    }
    if (accounts.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="p-3 rounded-full bg-muted w-12 h-12 mx-auto mb-3 flex items-center justify-center">
            <Share2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No connected accounts</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Connect a social platform to start posting
          </p>
          <Link href="/admin/social-media/accounts">
            <Button variant="outline" size="sm">
              <Plus className="h-3 w-3 mr-2" /> Connect Account
            </Button>
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {Object.entries(accountsByPlatform).map(([code, group]) => (
          <div key={code}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {group.platform?.name || code}
            </p>
            <div className="flex flex-col gap-2">
              {group.accounts.map((account) => {
                const isSelected = formData.targetAccounts.includes(account.id);
                return (
                  <label
                    key={account.id}
                    htmlFor={account.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      id={account.id}
                      checked={isSelected}
                      onCheckedChange={() => toggleAccount(account.id)}
                    />
                    {account.platform?.logoUrl ? (
                      <img src={account.platform.logoUrl} alt={account.platform.name} className="w-5 h-5 rounded flex-shrink-0" />
                    ) : (
                      <Share2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate flex-1">{account.account_name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <AdminPageHeader
        title="Create Post"
        description="Compose and publish or schedule a post across your social platforms"
        backLink="/admin/social-media/posts"
        backIcon={<ArrowLeft className="h-4 w-4" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main Editor (2/3 width) ──────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Content Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Post Content
              </CardTitle>
              <CardDescription className="text-xs">
                Write your post — character limits apply per platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Title */}
              <div>
                <Label htmlFor="title" className="text-xs text-muted-foreground">
                  Title <span className="text-muted-foreground/60">(optional, internal reference)</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. Summer campaign launch..."
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  className="mt-1.5"
                />
              </div>

              {/* Content textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="content" className="text-xs">
                    Content <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    {selectedAccounts.length > 0 && minCharLimit < 10000 && (
                      <span className="text-xs text-muted-foreground">
                        Limit: {minCharLimit}
                      </span>
                    )}
                    <span className={`text-xs font-medium ${isOverLimit ? "text-red-500" : charCount > minCharLimit * 0.8 ? "text-orange-500" : "text-muted-foreground"}`}>
                      {charCount}{minCharLimit < 10000 ? ` / ${minCharLimit}` : ""}
                    </span>
                  </div>
                </div>
                <Textarea
                  id="content"
                  placeholder="What would you like to share?"
                  value={formData.content}
                  onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                  rows={6}
                  className={`resize-none ${isOverLimit ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {isOverLimit && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Content exceeds {minCharLimit} character limit for selected platforms
                  </p>
                )}
              </div>

              {/* Post Type */}
              <div>
                <Label className="text-xs text-muted-foreground">Post Type</Label>
                <Select value={formData.postType} onValueChange={(v) => setFormData((p) => ({ ...p, postType: v }))}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POST_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Hashtags */}
              <div>
                <Label className="text-xs text-muted-foreground">Hashtags</Label>
                <div className="flex gap-2 mt-1.5">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Add hashtag..."
                      value={hashtagInput}
                      onChange={(e) => setHashtagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHashtag(); } }}
                      className="pl-9"
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addHashtag}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {formData.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {formData.hashtags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                        onClick={() => removeHashtag(tag)}
                      >
                        #{tag} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Media URLs */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Media URLs
                    {needsMedia && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {needsMedia && (
                    <span className="text-xs text-orange-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Required for Instagram/TikTok
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="https://... (image or video URL)"
                      value={mediaUrlInput}
                      onChange={(e) => setMediaUrlInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMediaUrl(); } }}
                      className="pl-9"
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addMediaUrl}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {formData.mediaUrls.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2.5">
                    {formData.mediaUrls.map((url) => (
                      <div key={url} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
                        <ImageIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs truncate flex-1">{url}</span>
                        <button
                          onClick={() => removeMediaUrl(url)}
                          className="text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar (1/3 width) ──────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Target Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Target Accounts
              </CardTitle>
              <CardDescription className="text-xs">
                {formData.targetAccounts.length > 0
                  ? `${formData.targetAccounts.length} selected`
                  : "Select platforms to publish to"}
              </CardDescription>
            </CardHeader>
            <CardContent>{renderAccountSelector()}</CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Schedule
              </CardTitle>
              <CardDescription className="text-xs">
                Pick a date/time or publish immediately
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="scheduledFor" className="text-xs text-muted-foreground">
                  Publish Date &amp; Time
                </Label>
                <DateTimePicker
                  value={formData.scheduledFor}
                  onChange={(e) => setFormData((p) => ({ ...p, scheduledFor: e.target.value }))}
                  min={new Date()}
                  placeholder="Pick a date & time"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Leave empty to save as draft
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2.5 sticky top-4">
            {/* Status indicator */}
            <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              isFormValid
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-muted bg-muted/30 text-muted-foreground"
            }`}>
              {isFormValid ? (
                <>
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  Ready to publish
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {formData.targetAccounts.length === 0
                    ? "Select at least one account"
                    : !formData.content.trim()
                    ? "Content is required"
                    : needsMedia && formData.mediaUrls.length === 0
                    ? "Media URL required"
                    : "Complete the form"}
                </>
              )}
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={loading || !isFormValid}
              onClick={handlePublishNow}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Publish Now
            </Button>

            {formData.scheduledFor && (
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                disabled={loading || !isFormValid}
                onClick={() => handleSubmit(true)}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Post
              </Button>
            )}

            <Button
              variant="ghost"
              className="w-full"
              disabled={loading || !formData.content.trim()}
              onClick={() => handleSubmit(false)}
            >
              <Save className="h-4 w-4 mr-2" />
              Save as Draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
