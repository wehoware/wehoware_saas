"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X } from "lucide-react";

export default function DailyReportAnalyticsFilters({
  filters,
  employees,
  onChange,
  onApply,
  onClear,
  onExport,
  exporting,
}) {
  const [local, setLocal] = useState(filters);

  useEffect(() => {
    setLocal(filters);
  }, [filters]);

  const update = (key, value) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onChange(next);
  };

  const hasActiveFilters =
    local.date_from || local.date_to || local.user_id || local.status;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* From */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              From
            </label>
            <Input
              type="date"
              value={local.date_from || ""}
              onChange={(e) => update("date_from", e.target.value)}
            />
          </div>

          {/* To */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              To
            </label>
            <Input
              type="date"
              value={local.date_to || ""}
              onChange={(e) => update("date_to", e.target.value)}
            />
          </div>

          {/* Employee */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Employee
            </label>
            <Select
              value={local.user_id || "all"}
              onValueChange={(v) => update("user_id", v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {(employees || []).map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Status
            </label>
            <Select
              value={local.status || "all"}
              onValueChange={(v) => update("status", v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Granularity */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Granularity
            </label>
            <Select
              value={local.granularity || "daily"}
              onValueChange={(v) => update("granularity", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Daily" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-3">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}
          <Button size="sm" onClick={() => onApply(local)}>
            Apply
          </Button>
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={exporting}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
