"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  CheckCircle,
  Clock,
  FileText,
  Send,
  FileEdit,
} from "lucide-react";

function MetricsCard({ title, value, sub, icon: Icon, color }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color || ""}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function DailyReportAnalyticsSummary({ summary, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="h-24 animate-pulse bg-muted rounded-lg" />
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <MetricsCard
        title="Total Reports"
        value={summary.total_reports}
        icon={FileText}
      />
      <MetricsCard
        title="Submitted"
        value={summary.submitted_count}
        sub={`${summary.total_reports > 0 ? Math.round((summary.submitted_count / summary.total_reports) * 100) : 0}% of total`}
        icon={Send}
        color="text-green-600"
      />
      <MetricsCard
        title="Drafts"
        value={summary.draft_count}
        sub={`${summary.total_reports > 0 ? Math.round((summary.draft_count / summary.total_reports) * 100) : 0}% of total`}
        icon={FileEdit}
        color="text-yellow-600"
      />
      <MetricsCard
        title="Total Hours"
        value={`${Number(summary.total_hours || 0).toFixed(1)}h`}
        icon={Clock}
      />
      <MetricsCard
        title="Avg Hours / Report"
        value={`${Number(summary.avg_hours_per_report || 0).toFixed(1)}h`}
        icon={TrendingUp}
      />
      <MetricsCard
        title="Tasks Completed"
        value={summary.tasks_completed}
        sub="Unique tasks across all reports"
        icon={CheckCircle}
        color="text-blue-600"
      />
    </div>
  );
}
