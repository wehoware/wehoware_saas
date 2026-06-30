"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, Save, Calendar, Hash, Image, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  PLATFORM_CHAR_LIMITS,
  POST_TYPES,
  PLATFORMS_REQUIRING_MEDIA,
  toLocalDatetimeInputValue,
} from "@/lib/social-clients/constants.js";

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
    // Validate media requirements for platforms like Instagram and TikTok
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
      // If the post was created but publishing failed, navigate to the post detail page
      // so the user can retry publishing from there instead of being stuck on the create page.
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

  function renderAccountSelector() {
    if (loadingAccounts) {
      return (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
        </div>
      );
    }
    if (accounts.length === 0) {
      return (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">No connected accounts</p>
          <Link href="/admin/social-media/accounts">
            <Button variant="outline" size="sm" className="mt-2">Connect Account</Button>
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {accounts.map((account) => (
          <div key={account.id} className="flex items-center gap-2">
            <Checkbox
              id={account.id}
              checked={formData.targetAccounts.includes(account.id)}
              onCheckedChange={() => toggleAccount(account.id)}
            />
            <label htmlFor={account.id} className="flex items-center gap-2 cursor-pointer text-sm flex-1">
              {account.platform?.logoUrl
                ? <img src={account.platform.logoUrl} alt={account.platform.name} className="w-4 h-4 rounded" />
                : <Share2 className="w-4 h-4" />}
              <span className="truncate">{account.account_name}</span>
            </label>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/social-media/posts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Create Post</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Post Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="Post title or internal reference..."
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="content">Content *</Label>
                  <span className={`text-xs ${isOverLimit ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                    {charCount}{minCharLimit < 10000 ? ` / ${minCharLimit}` : ""}
                  </span>
                </div>
                <Textarea
                  id="content"
                  placeholder="Write your post content here..."
                  value={formData.content}
                  onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                  rows={6}
                  className={`mt-0 ${isOverLimit ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {isOverLimit && (
                  <p className="text-xs text-red-500 mt-1">
                    Content exceeds {minCharLimit} character limit for selected platforms
                  </p>
                )}
              </div>

              <div>
                <Label>Post Type</Label>
                <Select value={formData.postType} onValueChange={(v) => setFormData((p) => ({ ...p, postType: v }))}>
                  <SelectTrigger className="mt-1">
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
                <Label>Hashtags</Label>
                <div className="flex gap-2 mt-1">
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
                  <Button type="button" variant="outline" onClick={addHashtag}>Add</Button>
                </div>
                {formData.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.hashtags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeHashtag(tag)}>
                        #{tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Media URLs */}
              <div>
                <Label>Media URLs</Label>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <Image className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="https://... (image or video URL)"
                      value={mediaUrlInput}
                      onChange={(e) => setMediaUrlInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMediaUrl(); } }}
                      className="pl-9"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={addMediaUrl}>Add</Button>
                </div>
                {formData.mediaUrls.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {formData.mediaUrls.map((url) => (
                      <div key={url} className="flex items-center gap-2 text-xs bg-muted p-2 rounded">
                        <span className="truncate flex-1">{url}</span>
                        <button onClick={() => removeMediaUrl(url)} className="text-destructive flex-shrink-0">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Target Accounts
              </CardTitle>
            </CardHeader>
            <CardContent>{renderAccountSelector()}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="scheduledFor">Publish Date &amp; Time</Label>
                <Input
                  id="scheduledFor"
                  type="datetime-local"
                  value={formData.scheduledFor}
                  min={toLocalDatetimeInputValue(new Date())}
                  onChange={(e) => setFormData((p) => ({ ...p, scheduledFor: e.target.value }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave empty to save as draft</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Button className="w-full" disabled={loading || isOverLimit} onClick={handlePublishNow}>
              <Send className="h-4 w-4 mr-2" />
              Publish Now
            </Button>
            {formData.scheduledFor && (
              <Button variant="outline" className="w-full" disabled={loading || isOverLimit} onClick={() => handleSubmit(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>
            )}
            <Button variant="outline" className="w-full" disabled={loading} onClick={() => handleSubmit(false)}>
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
