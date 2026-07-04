"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Info, CheckCircle2, Wrench, XCircle } from "lucide-react";

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
 * Flat list of SEO issues (used inside accordion or standalone).
 *
 * @param {Object} props
 * @param {Array} props.issues - Array of issue objects
 * @param {Function} [props.onDismiss] - Callback when an issue is dismissed
 * @param {Function} [props.onViewSuggestions] - Callback to view suggestions for an issue
 */
export default function IssueList({ issues, onDismiss, onViewSuggestions }) {
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <CheckCircle2 className="h-6 w-6 mb-2 text-green-500" />
        <p className="text-sm">No issues found.</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {issues.map((issue) => {
        const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info;
        const SevIcon = sev.icon;
        const statusCfg = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;

        return (
          <div key={issue.id} className="p-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <SevIcon className={`h-4 w-4 mt-0.5 shrink-0 ${sev.className.includes("red") ? "text-red-500" : sev.className.includes("yellow") ? "text-yellow-500" : "text-blue-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{issue.title}</p>
                  {issue.itemTitle && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{issue.itemTitle}</p>
                  )}
                  {issue.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{issue.description}</p>
                  )}
                  {issue.currentValue && (
                    <div className="mt-1">
                      <p className="text-xs font-medium text-muted-foreground">Current:</p>
                      <code className="text-xs bg-muted p-1.5 rounded block max-h-20 overflow-auto">{issue.currentValue}</code>
                    </div>
                  )}
                  {issue.recommendedValue && (
                    <div className="mt-1">
                      <p className="text-xs font-medium text-muted-foreground">Recommended:</p>
                      <code className="text-xs bg-green-50 p-1.5 rounded block max-h-20 overflow-auto">{issue.recommendedValue}</code>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={sev.className}>{sev.label}</Badge>
                {issue.status !== "open" && (
                  <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-2 pl-6">
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
        );
      })}
    </div>
  );
}
