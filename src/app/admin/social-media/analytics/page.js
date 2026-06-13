"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BarChart2, Send, AlertCircle, TrendingUp, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";

export default function SocialAnalyticsPage() {
  const { user } = useAuth();
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = now.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const res = await fetch(`/api/v1/social/analytics/posts?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      setAnalytics(await res.json());
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [user, startDate, endDate]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const summary = analytics?.summary;
  const byPlatform = analytics?.by_platform || [];
  const posts = analytics?.posts || [];

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart2 className="h-6 w-6 text-primary" />Analytics
            </h1>
            <p className="text-muted-foreground mt-1">Post performance and insights</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAnalytics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Date range */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <Label htmlFor="start">From</Label>
                <Input id="start" type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-40" />
              </div>
              <div>
                <Label htmlFor="end">To</Label>
                <Input id="end" type="date" value={endDate} min={startDate} max={defaultEnd} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-40" />
              </div>
              <Button onClick={loadAnalytics} disabled={loading}>Apply</Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { title: "Total Posts", value: summary?.total_posts ?? 0, icon: TrendingUp, color: "text-blue-500" },
            { title: "Published", value: summary?.published ?? 0, icon: Send, color: "text-green-500" },
            { title: "Failed", value: summary?.failed ?? 0, icon: AlertCircle, color: "text-red-500" },
          ].map((stat) => (
            <Card key={stat.title}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold">{loading ? "—" : stat.value}</p>
                  </div>
                  <stat.icon className={`h-8 w-8 ${stat.color} opacity-70`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Platform breakdown */}
        {byPlatform.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance by Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {byPlatform.map((p) => (
                  <div key={p.platform} className="flex items-center gap-4">
                    <span className="w-28 text-sm font-medium capitalize">{p.platform}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: p.posts > 0 ? `${(p.published / p.posts) * 100}%` : "0%" }}
                      />
                    </div>
                    <div className="flex gap-3 text-xs min-w-24 text-right">
                      <span className="text-green-600">{p.published} published</span>
                      {p.failed > 0 && <span className="text-red-500">{p.failed} failed</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Published posts list */}
        {posts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Published Posts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {posts.map((post) => (
                  <div key={post.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{post.title || post.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {post.platforms?.map((code) => (
                        <Badge key={code} variant="secondary" className="text-xs capitalize">{code}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && posts.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">No data for this period</h3>
              <p className="text-sm text-muted-foreground">Publish posts to see analytics here</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
