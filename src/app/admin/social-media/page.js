"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Share2,
  Users,
  FileText,
  Calendar,
  BarChart2,
  AlertCircle,
  CheckCircle,
  Inbox,
  Plus,
  Link2,
  ArrowRight,
  Loader2,
  TrendingUp,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { STATUS_COLORS } from "@/lib/social-clients/constants.js";
import AdminPageHeader from "@/components/AdminPageHeader";

export default function SocialMediaDashboardPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const [accountsRes, postsRes, analyticsRes, inboxRes] = await Promise.allSettled([
        fetch("/api/v1/social/accounts"),
        fetch("/api/v1/social/posts?limit=3"),
        fetch("/api/v1/social/analytics/posts"),
        fetch("/api/v1/social/inbox?status=Open&limit=1"),
      ]);

      if (accountsRes.status === "fulfilled" && accountsRes.value.ok) {
        const data = await accountsRes.value.json();
        setAccounts(data.accounts || []);
      }
      if (postsRes.status === "fulfilled" && postsRes.value.ok) {
        const data = await postsRes.value.json();
        setRecentPosts(data.posts || []);
      }
      if (analyticsRes.status === "fulfilled" && analyticsRes.value.ok) {
        const data = await analyticsRes.value.json();
        setAnalytics(data);
      }
      if (inboxRes.status === "fulfilled" && inboxRes.value.ok) {
        const data = await inboxRes.value.json();
        setInboxUnread(data.unread_total || 0);
      }
    } catch {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user, loadDashboard]);

  const activeAccounts = accounts.filter((a) => a.status === "Active");
  const scheduledPosts = recentPosts.filter((p) => p.status === "Scheduled").length;
  const failedPosts = analytics?.summary?.failed ?? 0;
  const totalPosts = analytics?.summary?.total_posts ?? 0;
  const publishedPosts = analytics?.summary?.published ?? 0;
  const successRate = totalPosts > 0 ? Math.round((publishedPosts / totalPosts) * 100) : 0;

  // ── Stat cards (4-column grid, consistent height) ──────────────────────
  const stats = [
    {
      title: "Connected Accounts",
      value: activeAccounts.length,
      sub: `${accounts.length} total`,
      icon: Users,
      href: "/admin/social-media/accounts",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "Total Posts",
      value: totalPosts,
      sub: `${publishedPosts} published`,
      icon: FileText,
      href: "/admin/social-media/posts",
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      title: "Scheduled",
      value: scheduledPosts,
      sub: scheduledPosts > 0 ? "Awaiting publish" : "No pending",
      icon: Clock,
      href: "/admin/social-media/calendar",
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    {
      title: "Unread Messages",
      value: inboxUnread,
      sub: inboxUnread > 0 ? "Needs attention" : "All caught up",
      icon: Inbox,
      href: "/admin/social-media/inbox",
      iconBg: "bg-red-50",
      iconColor: "text-red-600",
    },
  ];

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Social Media Manager"
          description="Manage and schedule posts across all platforms"
        />
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Social Media Manager"
        description="Manage and schedule posts across all platforms"
        actionLabel="Create Post"
        actionIcon={<Plus className="h-4 w-4" />}
        onAction={() => (window.location.href = "/admin/social-media/posts/create")}
        secondaryActionLabel="Connect Account"
        secondaryActionIcon={<Link2 className="h-4 w-4" />}
        onSecondaryAction={() => (window.location.href = "/admin/social-media/accounts")}
      />

      {/* ── Stats Grid (4 consistent cards) ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link href={stat.href} key={stat.title}>
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Two-column: Accounts + Recent Posts ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connected Accounts */}
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Connected Accounts</CardTitle>
              <CardDescription className="text-xs mt-1">
                {activeAccounts.length} active · {accounts.length} total
              </CardDescription>
            </div>
            <Link href="/admin/social-media/accounts">
              <Button variant="outline" size="sm" className="text-xs font-medium">
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="text-center py-8">
                <div className="p-3 rounded-full bg-muted w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                  <Share2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No accounts connected</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Connect your social platforms to start posting
                </p>
                <Link href="/admin/social-media/accounts">
                  <Button variant="outline" size="sm">
                    <Link2 className="h-3 w-3 mr-2" /> Connect Account
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {accounts.slice(0, 3).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {account.platform?.logoUrl ? (
                        <img
                          src={account.platform.logoUrl}
                          alt={account.platform.name}
                          className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Share2 className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{account.account_name}</p>
                        <p className="text-xs text-muted-foreground">{account.platform?.name}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        account.status === "Active"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : account.status === "Error"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                      }
                    >
                      {account.status}
                    </Badge>
                  </div>
                ))}
                {accounts.length > 3 && (
                  <Link href="/admin/social-media/accounts" className="block mt-1">
                    <div className="text-center py-2.5 text-sm font-medium text-primary hover:underline cursor-pointer rounded-lg hover:bg-primary/5 transition-colors">
                      + {accounts.length - 3} more accounts
                    </div>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Posts */}
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Recent Posts</CardTitle>
              <CardDescription className="text-xs mt-1">
                Latest {Math.min(recentPosts.length, 3)} · {publishedPosts} published this month
              </CardDescription>
            </div>
            <Link href="/admin/social-media/posts">
              <Button variant="outline" size="sm" className="text-xs font-medium">
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentPosts.length === 0 ? (
              <div className="text-center py-8">
                <div className="p-3 rounded-full bg-muted w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No posts yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Create your first post to get started
                </p>
                <Link href="/admin/social-media/posts/create">
                  <Button variant="outline" size="sm">
                    <Plus className="h-3 w-3 mr-2" /> Create Post
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentPosts.map((post) => (
                  <Link key={post.id} href={`/admin/social-media/posts/${post.id}`} className="block">
                    <div className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {post.title || post.content?.slice(0, 50) || "Untitled"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {post.scheduled_for
                            ? `Scheduled: ${new Date(post.scheduled_for).toLocaleDateString()}`
                            : post.published_at
                            ? `Published: ${new Date(post.published_at).toLocaleDateString()}`
                            : `Created: ${new Date(post.created_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ml-2 flex-shrink-0 ${
                          STATUS_COLORS[post.status] || "bg-gray-100 text-gray-700 border-gray-200"
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Platform Performance ────────────────────────────────────────── */}
      {analytics?.by_platform?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Platform Performance
            </CardTitle>
            <CardDescription className="text-xs">
              This month · {successRate}% success rate
              {failedPosts > 0 && (
                <span className="text-red-600 ml-2 inline-flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {failedPosts} failed
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {analytics.by_platform.map((p) => (
                <div
                  key={p.platform}
                  className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-sm">{p.platform}</p>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">Published</span>
                      <span className="text-xl font-bold text-green-600">{p.published}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">Total</span>
                      <span className="text-sm font-medium">{p.posts}</span>
                    </div>
                    {p.failed > 0 && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Failed</span>
                        <span className="text-sm font-medium text-red-600">{p.failed}</span>
                      </div>
                    )}
                  </div>
                  {/* Success bar */}
                  <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{
                        width: `${p.posts > 0 ? (p.published / p.posts) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick Actions ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/admin/social-media/posts/create">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Create Post</p>
                <p className="text-xs text-muted-foreground">Publish or schedule</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/social-media/calendar">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-orange-50">
                <Calendar className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Content Calendar</p>
                <p className="text-xs text-muted-foreground">View scheduled posts</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/social-media/analytics">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-50">
                <BarChart2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Analytics</p>
                <p className="text-xs text-muted-foreground">Track performance</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
