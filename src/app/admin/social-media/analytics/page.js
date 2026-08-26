"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  BarChart2,
  Send,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  FileText,
  Loader2,
  Calendar,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { STATUS_COLORS } from "@/lib/social-clients/constants.js";
import AdminPageHeader from "@/components/AdminPageHeader";
import DatePicker from "@/components/ui/date-picker";

// ── Date presets ──────────────────────────────────────────────────────────
const DATE_PRESETS = [
  { label: "Today", get: () => { const d = new Date(); const s = d.toISOString().slice(0, 10); return { start: s, end: s }; } },
  { label: "Yesterday", get: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = d.toISOString().slice(0, 10); return { start: s, end: s }; } },
  { label: "Last 7 days", get: () => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 6); return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) }; } },
  { label: "Last 30 days", get: () => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 29); return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) }; } },
  { label: "This Month", get: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); const e = d.toISOString().slice(0, 10); return { start: s, end: e }; } },
  { label: "Last Month", get: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10); const e = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10); return { start: s, end: e }; } },
];

function formatRangeLabel(start, end) {
  const fmt = (s) => new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (start === end) return fmt(start);
  return `${fmt(start)} → ${fmt(end)}`;
}

export default function SocialAnalyticsPage() {
  const { user } = useAuth();
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = now.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState("This Month");

  function applyPreset(preset) {
    const { start, end } = preset.get();
    setStartDate(start);
    setEndDate(end);
    setActivePreset(preset.label);
  }

  function isPresetActive(preset) {
    return activePreset === preset.label;
  }

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
  const successRate = summary && summary.total_posts > 0
    ? Math.round((summary.published / summary.total_posts) * 100)
    : 0;

  // ── Stat cards ──────────────────────────────────────────────────────────
  const stats = [
    {
      title: "Total Posts",
      value: summary?.total_posts ?? 0,
      sub: "In selected period",
      icon: FileText,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "Published",
      value: summary?.published ?? 0,
      sub: `${successRate}% success rate`,
      icon: CheckCircle2,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      title: "Failed",
      value: summary?.failed ?? 0,
      sub: summary?.failed > 0 ? "Needs attention" : "All good",
      icon: AlertCircle,
      iconBg: "bg-red-50",
      iconColor: "text-red-600",
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Analytics"
        description="Post performance and insights across platforms"
        actionLabel="Refresh"
        actionIcon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />}
        onAction={loadAnalytics}
        actionDisabled={loading}
      />

      {/* ── Date Range Filter ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date Range
          </CardTitle>
          <CardDescription className="text-xs">
            Filter analytics by publish date
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((preset) => {
              const isActive = isPresetActive(preset);
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground font-medium">OR CUSTOM</span>
            <div className="h-px bg-border flex-1" />
          </div>

          {/* Custom date pickers + Apply */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col">
              <Label className="text-xs text-muted-foreground mb-1.5">From</Label>
              <DatePicker
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setActivePreset(null); }}
                placeholder="Start date"
                className="w-48"
              />
            </div>
            {/* Arrow connector */}
            <div className="hidden sm:flex items-center -mt-1">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <Label className="text-xs text-muted-foreground mb-1.5">To</Label>
              <DatePicker
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setActivePreset(null); }}
                placeholder="End date"
                className="w-48"
              />
            </div>
            <Button onClick={loadAnalytics} disabled={loading} className="h-10">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
              Apply
            </Button>
          </div>

          {/* Active range display */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              Showing: <span className="font-medium text-foreground">{formatRangeLabel(startDate, endDate)}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Loading state ────────────────────────────────────────────────── */}
      {loading && !analytics ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── Summary Stats (3 consistent cards) ────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((stat) => (
              <Card key={stat.title} className="h-full">
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
            ))}
          </div>

          {/* ── Platform Performance ──────────────────────────────────────── */}
          {byPlatform.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" />
                  Performance by Platform
                </CardTitle>
                <CardDescription className="text-xs">
                  Publish success rate per platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {byPlatform.map((p) => {
                    const rate = p.posts > 0 ? Math.round((p.published / p.posts) * 100) : 0;
                    return (
                      <div
                        key={p.platform}
                        className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-medium text-sm capitalize">{p.platform}</p>
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
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 text-right">{rate}% success</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Published Posts List ──────────────────────────────────────── */}
          {posts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Published Posts</CardTitle>
                <CardDescription className="text-xs">
                  {posts.length} posts in selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {posts.map((post) => (
                    <Link key={post.id} href={`/admin/social-media/posts/${post.id}`} className="block">
                      <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {post.title || post.content?.slice(0, 60) || "Untitled"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {post.published_at
                              ? new Date(post.published_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : ""}
                          </p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          {post.platforms?.map((code) => (
                            <Badge key={code} variant="secondary" className="text-xs capitalize">
                              {code}
                            </Badge>
                          ))}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                          STATUS_COLORS[post.status] || "bg-gray-100 text-gray-700 border-gray-200"
                        }`}>
                          {post.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Empty State ───────────────────────────────────────────────── */}
          {!loading && posts.length === 0 && byPlatform.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <BarChart2 className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">No data for this period</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Publish posts to see analytics here
                </p>
                <Link href="/admin/social-media/posts/create">
                  <Button variant="outline" size="sm">
                    Create Post <ArrowRight className="h-3 w-3 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
