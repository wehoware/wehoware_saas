"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, FileText, Calendar, Eye, Pencil, Send, X, Trash2, Hash, Image as ImageIcon, Share2, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
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
import { STATUS_COLORS, AP_STATUS_COLORS, POST_STATUSES, DELETABLE_STATUSES } from "@/lib/social-clients/constants.js";
import MediaPreviewModal, { MediaThumbnail } from "@/components/ui/media-preview-modal";
import { toastError } from "@/lib/toast-error";

const STATUSES = ["", ...POST_STATUSES];

export default function SocialPostsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [publishing, setPublishing] = useState(() => new Set());
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancellingIds, setCancellingIds] = useState(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingIds, setDeletingIds] = useState(() => new Set());
  const [previewUrl, setPreviewUrl] = useState(null);
  const LIMIT = 20;

  const loadPosts = useCallback(async (skipLoadingState = false) => {
    if (!user) return;
    if (!skipLoadingState) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/v1/social/posts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPosts(data.posts || []);
      setTotal(data.total || 0);
    } catch {
      if (!skipLoadingState) toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [user, page, statusFilter, search]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // Auto-poll when any post is in a transitional state (Scheduled or Publishing)
  useEffect(() => {
    const hasTransitional = posts.some((p) => ["Scheduled", "Publishing"].includes(p.status));
    if (!hasTransitional) return;
    const interval = setInterval(() => loadPosts(true), 10000); // poll every 10s, no loading flash
    return () => clearInterval(interval);
  }, [posts, loadPosts]);

  async function publishPost(postId) {
    setPublishing((prev) => new Set(prev).add(postId));
    try {
      const res = await fetch(`/api/v1/social/posts/${postId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      toast.success("Post published successfully!");
      await loadPosts(true);
    } catch (err) {
      toastError(err, "Failed to publish post");
    } finally {
      setPublishing((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  }

  async function cancelPost(postId) {
    setCancellingIds((prev) => new Set(prev).add(postId));
    try {
      const res = await fetch(`/api/v1/social/posts/${postId}/cancel`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Cancel failed");
      }
      toast.success("Post cancelled");
      await loadPosts();
    } catch (err) {
      toastError(err, "Failed to cancel post");
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  }

  async function deletePost(postId) {
    setDeletingIds((prev) => new Set(prev).add(postId));
    try {
      const res = await fetch(`/api/v1/social/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      toast.success("Post deleted");
      await loadPosts();
    } catch (err) {
      toastError(err, "Failed to delete post");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  // Debounced search: update `search` (which triggers fetch) 500ms after typing stops
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Posts</h1>
            <p className="text-muted-foreground mt-1">{total} total posts</p>
          </div>
          <Link href="/admin/social-media/posts/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Post
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search posts..." className="pl-9" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.filter(Boolean).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">No posts found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {statusFilter ? `No ${statusFilter} posts` : "Create your first post to get started"}
              </p>
              <Link href="/admin/social-media/posts/create">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Post
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Card key={post.id} className="hover:shadow-sm transition-shadow overflow-hidden">
                <CardContent className="p-0 flex flex-col md:flex-row overflow-hidden">
                  {/* ── Left: Media pane ─────────────────────────────── */}
                  <div className="md:w-56 lg:w-64 flex-shrink-0 bg-muted/40 border-b md:border-b-0 md:border-r">
                    {post.media_urls?.length > 0 ? (
                      <div className="p-3 space-y-2">
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(post.media_urls[0])}
                          title="Preview media"
                          className="block w-full cursor-zoom-in"
                        >
                          <MediaThumbnail url={post.media_urls[0]} className="w-full aspect-video md:aspect-square h-auto rounded-lg" />
                        </button>
                        {post.media_urls.length > 1 && (
                          <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {post.media_urls.slice(1).map((url, i) => (
                              <button
                                key={url + i}
                                type="button"
                                onClick={() => setPreviewUrl(url)}
                                title="Preview media"
                                className="cursor-zoom-in flex-shrink-0"
                              >
                                <MediaThumbnail url={url} className="h-11 w-11" />
                              </button>
                            ))}
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {post.media_urls.length} file{post.media_urls.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    ) : (
                      <div className="h-full min-h-24 flex flex-col items-center justify-center text-muted-foreground/60 gap-1.5 p-3">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-xs italic">no media</span>
                      </div>
                    )}
                  </div>

                  {/* ── Right: Details pane ──────────────────────────── */}
                  <div className="flex-1 min-w-0 p-4 space-y-3">
                    {/* Header: badges + actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <Badge variant="outline" className={STATUS_COLORS[post.status] || ""}>
                          {post.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {post.post_type}
                        </Badge>
                        {post.platforms?.map((code) => (
                          <Badge key={code} variant="secondary" className="text-xs capitalize">{code}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Link href={`/admin/social-media/posts/${post.id}`}>
                          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        {(post.status === "Draft" || post.status === "Scheduled") && (
                          <Link href={`/admin/social-media/posts/${post.id}/edit`}>
                            <Button variant="ghost" size="sm"><Pencil className="h-4 w-4" /></Button>
                          </Link>
                        )}
                        {(post.status === "Draft" || post.status === "Failed") && (
                          <Button variant="ghost" size="sm" disabled={publishing.has(post.id)} onClick={() => publishPost(post.id)}>
                            <Send className={`h-4 w-4 ${publishing.has(post.id) ? "animate-pulse" : ""}`} />
                          </Button>
                        )}
                        {post.status === "Scheduled" && (
                          <Button variant="ghost" size="sm" disabled={cancellingIds.has(post.id)} onClick={() => setCancelTarget(post.id)}>
                            {cancellingIds.has(post.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {DELETABLE_STATUSES.has(post.status) && (
                          <Button variant="ghost" size="sm" disabled={deletingIds.has(post.id)} className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setDeleteTarget(post.id)}>
                            {deletingIds.has(post.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Full content */}
                    <div className="flex items-start gap-2 text-xs">
                      <span className="w-16 flex-shrink-0 font-medium text-muted-foreground pt-2">Text:</span>
                      <p className="flex-1 text-sm whitespace-pre-wrap break-words bg-muted/50 p-2.5 rounded-lg min-w-0 max-h-40 overflow-y-auto">
                        {post.content}
                      </p>
                    </div>

                    {/* Hashtags */}
                    <div className="flex items-start gap-2 text-xs">
                      <span className="w-16 flex-shrink-0 font-medium text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" /> Tags:
                      </span>
                      {post.hashtags?.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {post.hashtags.map((tag) => (
                            <Badge key={tag} variant="secondary">#{tag}</Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/70 italic">none</span>
                      )}
                    </div>

                    {/* Per-account platform status */}
                    <div className="flex items-start gap-2 text-xs">
                      <span className="w-16 flex-shrink-0 font-medium text-muted-foreground flex items-center gap-1 pt-2">
                        <Share2 className="h-3 w-3" /> Targets:
                      </span>
                      {post.account_posts?.length > 0 ? (
                        <div className="flex-1 space-y-2 min-w-0">
                          {post.account_posts.map((ap) => (
                            <div key={ap.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 gap-2 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                {ap.account?.platform?.logoUrl
                                  ? <img src={ap.account.platform.logoUrl} alt={ap.account.platform.name} className="w-4 h-4 rounded object-contain flex-shrink-0" />
                                  : <Share2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                                <span className="text-xs font-medium truncate">{ap.account?.account_name}</span>
                                <span className="text-xs text-muted-foreground truncate">{ap.account?.platform?.name}</span>
                              </div>
                              <div className="text-right flex-shrink-0 min-w-0 max-w-[50%]">
                                <Badge variant="outline" className={`${AP_STATUS_COLORS[ap.status] || ""} flex items-center gap-1 text-[10px]`}>
                                  {ap.status === "Published" && <CheckCircle className="h-3 w-3" />}
                                  {ap.status === "Failed" && <AlertCircle className="h-3 w-3" />}
                                  {ap.status}
                                </Badge>
                                {ap.platform_url && (
                                  <a href={ap.platform_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary block mt-0.5">
                                    View on platform →
                                  </a>
                                )}
                                {ap.status === "Failed" && (
                                  <p className="text-[10px] text-red-500 mt-0.5 text-right">
                                    Publishing failed on this platform
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/70 italic pt-2">none</span>
                      )}
                    </div>

                    {/* Dates footer */}
                    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-muted-foreground border-t pt-2.5">
                      {post.scheduled_for && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Scheduled: {new Date(post.scheduled_for).toLocaleString()}
                        </span>
                      )}
                      {post.published_at && (
                        <span>Published: {new Date(post.published_at).toLocaleString()}</span>
                      )}
                      <span>Created: {new Date(post.created_at).toLocaleString()}</span>
                      <span>Updated: {new Date(post.updated_at).toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} posts)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <MediaPreviewModal
        url={previewUrl}
        open={!!previewUrl}
        onOpenChange={(open) => !open && setPreviewUrl(null)}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Scheduled Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the scheduled publish. The post will remain as a Cancelled draft and can be deleted afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Scheduled</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelPost(cancelTarget)}>
              Yes, Cancel Post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
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
              onClick={() => deletePost(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
