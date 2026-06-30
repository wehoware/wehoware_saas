"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, Users, FileText, Calendar, BarChart2, AlertCircle, CheckCircle, Inbox } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { STATUS_COLORS } from "@/lib/social-clients/constants.js";

export default function SocialMediaDashboardPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsRes, postsRes, analyticsRes, inboxRes] = await Promise.allSettled([
        fetch("/api/v1/social/accounts"),
        fetch("/api/v1/social/posts?limit=5"),
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

  const stats = [
    { title: "Connected Accounts", value: activeAccounts.length, icon: Users, href: "/admin/social-media/accounts", color: "text-blue-500" },
    { title: "Total Posts", value: analytics?.summary?.total_posts ?? 0, icon: FileText, href: "/admin/social-media/posts", color: "text-green-500" },
    { title: "Scheduled", value: scheduledPosts, icon: Calendar, href: "/admin/social-media/calendar", color: "text-orange-500" },
    { title: "Published", value: analytics?.summary?.published ?? 0, icon: CheckCircle, href: "/admin/social-media/posts", color: "text-purple-500" },
    { title: "Unread Messages", value: inboxUnread, icon: Inbox, href: "/admin/social-media/inbox", color: "text-red-500" },
  ];

  function renderAccountList() {
    if (loading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
        </div>
      );
    }
    if (accounts.length === 0) {
      return (
        <div className="text-center py-6">
          <Share2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No accounts connected yet</p>
          <Link href="/admin/social-media/accounts">
            <Button variant="outline" size="sm" className="mt-2">Connect Account</Button>
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {accounts.slice(0, 5).map((account) => (
          <div key={account.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
            <div className="flex items-center gap-2">
              {account.platform?.logoUrl
                ? <img src={account.platform.logoUrl} alt={account.platform.name} className="w-5 h-5 rounded" />
                : <Share2 className="w-5 h-5 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">{account.account_name}</p>
                <p className="text-xs text-muted-foreground">{account.platform?.name}</p>
              </div>
            </div>
            <Badge
              className={account.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}
              variant="outline"
            >
              {account.status}
            </Badge>
          </div>
        ))}
      </div>
    );
  }

  function renderPostList() {
    if (loading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
        </div>
      );
    }
    if (recentPosts.length === 0) {
      return (
        <div className="text-center py-6">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No posts yet</p>
          <Link href="/admin/social-media/posts/create">
            <Button variant="outline" size="sm" className="mt-2">Create First Post</Button>
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {recentPosts.map((post) => (
          <Link key={post.id} href={`/admin/social-media/posts/${post.id}`}>
            <div className="flex items-start justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{post.title || post.content?.slice(0, 50)}</p>
                <p className="text-xs text-muted-foreground">
                  {post.scheduled_for
                    ? `Scheduled: ${new Date(post.scheduled_for).toLocaleDateString()}`
                    : new Date(post.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${STATUS_COLORS[post.status] || ""}`}>
                {post.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" />
            Social Media Manager
          </h1>
          <p className="text-muted-foreground mt-1">Manage and schedule posts across all platforms</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/social-media/inbox">
            <Button variant="outline" className="relative">
              <Inbox className="h-4 w-4 mr-2" />
              Inbox
              {inboxUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {inboxUnread > 9 ? "9+" : inboxUnread}
                </span>
              )}
            </Button>
          </Link>
          <Link href="/admin/social-media/posts/create">
            <Button>Create Post</Button>
          </Link>
          <Link href="/admin/social-media/accounts">
            <Button variant="outline">Connect Account</Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Link href={stat.href} key={stat.title}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1">{loading ? "—" : stat.value}</p>
                  </div>
                  <stat.icon className={`h-8 w-8 ${stat.color} opacity-70`} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connected Accounts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Connected Accounts</CardTitle>
            <Link href="/admin/social-media/accounts">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>{renderAccountList()}</CardContent>
        </Card>

        {/* Recent Posts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Posts</CardTitle>
            <Link href="/admin/social-media/posts">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>{renderPostList()}</CardContent>
        </Card>
      </div>

      {/* Platform Analytics Summary */}
      {analytics?.by_platform?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Platform Performance (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {analytics.by_platform.map((p) => (
                <div key={p.platform} className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-sm">{p.platform}</p>
                  <p className="text-2xl font-bold text-primary">{p.published}</p>
                  <p className="text-xs text-muted-foreground">{p.posts} total posts</p>
                  {p.failed > 0 && (
                    <p className="text-xs text-red-500 flex items-center justify-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {p.failed} failed
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
