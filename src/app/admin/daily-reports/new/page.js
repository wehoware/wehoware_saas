"use client";

import { useState, useEffect } from "react";
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
      <h1 className="text-2xl font-bold">New Daily Work Report</h1>
      <DailyReportForm tasks={tasks} onSave={handleSave} />
    </div>
  );
}
