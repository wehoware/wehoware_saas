"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Calendar, Hash, Share2, Upload, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  PLATFORM_CHAR_LIMITS,
  POST_TYPES,
  PLATFORMS_REQUIRING_MEDIA,
  toLocalDatetimeInputValue,
} from "@/lib/social-clients/constants.js";
import DateTimePicker from "@/components/ui/date-time-picker";
import MediaPreviewModal, { MediaThumbnail } from "@/components/ui/media-preview-modal";
import PostPreview from "@/components/social/post-preview";
import { toastError } from "@/lib/toast-error";

export default function EditPostPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [formData, setFormData] = useState({
    content: "", mediaUrls: [], hashtags: [],
    scheduledFor: "", postType: "Text", targetAccounts: [],
  });
  const [hashtagInput, setHashtagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const loadData = useCallback(async () => {
    if (!params?.id) return;
    setInitialLoading(true);
    try {
      const [postRes, accountsRes] = await Promise.all([
        fetch(`/api/v1/social/posts/${params.id}`),
        fetch("/api/v1/social/accounts?status=Active"),
      ]);
      if (!postRes.ok) { router.push("/admin/social-media/posts"); return; }
      const { post } = await postRes.json();
      if (!["Draft", "Scheduled"].includes(post.status)) {
        toast.error(`Cannot edit a ${post.status} post`);
        router.push(`/admin/social-media/posts/${params.id}`);
        return;
      }
      setFormData({
        content: post.content || "",
        mediaUrls: post.media_urls || [],
        hashtags: post.hashtags || [],
        scheduledFor: post.scheduled_for
          ? toLocalDatetimeInputValue(new Date(post.scheduled_for))
          : "",
        postType: post.post_type || "Text",
        targetAccounts: post.target_accounts || [],
      });
      if (accountsRes.ok) setAccounts((await accountsRes.json()).accounts || []);
    } catch {
      toast.error("Failed to load post");
    } finally {
      setInitialLoading(false);
    }
  }, [params?.id, router]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  function toggleAccount(id) {
    setFormData((p) => ({
      ...p,
      targetAccounts: p.targetAccounts.includes(id)
        ? p.targetAccounts.filter((a) => a !== id)
        : [...p.targetAccounts, id],
    }));
  }

  function addHashtag() {
    const tag = hashtagInput.replace(/^#/, "").trim();
    if (!tag || formData.hashtags.includes(tag)) return;
    setFormData((p) => ({ ...p, hashtags: [...p.hashtags, tag] }));
    setHashtagInput("");
  }

  function removeHashtag(tag) {
    setFormData((p) => ({ ...p, hashtags: p.hashtags.filter((t) => t !== tag) }));
  }

  function removeMediaUrl(url) {
    setFormData((p) => ({ ...p, mediaUrls: p.mediaUrls.filter((u) => u !== url) }));
  }

  async function handleMediaUpload(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("entityType", "social");
        const res = await fetch("/api/v1/uploads", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }
        setFormData((p) =>
          p.mediaUrls.includes(data.url)
            ? p
            : { ...p, mediaUrls: [...p.mediaUrls, data.url] }
        );
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(schedule = false) {
    if (!formData.content.trim()) { toast.error("Content is required"); return; }
    if (schedule && !formData.scheduledFor) { toast.error("Schedule date/time is required"); return; }

    // Validate media requirements for platforms like Instagram and TikTok
    const selectedPlatformCodes = selectedAccounts.map((a) => a.platform?.platformCode).filter(Boolean);
    const needsMedia = selectedPlatformCodes.some((code) => PLATFORMS_REQUIRING_MEDIA.has(code));
    if (needsMedia && formData.mediaUrls.length === 0) {
      toast.error("Instagram and TikTok require at least one media URL");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/social/posts/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: formData.content,
          media_urls: formData.mediaUrls,
          hashtags: formData.hashtags,
          scheduled_for: schedule && formData.scheduledFor ? formData.scheduledFor : undefined,
          post_type: formData.postType,
          target_accounts: formData.targetAccounts,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast.success(schedule ? "Post scheduled!" : "Post updated");
      router.push(`/admin/social-media/posts/${params.id}`);
    } catch (err) {
      toastError(err, "Failed to update post");
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
      </div>
    );
  }

  const selectedAccounts = accounts.filter((a) => formData.targetAccounts.includes(a.id));
  const minCharLimit = selectedAccounts.length > 0
    ? Math.min(...selectedAccounts.map((a) => PLATFORM_CHAR_LIMITS[a.platform?.platformCode] || 10000))
    : 10000;
  const isOverLimit = formData.content.length > minCharLimit;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/social-media/posts/${params.id}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        </Link>
        <h1 className="text-2xl font-bold">Edit Post</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Post Content</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="content">Content *</Label>
                  <span className={`text-xs ${isOverLimit ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                    {formData.content.length}{minCharLimit < 10000 ? ` / ${minCharLimit}` : ""}
                  </span>
                </div>
                <Textarea id="content" value={formData.content} rows={6}
                  onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                  className={isOverLimit ? "border-red-500" : ""} />
              </div>
              <div>
                <Label>Post Type</Label>
                <Select value={formData.postType} onValueChange={(v) => setFormData((p) => ({ ...p, postType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hashtags</Label>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={hashtagInput}
                      onChange={(e) => setHashtagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHashtag(); } }}
                      placeholder="Add hashtag..." className="pl-9" />
                  </div>
                  <Button type="button" variant="outline" onClick={addHashtag}>Add</Button>
                </div>
                {formData.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.hashtags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer"
                        onClick={() => removeHashtag(tag)}>
                        #{tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Media URLs</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleMediaUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full mt-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1.5" />
                  )}
                  {uploading ? "Uploading..." : "Upload images or videos"}
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Select image or video files from your device.
                </p>
                {formData.mediaUrls.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {formData.mediaUrls.map((url) => (
                      <div key={url} className="flex items-center gap-2 text-xs bg-muted p-2 rounded">
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(url)}
                          title="Preview"
                          className="flex-shrink-0 cursor-zoom-in"
                        >
                          <MediaThumbnail url={url} className="h-7 w-7" />
                        </button>
                        <span className="truncate flex-1">{url}</span>
                        <button onClick={() => removeMediaUrl(url)} className="text-destructive">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <PostPreview
            accounts={selectedAccounts}
            content={formData.content}
            hashtags={formData.hashtags}
            mediaUrls={formData.mediaUrls}
            postType={formData.postType}
            scheduledFor={formData.scheduledFor}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 className="h-4 w-4" />Target Accounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {accounts.length === 0
                ? <p className="text-sm text-muted-foreground">No connected accounts</p>
                : (
                  <div className="space-y-2">
                    {accounts.map((account) => (
                      <div key={account.id} className="flex items-center gap-2">
                        <Checkbox id={`acc-${account.id}`}
                          checked={formData.targetAccounts.includes(account.id)}
                          onCheckedChange={() => toggleAccount(account.id)} />
                        <label htmlFor={`acc-${account.id}`} className="flex items-center gap-2 cursor-pointer text-sm flex-1">
                          {account.platform?.logoUrl
                            ? <img src={account.platform.logoUrl} alt="" className="w-4 h-4 rounded" />
                            : <Share2 className="w-4 h-4" />}
                          <span className="truncate">{account.account_name}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="scheduledFor">Publish Date &amp; Time</Label>
              <DateTimePicker
                value={formData.scheduledFor}
                onChange={(e) => setFormData((p) => ({ ...p, scheduledFor: e.target.value }))}
                min={new Date()}
                placeholder="Pick a date & time"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">Clear to save as draft</p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {formData.scheduledFor && (
              <Button className="w-full" disabled={loading || isOverLimit} onClick={() => handleSave(true)}>
                <Calendar className="h-4 w-4 mr-2" />Update Schedule
              </Button>
            )}
            <Button variant="outline" className="w-full" disabled={loading} onClick={() => handleSave(false)}>
              <Save className="h-4 w-4 mr-2" />Save Changes
            </Button>
          </div>
        </div>
      </div>

      <MediaPreviewModal
        url={previewUrl}
        open={!!previewUrl}
        onOpenChange={(open) => !open && setPreviewUrl(null)}
      />
    </div>
  );
}
