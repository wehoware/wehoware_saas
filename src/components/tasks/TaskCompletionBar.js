"use client";

import React from "react";

export default function TaskCompletionBar({ completed, total, className = "" }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const barColor =
    pct === 100
      ? "bg-green-500"
      : pct >= 50
      ? "bg-blue-500"
      : pct > 0
      ? "bg-yellow-500"
      : "bg-gray-200";

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {completed} of {total} sub-tasks
        </span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
