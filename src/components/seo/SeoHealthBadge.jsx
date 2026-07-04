"use client";

import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

/**
 * Compact SEO health badge for displaying in list tables.
 *
 * @param {Object} props
 * @param {number} props.score - 0-100 SEO score
 * @param {number} [props.issuesCount] - Number of open issues
 * @param {number} [props.criticalCount] - Number of critical issues
 * @param {string} [props.size] - "sm" | "default"
 */
export default function SeoHealthBadge({ score, issuesCount, criticalCount, size = "default" }) {
  let config;
  if (score === null || score === undefined) {
    config = { label: "Not Scanned", className: "bg-gray-100 text-gray-500", icon: Info };
  } else if (score >= 80) {
    config = { label: "Good", className: "bg-green-100 text-green-700", icon: CheckCircle2 };
  } else if (score >= 60) {
    config = { label: "Fair", className: "bg-yellow-100 text-yellow-700", icon: Info };
  } else if (score >= 40) {
    config = { label: "Poor", className: "bg-orange-100 text-orange-700", icon: AlertCircle };
  } else {
    config = { label: "Critical", className: "bg-red-100 text-red-700", icon: AlertCircle };
  }

  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div className="flex items-center gap-1.5">
      <Badge className={`${config.className} ${size === "sm" ? "text-xs" : ""}`}>
        <Icon className={`${iconSize} mr-1`} />
        {config.label}
        {score !== null && score !== undefined && ` (${score})`}
      </Badge>
      {issuesCount > 0 && (
        <Badge variant="secondary" className={size === "sm" ? "text-xs" : ""}>
          {issuesCount} issue{issuesCount !== 1 ? "s" : ""}
        </Badge>
      )}
      {criticalCount > 0 && (
        <Badge className="bg-red-100 text-red-700 text-xs">
          {criticalCount} critical
        </Badge>
      )}
    </div>
  );
}
