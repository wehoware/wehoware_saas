"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, AlertCircle, CheckCircle2, Wrench, Activity } from "lucide-react";
import IssueAccordion from "./IssueAccordion";
import SuggestionReview from "./SuggestionReview";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "react-hot-toast";

export default function AnalyserDashboard() {
  const { user, activeClient } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [issues, setIssues] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/seo-analyser/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      const data = await res.json();
      setDashboard(data.data);
    } catch {
      toast.error("Failed to load dashboard");
    }
  }, []);

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/seo-analyser/issues?status=open&limit=50");
      if (!res.ok) throw new Error("Failed to fetch issues");
      const data = await res.json();
      setIssues(data.data);
    } catch {
      toast.error("Failed to load issues");
    }
  }, []);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/seo-analyser/suggestions?status=pending&limit=50");
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      const data = await res.json();
      setSuggestions(data.data);
    } catch {
      toast.error("Failed to load suggestions");
    }
  }, []);

  useEffect(() => {
    if (user && activeClient?.id) {
      Promise.all([fetchDashboard(), fetchIssues(), fetchSuggestions()]).finally(() => setLoading(false));
    } else if (user && !activeClient?.id) {
      setLoading(false);
    }
  }, [user, activeClient?.id, fetchDashboard, fetchIssues, fetchSuggestions]);

  const handleDismissIssue = async (issueId) => {
    try {
      const res = await fetch("/api/v1/seo-analyser/issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueIds: [issueId], status: "dismissed" }),
      });
      if (!res.ok) throw new Error("Failed to dismiss issue");
      toast.success("Issue dismissed");
      fetchIssues();
      fetchDashboard();
    } catch {
      toast.error("Failed to dismiss issue");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeClient?.id) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please select a client to view the SEO dashboard.
      </div>
    );
  }

  if (!dashboard) {
    return <div className="text-center py-12 text-muted-foreground">No data available</div>;
  }

  const { issues: issueStats, severityBreakdown, topCategories, suggestions: sugStats, recentRuns, scoreTrend, perTypeSummary } = dashboard;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Issues</CardDescription>
            <CardTitle className="text-2xl">{issueStats.open}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span className="text-muted-foreground">{issueStats.total} total</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resolved</CardDescription>
            <CardTitle className="text-2xl text-green-600">{issueStats.resolved}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">issues fixed</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Suggestions</CardDescription>
            <CardTitle className="text-2xl">{sugStats.pending}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm">
              <Wrench className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground">{sugStats.applied} applied</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Runs</CardDescription>
            <CardTitle className="text-2xl">{recentRuns.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm">
              <Activity className="h-4 w-4 text-purple-500" />
              <span className="text-muted-foreground">recent scans</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">Issues ({issueStats.open})</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions ({sugStats.pending})</TabsTrigger>
          <TabsTrigger value="runs">Recent Runs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Severity Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(severityBreakdown).map(([severity, count]) => (
                    <div key={severity} className="flex items-center justify-between">
                      <Badge className={
                        severity === "critical" || severity === "high" ? "bg-red-100 text-red-700" :
                        severity === "warning" || severity === "medium" ? "bg-yellow-100 text-yellow-700" :
                        "bg-blue-100 text-blue-700"
                      }>
                        {severity}
                      </Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                  {Object.keys(severityBreakdown).length === 0 && (
                    <p className="text-sm text-muted-foreground">No issues to display</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top Issue Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topCategories.map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{cat.category.replace(/_/g, " ")}</span>
                      <Badge variant="secondary">{cat.count}</Badge>
                    </div>
                  ))}
                  {topCategories.length === 0 && (
                    <p className="text-sm text-muted-foreground">No issues to display</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Per-type summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Content Type Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {perTypeSummary.map((summary) => (
                  <div key={summary.itemType} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-medium capitalize">{summary.itemType}</p>
                      <p className="text-xs text-muted-foreground">{summary.totalRuns} runs</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{summary.openIssues} open</Badge>
                      {summary.criticalIssues > 0 && (
                        <Badge className="bg-red-100 text-red-700">{summary.criticalIssues} critical</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Score trend */}
          {scoreTrend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Score Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {scoreTrend.slice(-10).map((run, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-20">{new Date(run.createdAt).toLocaleDateString()}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs">{run.scoreBefore ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <Badge className={
                          (run.scoreAfter ?? 0) >= 80 ? "bg-green-100 text-green-700" :
                          (run.scoreAfter ?? 0) >= 60 ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }>
                          {run.scoreAfter ?? "—"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues">
          <IssueAccordion issues={issues} onDismiss={handleDismissIssue} />
        </TabsContent>

        {/* Suggestions Tab */}
        <TabsContent value="suggestions">
          <SuggestionReview suggestions={suggestions} onRefresh={() => { fetchSuggestions(); fetchDashboard(); }} />
        </TabsContent>

        {/* Recent Runs Tab */}
        <TabsContent value="runs">
          <div className="space-y-2">
            {recentRuns.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No runs yet</p>
            ) : (
              recentRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="font-medium text-sm">{run.contentTitle || run.contentType}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.createdAt).toLocaleString()} • {run.issuesCount} issues • {run.suggestionsCount} suggestions
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {run.scoreBefore !== null && run.scoreAfter !== null && (
                      <span className="text-xs text-muted-foreground">
                        {run.scoreBefore} → {run.scoreAfter}
                      </span>
                    )}
                    <Badge className={
                      run.status === "completed" ? "bg-green-100 text-green-700" :
                      run.status === "running" ? "bg-blue-100 text-blue-700" :
                      run.status === "failed" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-500"
                    }>
                      {run.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
