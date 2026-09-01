"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  FileText,
  Send,
  FileEdit,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

function StatCard({ title, value, sub, icon: Icon, accent }) {
  return (
    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accent)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
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
          <Card key={i} className="border-border/60">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 w-24 animate-pulse bg-muted rounded" />
                <div className="h-8 w-8 animate-pulse bg-muted rounded-lg" />
              </div>
              <div className="h-7 w-16 animate-pulse bg-muted rounded mt-2" />
              <div className="h-3 w-32 animate-pulse bg-muted rounded mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const submitRate = summary.total_reports > 0
    ? Math.round((summary.submitted_count / summary.total_reports) * 100)
    : 0;
  const draftRate = summary.total_reports > 0
    ? Math.round((summary.draft_count / summary.total_reports) * 100)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Total Reports"
        value={summary.total_reports}
        sub="All reports in range"
        icon={FileText}
        accent="text-blue-500 bg-blue-500/10"
      />
      <StatCard
        title="Submitted"
        value={summary.submitted_count}
        sub={`${submitRate}% of total`}
        icon={Send}
        accent="text-green-500 bg-green-500/10"
      />
      <StatCard
        title="Drafts"
        value={summary.draft_count}
        sub={`${draftRate}% of total`}
        icon={FileEdit}
        accent="text-yellow-500 bg-yellow-500/10"
      />
      <StatCard
        title="Total Hours"
        value={`${Number(summary.total_hours || 0).toFixed(1)}h`}
        sub="Logged across all reports"
        icon={Clock}
        accent="text-orange-500 bg-orange-500/10"
      />
      <StatCard
        title="Avg Hours / Report"
        value={`${Number(summary.avg_hours_per_report || 0).toFixed(1)}h`}
        sub="Average per report"
        icon={TrendingUp}
        accent="text-purple-500 bg-purple-500/10"
      />
      <StatCard
        title="Tasks Completed"
        value={summary.tasks_completed}
        sub="Unique tasks across all reports"
        icon={Target}
        accent="text-cyan-500 bg-cyan-500/10"
      />
    </div>
  );
}
