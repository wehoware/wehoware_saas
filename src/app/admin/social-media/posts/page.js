"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, FileText, Calendar, Eye, Pencil, Trash2, Send, X } from "lucide-react";
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
import { STATUS_COLORS, POST_STATUSES } from "@/lib/social-clients/constants.js";

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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const LIMIT = 20;

  const loadPosts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
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
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [user, page, statusFilter, search]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  async function deletePost() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/v1/social/posts/${deleteTarget}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("Post deleted");
      setDeleteTarget(null);
      await loadPosts();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function publishPost(postId) {
    setPublishing(postId);
    try {
      const res = await fetch(`/api/v1/social/posts/${postId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      toast.success("Post published successfully!");
      await loadPosts();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPublishing(null);
    }
  }

  async function cancelPost() {
    if (!cancelTarget) return;
    try {
      const res = await fetch(`/api/v1/social/posts/${cancelTarget}/cancel`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Cancel failed");
      }
      toast.success("Post cancelled");
      setCancelTarget(null);
      await loadPosts();
    } catch (err) {
      toast.error(err.message);
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
              <Card key={post.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-start justify-between py-4">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
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
                    <p className="font-medium truncate">{post.title || post.content?.slice(0, 80)}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {post.scheduled_for && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.scheduled_for).toLocaleString()}
                        </span>
                      )}
                      <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
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
                      <Button variant="ghost" size="sm" disabled={publishing === post.id} onClick={() => publishPost(post.id)}>
                        <Send className={`h-4 w-4 ${publishing === post.id ? "animate-pulse" : ""}`} />
                      </Button>
                    )}
                    {post.status === "Scheduled" && (
                      <Button variant="ghost" size="sm" onClick={() => setCancelTarget(post.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {["Draft", "Scheduled", "Failed", "Cancelled", "Published", "PartiallyPublished"].includes(post.status) && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(post.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
          <AlertDialogDescription>
            {posts.find((p) => p.id === deleteTarget)?.status === "Published" || posts.find((p) => p.id === deleteTarget)?.status === "PartiallyPublished"
              ? "This will also attempt to delete the post from all connected platforms. This action cannot be undone."
              : "This action cannot be undone. The post will be permanently removed."}
          </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deletePost} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <AlertDialogAction onClick={cancelPost}>Yes, Cancel Post</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
