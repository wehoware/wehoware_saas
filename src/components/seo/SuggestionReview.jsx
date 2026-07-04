"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Check, X, Loader2, Wrench, FileText } from "lucide-react";
import { toast } from "react-hot-toast";

/**
 * Suggestion review panel — allows approving, rejecting, or applying suggestions.
 *
 * @param {Object} props
 * @param {Array} props.suggestions - Array of suggestion objects with issue relation
 * @param {Function} [props.onRefresh] - Callback to refresh data after action
 */
export default function SuggestionReview({ suggestions, onRefresh }) {
  const [actionLoading, setActionLoading] = useState(null);
  const [previewSuggestion, setPreviewSuggestion] = useState(null);

  const handleAction = async (suggestionId, action) => {
    setActionLoading(suggestionId);
    try {
      const res = await fetch("/api/v1/seo-analyser/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, action }),
      });
      if (!res.ok) throw new Error(`Failed to ${action} suggestion`);
      toast.success(`Suggestion ${action === "apply" ? "applied" : action + "d"} successfully`);
      if (onRefresh) onRefresh();
    } catch {
      toast.error(`Failed to ${action} suggestion`);
    } finally {
      setActionLoading(null);
    }
  };

  const STATUS_BADGE = {
    pending: "bg-orange-100 text-orange-700",
    approved: "bg-blue-100 text-blue-700",
    applied: "bg-green-100 text-green-700",
    rejected: "bg-gray-100 text-gray-500",
  };

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Wrench className="h-8 w-8 mb-2" />
        <p>No suggestions to review</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {suggestions.map((suggestion) => {
          const issue = suggestion.issue;
          return (
            <Card key={suggestion.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-medium">{issue?.title || "Issue"}</CardTitle>
                    {issue?.category && (
                      <Badge variant="secondary" className="mt-1 capitalize">{issue.category.replace(/_/g, " ")}</Badge>
                    )}
                  </div>
                  <Badge className={STATUS_BADGE[suggestion.status] || STATUS_BADGE.pending}>
                    {suggestion.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {suggestion.explanation && (
                  <p className="text-sm text-muted-foreground">{suggestion.explanation}</p>
                )}

                {suggestion.currentValue && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Current:</p>
                    <code className="text-xs bg-muted p-2 rounded block max-h-24 overflow-auto">{suggestion.currentValue}</code>
                  </div>
                )}

                {suggestion.suggestedValue && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Suggested:</p>
                    <code className="text-xs bg-green-50 p-2 rounded block max-h-24 overflow-auto">{suggestion.suggestedValue}</code>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Field: <strong>{suggestion.fieldName || "N/A"}</strong></span>
                  <span>•</span>
                  <span>Type: <strong>{suggestion.fixType}</strong></span>
                </div>

                {suggestion.status === "pending" && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction(suggestion.id, "apply")}
                      disabled={actionLoading === suggestion.id}
                    >
                      {actionLoading === suggestion.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                      Apply Fix
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(suggestion.id, "approve")}
                      disabled={actionLoading === suggestion.id}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAction(suggestion.id, "reject")}
                      disabled={actionLoading === suggestion.id}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewSuggestion(suggestion)}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewSuggestion} onOpenChange={(open) => !open && setPreviewSuggestion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Suggestion Preview</DialogTitle>
            <DialogDescription>Review the suggested change in detail</DialogDescription>
          </DialogHeader>
          {previewSuggestion && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Issue</p>
                <p className="text-sm text-muted-foreground">{previewSuggestion.issue?.title}</p>
                {previewSuggestion.issue?.description && (
                  <p className="text-xs text-muted-foreground mt-1">{previewSuggestion.issue.description}</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Field</p>
                <code className="text-sm bg-muted p-2 rounded block">{previewSuggestion.fieldName || "N/A"}</code>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Current Value</p>
                <code className="text-sm bg-muted p-2 rounded block max-h-40 overflow-auto">{previewSuggestion.currentValue || "(empty)"}</code>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Suggested Value</p>
                <code className="text-sm bg-green-50 p-2 rounded block max-h-40 overflow-auto">{previewSuggestion.suggestedValue}</code>
              </div>
              {previewSuggestion.explanation && (
                <div>
                  <p className="text-sm font-medium mb-1">Explanation</p>
                  <p className="text-sm text-muted-foreground">{previewSuggestion.explanation}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewSuggestion(null)}>Close</Button>
            <Button onClick={() => { handleAction(previewSuggestion.id, "apply"); setPreviewSuggestion(null); }}>
              <Check className="h-4 w-4 mr-1" />
              Apply Fix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
