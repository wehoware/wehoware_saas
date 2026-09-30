"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Send, X, Pencil, Calendar, Hash, Image as ImageIcon, Share2, CheckCircle, AlertCircle, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { STATUS_COLORS, AP_STATUS_COLORS, DELETABLE_STATUSES } from "@/lib/social-clients/constants.js";
import MediaPreviewModal, { MediaThumbnail } from "@/components/ui/media-preview-modal";
import { toastError } from "@/lib/toast-error";

export default function PostDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const loadPost = useCallback(async (skipLoadingState = false) => {
    if (!params?.id) return;
    if (!skipLoadingState) setLoading(true);
    try {
      const res = await fetch(`/api/v1/social/posts/${params.id}`);
      if (!res.ok) { router.push("/admin/social-media/posts"); return; }
      const data = await res.json();
      setPost(data.post);
    } catch {
      // silent fail for polling
    } finally {
      setLoading(false);
    }
  }, [params?.id, router]);

  useEffect(() => {
    if (user) loadPost();
  }, [user, loadPost]);

  // Auto-poll when post is in a transitional state (Scheduled or Publishing)
  // so the UI updates without manual refresh
  useEffect(() => {
    if (!post?.id) return;
    const transitional = ["Scheduled", "Publishing"].includes(post.status);
    if (!transitional) return;
    const interval = setInterval(() => loadPost(true), 5000); // poll every 5s, no loading flash
    return () => clearInterval(interval);
  }, [post?.id, post?.status, loadPost]);

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/v1/social/posts/${params.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      toast.success("Post published!");
      loadPost();
    } catch (err) {
      toastError(err, "Failed to publish post");
    } finally {
      setPublishing(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/v1/social/posts/${params.id}/cancel`, { method: "POST" });
      if (!res.ok) {
        let errorMsg = "Failed to cancel post";
        try {
          const d = await res.json();
          errorMsg = d.error || errorMsg;
        } catch {
          // Response body is not JSON, use status text
          errorMsg = res.statusText || errorMsg;
        }
        throw new Error(errorMsg);
      }
      toast.success("Post cancelled");
      setCancelTarget(false);
      loadPost();
    } catch (err) {
      toastError(err, "Failed to cancel post");
      setCancelTarget(false);
    } finally {
      setCancelling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/social/posts/${post.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete post");
      }
      toast.success("Post deleted");
      router.push("/admin/social-media/posts");
    } catch (err) {
      toastError(err, "Failed to delete post");
      setDeleteTarget(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
      </div>
    );
  }
  if (!post) {
    return <div className="text-center py-12 text-muted-foreground">Post not found</div>;
  }

  const canEdit = ["Draft", "Scheduled"].includes(post.status);
  const canPublish = ["Draft", "Failed"].includes(post.status);
  const canCancel = post.status === "Scheduled";
  const canDelete = DELETABLE_STATUSES.has(post.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/social-media/posts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Post Details</h1>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link href={`/admin/social-media/posts/${post.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-2" />Edit
              </Button>
            </Link>
          )}
          {canPublish && (
            <Button size="sm" disabled={publishing} onClick={handlePublish}>
              <Send className="h-4 w-4 mr-2" />
              {publishing ? "Publishing..." : "Publish Now"}
            </Button>
          )}
          {canCancel && (
            <Button variant="outline" size="sm" disabled={cancelling} onClick={() => setCancelTarget(true)}>
              {cancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}Cancel
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" disabled={deleting} className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setDeleteTarget(true)}>
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}Delete
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className={STATUS_COLORS[post.status]}>{post.status}</Badge>
                <Badge variant="outline">{post.post_type}</Badge>
              </div>
            </div>
            {post.scheduled_for && (
              <div className="text-right text-sm flex-shrink-0">
                <p className="text-muted-foreground text-xs">Scheduled for</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(post.scheduled_for).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Content</p>
            <p className="whitespace-pre-wrap text-sm bg-muted/50 p-3 rounded-lg">{post.content}</p>
          </div>
          {post.hashtags?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Hash className="h-3 w-3" /> Hashtags
              </p>
              <div className="flex flex-wrap gap-1">
                {post.hashtags.map((tag) => (
                  <Badge key={tag} variant="secondary">#{tag}</Badge>
                ))}
              </div>
            </div>
          )}
          {post.media_urls?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> Media ({post.media_urls.length})
              </p>
              <div className="flex flex-wrap gap-3">
                {post.media_urls.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setPreviewUrl(url)}
                    title="Preview"
                    className="block cursor-zoom-in"
                  >
                    <MediaThumbnail url={url} className="h-24 w-24" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {post.account_posts?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4" />Platform Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {post.account_posts.map((ap) => (
                <div key={ap.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    {ap.account?.platform?.logoUrl
                      ? <img src={ap.account.platform.logoUrl} alt={ap.account.platform.name} className="w-5 h-5 rounded object-contain" />
                      : <Share2 className="w-5 h-5 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium">{ap.account?.account_name}</p>
                      <p className="text-xs text-muted-foreground">{ap.account?.platform?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`${AP_STATUS_COLORS[ap.status] || ""} flex items-center gap-1`}>
                      {ap.status === "Published" && <CheckCircle className="h-3 w-3" />}
                      {ap.status === "Failed" && <AlertCircle className="h-3 w-3" />}
                      {ap.status}
                    </Badge>
                    {ap.platform_url && (
                      <a href={ap.platform_url} target="_blank" rel="noreferrer" className="text-xs text-primary block mt-0.5">
                        View on platform →
                      </a>
                    )}
                    {ap.status === "Failed" && (
                      <p className="text-xs text-red-500 mt-0.5 text-right">
                        Publishing failed on this platform
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground">
        Created {new Date(post.created_at).toLocaleString()} · Updated {new Date(post.updated_at).toLocaleString()}
      </div>

      <AlertDialog open={cancelTarget} onOpenChange={() => setCancelTarget(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Scheduled Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the scheduled publish. The post will remain as a Cancelled draft and can be deleted afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Scheduled</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Yes, Cancel Post</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTarget} onOpenChange={() => setDeleteTarget(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the post record and its history here — it cannot be undone.
              <span className="block mt-2 font-medium">
                Note: already-published posts on Instagram/TikTok cannot be removed via API — delete them in the app itself.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MediaPreviewModal
        url={previewUrl}
        open={!!previewUrl}
        onOpenChange={(open) => !open && setPreviewUrl(null)}
      />
    </div>
  );
}
