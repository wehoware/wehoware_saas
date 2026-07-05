"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "react-hot-toast";
import {
  Loader2,
  Play,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import IssueAccordion from "@/components/seo/IssueAccordion";
import SuggestionReview from "@/components/seo/SuggestionReview";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SeoAnalyser() {
  const { activeClient } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [contentType, setContentType] = useState("blog");
  const [contentItems, setContentItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [runs, setRuns] = useState([]);
  const [expandedRunId, setExpandedRunId] = useState(null);
  const [runDetails, setRunDetails] = useState({});
  const [suggestionFilter, setSuggestionFilter] = useState({ runId: null, issueId: null });
  const [pollingRunId, setPollingRunId] = useState(null);
  const pollIntervalRef = useRef(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const fetchContentItems = useCallback(async (type) => {
    if (!activeClient?.id) return;
    try {
      const res = await fetch(
        `/api/v1/seo-analyser/runs?action=content&type=${type}`
      );
      if (!res.ok) throw new Error("Failed to load content");
      const json = await res.json();
      setContentItems(json.data || []);
      setSelectedItemId("");
    } catch (error) {
      toast.error("Failed to load content items. " + error.message);
    }
  }, [activeClient?.id]);

  const fetchRuns = useCallback(async () => {
    if (!activeClient?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/seo-analyser/runs?limit=20");
      if (!res.ok) throw new Error("Failed to load runs");
      const json = await res.json();
      setRuns(json.data || []);
    } catch (error) {
      toast.error("Failed to load analysis runs. " + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeClient?.id]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    fetchContentItems(contentType);
  }, [contentType, fetchContentItems]);

  const handleRunAnalysis = async () => {
    if (!selectedItemId) {
      toast.error("Please select a content item to analyze.");
      return;
    }

    setIsRunning(true);
    try {
      const res = await fetch("/api/v1/seo-analyser/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId: selectedItemId }),
      });

      if (res.status === 409) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || "An analysis is already running for this item.");
        setIsRunning(false);
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || json.detail || "Failed to start analysis");
      }

      const json = await res.json();
      const runId = json.data?.id;

      if (!runId) {
        throw new Error("No run ID returned");
      }

      toast.success("Analysis started. This may take 1-2 minutes...");
      setPollingRunId(runId);

      // Poll for completion (max 60 attempts × 5s = 5 minutes)
      let pollAttempts = 0;
      const MAX_POLL_ATTEMPTS = 60;

      pollIntervalRef.current = setInterval(async () => {
        pollAttempts++;
        if (pollAttempts > MAX_POLL_ATTEMPTS) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setPollingRunId(null);
          setIsRunning(false);
          toast.error("Analysis timed out — check the runs list for status.");
          fetchRuns();
          return;
        }
        try {
          const pollRes = await fetch(`/api/v1/seo-analyser/runs/${runId}`);
          if (!pollRes.ok) return;
          const pollJson = await pollRes.json();
          const run = pollJson.data;

          if (run?.status === "completed") {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setPollingRunId(null);
            setIsRunning(false);
            toast.success(
              `Analysis complete: ${run.issuesCount || 0} issues found, ${run.suggestionsCount || 0} suggestions.`
            );
            fetchRuns();
          } else if (run?.status === "failed") {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setPollingRunId(null);
            setIsRunning(false);
            toast.error("Analysis failed. " + (run.errorMessage || "Unknown error"));
            fetchRuns();
          }
        } catch {
          // Network error during poll — keep trying
        }
      }, 5000);
    } catch (error) {
      toast.error("Analysis failed. " + error.message);
      setIsRunning(false);
      setPollingRunId(null);
    }
  };

  const handleExpandRun = async (runId) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }

    setExpandedRunId(runId);

    if (!runDetails[runId]) {
      try {
        const res = await fetch(`/api/v1/seo-analyser/runs/${runId}`);
        if (!res.ok) throw new Error("Failed to load run details");
        const json = await res.json();
        setRunDetails((prev) => ({ ...prev, [runId]: json.data }));
      } catch (error) {
        toast.error("Failed to load run details. " + error.message);
      }
    }
  };

  const selectedItem = contentItems.find((item) => item.id === selectedItemId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeClient?.id) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please select a client to run SEO analysis.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Run New Analysis Card */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>Run SEO Analysis</CardTitle>
          <CardDescription>
            Select a blog or service to analyze with the LLM-powered SEO engine.
            The analyser will identify issues and generate actionable fix suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Content Type</label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blog">Blog Posts</SelectItem>
                  <SelectItem value="service">Services</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 flex-1 min-w-[250px]">
              <label className="text-sm font-medium">Content Item</label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a content item..." />
                </SelectTrigger>
                <SelectContent>
                  {contentItems.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No items available
                    </SelectItem>
                  ) : (
                    contentItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title} (Score: {item.seoScore})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleRunAnalysis}
              disabled={isRunning || !selectedItemId}
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {pollingRunId ? "Analyzing (polling...)..." : "Starting..."}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Analysis
                </>
              )}
            </Button>
          </div>

          {selectedItem && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="flex items-center gap-4">
                <span>
                  <span className="text-muted-foreground">Title:</span>{" "}
                  <strong>{selectedItem.title}</strong>
                </span>
                <span>
                  <span className="text-muted-foreground">Slug:</span>{" "}
                  <code className="text-xs">{selectedItem.slug}</code>
                </span>
                <span>
                  <span className="text-muted-foreground">Current Score:</span>{" "}
                  <strong>{selectedItem.seoScore}/100</strong>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Runs */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>Analysis History</CardTitle>
          <CardDescription>
            Past SEO analysis runs. Click a run to see detailed issues and suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No analysis runs yet. Select a content item above and click &ldquo;Run Analysis&rdquo;.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Issues</TableHead>
                  <TableHead>Suggestions</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <Fragment key={run.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleExpandRun(run.id)}
                    >
                      <TableCell>
                        {expandedRunId === run.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{run.contentTitle}</div>
                        <div className="text-xs text-muted-foreground">
                          {run.contentSlug}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {run.contentType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {run.status === "completed" && (
                          <span className="inline-flex items-center text-xs text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Completed
                          </span>
                        )}
                        {run.status === "running" && (
                          <span className="inline-flex items-center text-xs text-blue-600">
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            Running
                          </span>
                        )}
                        {run.status === "failed" && (
                          <span className="inline-flex items-center text-xs text-red-600">
                            <AlertCircle className="h-3.5 w-3.5 mr-1" />
                            Failed
                          </span>
                        )}
                        {run.status === "pending" && (
                          <span className="text-xs text-gray-500">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {run.scoreBefore !== null && run.scoreAfter !== null ? (
                          <span className="text-xs">
                            {run.scoreBefore} → <strong>{run.scoreAfter}</strong>
                          </span>
                        ) : run.scoreBefore !== null ? (
                          <span className="text-xs">{run.scoreBefore}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{run.issuesCount}</TableCell>
                      <TableCell>{run.suggestionsCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {run.tokensUsed || 0}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(run.createdAt)}
                      </TableCell>
                    </TableRow>

                    {/* Expanded run details */}
                    {expandedRunId === run.id && runDetails[run.id] && (
                      <TableRow key={`${run.id}-detail`} className="bg-gray-50/50">
                        <TableCell colSpan={9} className="p-4">
                          <div className="space-y-4">
                            {runDetails[run.id].errorMessage && (
                              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                <strong>Error:</strong> {runDetails[run.id].errorMessage}
                              </div>
                            )}

                            {runDetails[run.id].issues?.length > 0 ? (
                              <>
                                <IssueAccordion
                                  issues={runDetails[run.id].issues}
                                  onViewSuggestions={(issue) =>
                                    setSuggestionFilter({ runId: run.id, issueId: issue.id })
                                  }
                                />
                                {suggestionFilter.runId === run.id && (() => {
                                  const allSuggestions = runDetails[run.id].issues
                                    .filter((i) => !suggestionFilter.issueId || i.id === suggestionFilter.issueId)
                                    .flatMap((i) => (i.suggestions || []).map((s) => ({ ...s, issue: i })));
                                  return (
                                    <SuggestionReview
                                      suggestions={allSuggestions}
                                      onRefresh={() => {
                                        setRunDetails((prev) => {
                                          const updated = { ...prev };
                                          delete updated[run.id];
                                          return updated;
                                        });
                                        handleExpandRun(run.id);
                                      }}
                                    />
                                  );
                                })()}
                              </>
                            ) : (
                              <div className="text-center text-sm text-muted-foreground py-4">
                                No issues found. SEO looks good!
                              </div>
                            )}

                            {runDetails[run.id].llmProvider && (
                              <div className="text-xs text-muted-foreground pt-2 border-t">
                                Powered by {runDetails[run.id].llmProvider} /{" "}
                                {runDetails[run.id].llmModel}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SeoAnalyser;
