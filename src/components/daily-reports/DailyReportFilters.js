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

export default function DailyReportFilters({
  filters,
  onChange,
  onApply,
  onClear,
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
        <Label htmlFor="start_date">Start Date</Label>
        <Input
          id="start_date"
          type="date"
          value={local.start_date || ""}
          onChange={(e) => update("start_date", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="end_date">End Date</Label>
        <Input
          id="end_date"
          type="date"
          value={local.end_date || ""}
          onChange={(e) => update("end_date", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Status</Label>
        <Select
          value={local.status || "all"}
          onValueChange={(v) => update("status", v === "all" ? "" : v)}
        >
          <SelectTrigger id="status" className="w-[140px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <Button variant="outline" onClick={onClear}>
          Clear
        </Button>
        <Button onClick={() => onApply(local)}>Apply</Button>
      </div>
    </div>
  );
}
