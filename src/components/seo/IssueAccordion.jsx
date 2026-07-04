"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, AlertCircle, Info, CheckCircle2, Wrench, XCircle } from "lucide-react";

const SEVERITY_CONFIG = {
  critical: { label: "Critical", className: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  high: { label: "High", className: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  warning: { label: "Warning", className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle },
  info: { label: "Info", className: "bg-blue-100 text-blue-700 border-blue-200", icon: Info },
  low: { label: "Low", className: "bg-blue-100 text-blue-700 border-blue-200", icon: Info },
};

const STATUS_CONFIG = {
  open: { label: "Open", className: "bg-orange-100 text-orange-700" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-700" },
  dismissed: { label: "Dismissed", className: "bg-gray-100 text-gray-500" },
  ignored: { label: "Ignored", className: "bg-gray-100 text-gray-500" },
};

/**
 * Collapsible accordion for displaying SEO issues grouped by category.
 *
 * @param {Object} props
 * @param {Array} props.issues - Array of issue objects
 * @param {Function} [props.onDismiss] - Callback when an issue is dismissed
 * @param {Function} [props.onViewSuggestions] - Callback to view suggestions for an issue
 */
export default function IssueAccordion({ issues, onDismiss, onViewSuggestions }) {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedIssues, setExpandedIssues] = useState({});

  // Group issues by category
  const grouped = issues.reduce((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {});

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const toggleIssue = (issueId) => {
    setExpandedIssues((prev) => ({ ...prev, [issueId]: !prev[issueId] }));
  };

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const aCritical = grouped[a].filter((i) => i.severity === "critical" || i.severity === "high").length;
    const bCritical = grouped[b].filter((i) => i.severity === "critical" || i.severity === "high").length;
    return bCritical - aCritical;
  });

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
        <p>No issues found. Your content looks good!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedCategories.map((category) => {
        const categoryIssues = grouped[category];
        const isExpanded = expandedCategories[category];
        const criticalCount = categoryIssues.filter((i) => i.severity === "critical" || i.severity === "high").length;

        return (
          <div key={category} className="border rounded-lg">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium capitalize">{category.replace(/_/g, " ")}</span>
                <Badge variant="secondary">{categoryIssues.length}</Badge>
                {criticalCount > 0 && (
                  <Badge className="bg-red-100 text-red-700">{criticalCount} critical</Badge>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t divide-y">
                {categoryIssues.map((issue) => {
                  const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info;
                  const SevIcon = sev.icon;
                  const statusCfg = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
                  const issueExpanded = expandedIssues[issue.id];

                  return (
                    <div key={issue.id} className="p-3">
                      <button
                        onClick={() => toggleIssue(issue.id)}
                        className="w-full flex items-start justify-between gap-2 text-left"
                      >
                        <div className="flex items-start gap-2 flex-1">
                          <SevIcon className={`h-4 w-4 mt-0.5 ${sev.className.includes("red") ? "text-red-500" : sev.className.includes("yellow") ? "text-yellow-500" : "text-blue-500"}`} />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{issue.title}</p>
                            {issue.itemTitle && (
                              <p className="text-xs text-muted-foreground mt-0.5">{issue.itemTitle}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={sev.className}>{sev.label}</Badge>
                          {issue.status !== "open" && (
                            <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                          )}
                        </div>
                      </button>

                      {issueExpanded && (
                        <div className="mt-3 space-y-3 pl-6">
                          {issue.description && (
                            <p className="text-sm text-muted-foreground">{issue.description}</p>
                          )}
                          {issue.currentValue && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Current Value:</p>
                              <code className="text-xs bg-muted p-2 rounded block max-h-32 overflow-auto">{issue.currentValue}</code>
                            </div>
                          )}
                          {issue.recommendedValue && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Recommended:</p>
                              <code className="text-xs bg-green-50 p-2 rounded block max-h-32 overflow-auto">{issue.recommendedValue}</code>
                            </div>
                          )}
                          <div className="flex gap-2 pt-1">
                            {issue.suggestions && issue.suggestions.length > 0 && onViewSuggestions && (
                              <Button size="sm" variant="default" onClick={() => onViewSuggestions(issue)}>
                                <Wrench className="h-3 w-3 mr-1" />
                                View Suggestions ({issue.suggestions.length})
                              </Button>
                            )}
                            {issue.status === "open" && onDismiss && (
                              <Button size="sm" variant="outline" onClick={() => onDismiss(issue.id)}>
                                <XCircle className="h-3 w-3 mr-1" />
                                Dismiss
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
