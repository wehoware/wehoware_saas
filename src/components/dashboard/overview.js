"use client";

import { useState, useEffect } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Loader2 } from "lucide-react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Build last 6 months of labels (including current month).
 * Returns array of { key: "YYYY-MM", label: "Mon" }
 */
function getLast6Months() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_NAMES[d.getMonth()],
    });
  }
  return months;
}

export function Overview({ clientId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const cid = encodeURIComponent(clientId);
        // Fetch up to 100 recent inquiries to aggregate client-side
        const res = await fetch(`/api/v1/inquiries?limit=100&clientId=${cid}`);
        if (!res.ok) return;
        const json = await res.json();
        const items = json.data || [];

        const months = getLast6Months();
        const counts = {};
        months.forEach((m) => (counts[m.key] = 0));

        for (const item of items) {
          if (!item.created_at) continue;
          const d = new Date(item.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (counts[key] !== undefined) counts[key]++;
        }

        if (!cancelled) {
          setData(months.map((m) => ({ name: m.label, total: counts[m.key] })));
        }
      } catch (err) {
        console.error("[Overview] fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[350px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.total, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[350px] text-center">
        <p className="text-sm font-medium text-muted-foreground">No inquiry data yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Inquiries from the last 6 months will appear here.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          formatter={(value) => [`${value} inquiries`, "Inquiries"]}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            borderColor: "hsl(var(--border))",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          }}
          labelStyle={{
            color: "hsl(var(--foreground))",
            fontWeight: 600,
            marginBottom: "4px",
          }}
        />
        <Bar
          dataKey="total"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
          className="fill-primary"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
