"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import DailyReportForm from "@/components/daily-reports/DailyReportForm";
import { toast } from "react-hot-toast";

export default function NewDailyReportPage() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/daily-reports/assignable-tasks");
        const data = await res.json();
        if (res.ok) setTasks(data.tasks || []);
      } catch {
        // ignore
      }
    }
    load();
  }, []);

  const handleSave = async (payload) => {
    const res = await fetch("/api/v1/daily-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create report");
    toast.success("Report created");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/daily-reports">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Daily Work Report</h1>
          <p className="text-sm text-muted-foreground">Log today&apos;s work items and hours.</p>
        </div>
      </div>
      <DailyReportForm tasks={tasks} onSave={handleSave} />
    </div>
  );
}
