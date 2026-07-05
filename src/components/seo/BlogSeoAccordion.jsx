"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, AlertCircle, RefreshCw, TrendingUp, TrendingDown, Wrench } from "lucide-react";
import IssueAccordion from "./IssueAccordion";
import SuggestionReview from "./SuggestionReview";

const RUN_STATUS_BADGE = {
  completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
  running: { label: "Running", className: "bg-blue-100 text-blue-700 border-blue-200" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700 border-red-200" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
};

/**
 * BlogSeoAccordion — displays SEO analysis results for a single blog post.
 *
 * Fetches the latest analysis run when expanded and shows issues grouped
 * by category. A dialog is available for reviewing suggestions.
 *
 * @param {Object} props
 * @param {string} props.blogId - The blog post ID
 */
export default function BlogSeoAccordion({ blogId }) {
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestionDialogOpen, setSuggestionDialogOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [allSuggestions, setAllSuggestions] = useState([]);

  const fetchLatestRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/seo-analyser/runs/latest?contentType=blog&contentId=${blogId}`
      );
      if (!res.ok) throw new Error("Failed to fetch analysis run");
      const json = await res.json();
      setRun(json.data || null);
    } catch (err) {
      setError(err.message || "Failed to load SEO analysis");
    } finally {
      setLoading(false);
    }
  }, [blogId]);

  useEffect(() => {
    fetchLatestRun();
  }, [fetchLatestRun]);

  // Auto-poll when latest run is still running (max 60 attempts × 5s = 5 min)
  useEffect(() => {
    if (run?.status !== "running") return;
    let attempts = 0;
    const interval = setInterval(() => {
      if (++attempts > 60) {
        clearInterval(interval);
        return;
      }
      fetchLatestRun();
    }, 5000);
    return () => clearInterval(interval);
  }, [run?.status, fetchLatestRun]);

  const handleViewSuggestions = (issue) => {
    setSelectedIssue(issue);
    const suggestions = issue.suggestions || [];
    setAllSuggestions(
      suggestions.map((s) => ({
        ...s,
        issue: { id: issue.id, title: issue.title, category: issue.category, description: issue.description },
      }))
    );
    setSuggestionDialogOpen(true);
  };

  const handleRefresh = () => {
    fetchLatestRun();
    setSuggestionDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Loading SEO analysis...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-2">
        <AlertCircle className="h-6 w-6 text-red-500" />
        <p className="text-sm text-red-600">{error}</p>
        <Button size="sm" variant="outline" onClick={fetchLatestRun}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Wrench className="h-6 w-6 mb-2 text-gray-400" />
        <p className="text-sm">No SEO analysis run yet for this blog.</p>
        <p className="text-xs mt-1">
          Run an analysis from the SEO Analyser tab to see issues here.
        </p>
      </div>
    );
  }

  const statusBadge = RUN_STATUS_BADGE[run.status] || RUN_STATUS_BADGE.pending;
  const scoreDelta = (run.scoreAfter ?? 0) - (run.scoreBefore ?? 0);

  return (
    <div className="p-4 space-y-4">
      {/* Run Summary */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
        <span className="text-muted-foreground">
          Run: {new Date(run.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {run.status === "completed" && (
          <Fragment>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              Score: <strong className="text-gray-700">{run.scoreBefore ?? "—"}</strong>
              {scoreDelta !== 0 && (
                <span className={`ml-1 inline-flex items-center ${scoreDelta > 0 ? "text-green-600" : "text-red-600"}`}>
                  {scoreDelta > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                  {scoreDelta > 0 ? "+" : ""}{scoreDelta}
                </span>
              )}
              {" → "}<strong className="text-gray-700">{run.scoreAfter ?? "—"}</strong>
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              {run.issuesCount} issue{run.issuesCount !== 1 ? "s" : ""}
            </span>
            {run.suggestionsCount > 0 && (
              <Fragment>
                <span className="text-muted-foreground">|</span>
                <span className="text-muted-foreground">
                  {run.suggestionsCount} suggestion{run.suggestionsCount !== 1 ? "s" : ""}
                </span>
              </Fragment>
            )}
            {run.llmModel && (
              <Fragment>
                <span className="text-muted-foreground">|</span>
                <span className="text-xs text-muted-foreground font-mono">{run.llmModel}</span>
              </Fragment>
            )}
          </Fragment>
        )}
        <Button size="sm" variant="ghost" onClick={fetchLatestRun} className="ml-auto">
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Failed Run */}
      {run.status === "failed" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">Analysis Failed</p>
            <p className="text-xs text-red-600 mt-0.5">{run.errorMessage || "Unknown error occurred during analysis."}</p>
          </div>
        </div>
      )}

      {/* Running Status */}
      {run.status === "running" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          <p className="text-sm text-blue-700">Analysis is currently running. Please check back shortly.</p>
        </div>
      )}

      {/* Issues */}
      {run.status === "completed" && (
        <IssueAccordion
          issues={run.issues || []}
          onViewSuggestions={handleViewSuggestions}
        />
      )}

      {/* Suggestion Review Dialog */}
      <Dialog open={suggestionDialogOpen} onOpenChange={setSuggestionDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Suggestion Review</DialogTitle>
            <DialogDescription>
              {selectedIssue
                ? `Suggestions for: ${selectedIssue.title}`
                : "Review and apply SEO suggestions"}
            </DialogDescription>
          </DialogHeader>
          <SuggestionReview suggestions={allSuggestions} onRefresh={handleRefresh} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
