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
import { X } from "lucide-react";

export default function DailyReportFilters({
  filters,
  onChange,
  onApply,
  onClear,
  employees,
}) {
  const [local, setLocal] = useState(filters);

  // Sync local state when parent filters change (e.g., on clear)
  useEffect(() => {
    setLocal(filters);
  }, [filters]);

  const update = (key, value) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onChange(next);
  };

  const hasActiveFilters =
    local.start_date || local.end_date || local.status || local.user_id;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Start Date
            </label>
            <Input
              type="date"
              value={local.start_date || ""}
              onChange={(e) => update("start_date", e.target.value)}
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              End Date
            </label>
            <Input
              type="date"
              value={local.end_date || ""}
              onChange={(e) => update("end_date", e.target.value)}
            />
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

          {/* Employee */}
          {employees && employees.length > 0 && (
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
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
            Apply Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
