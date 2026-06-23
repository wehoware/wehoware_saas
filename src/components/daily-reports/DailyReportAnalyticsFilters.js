"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const update = (key, value) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date_from">From</Label>
        <Input
          id="date_from"
          type="date"
          value={local.date_from || ""}
          onChange={(e) => update("date_from", e.target.value)}
          className="w-36"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date_to">To</Label>
        <Input
          id="date_to"
          type="date"
          value={local.date_to || ""}
          onChange={(e) => update("date_to", e.target.value)}
          className="w-36"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="employee">Employee</Label>
        <Select
          value={local.user_id || "all"}
          onValueChange={(v) => update("user_id", v === "all" ? "" : v)}
        >
          <SelectTrigger id="employee" className="w-[180px]">
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Status</Label>
        <Select
          value={local.status || "all"}
          onValueChange={(v) => update("status", v === "all" ? "" : v)}
        >
          <SelectTrigger id="status" className="w-[120px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="granularity">Granularity</Label>
        <Select
          value={local.granularity || "daily"}
          onValueChange={(v) => update("granularity", v)}
        >
          <SelectTrigger id="granularity" className="w-[130px]">
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
      <div className="flex items-center gap-2 ml-auto">
        <Button variant="outline" onClick={onClear}>
          Clear
        </Button>
        <Button onClick={() => onApply(local)}>Apply</Button>
        {onExport && (
          <Button variant="outline" onClick={onExport} disabled={exporting}>
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        )}
      </div>
    </div>
  );
}
