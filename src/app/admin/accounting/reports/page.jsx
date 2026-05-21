"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  TrendingUp,
  Receipt,
  Wallet,
  ArrowUpRight,
  Lock,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";

const REPORTS = [
  {
    id: "profit-loss",
    title: "Profit & Loss",
    description: "Income vs expenses over a date range",
    icon: TrendingUp,
    available: false,
  },
  {
    id: "ar-aging",
    title: "Accounts Receivable Aging",
    description: "Outstanding invoice balances bucketed by age",
    icon: Receipt,
    available: false,
  },
  {
    id: "ap-aging",
    title: "Accounts Payable Aging",
    description: "Outstanding bill balances bucketed by age",
    icon: Wallet,
    available: false,
  },
  {
    id: "tax-summary",
    title: "Tax Summary",
    description: "GST/HST collected vs paid for a period",
    icon: BarChart,
    available: false,
  },
  {
    id: "cashflow",
    title: "Cashflow Statement",
    description: "Operating cash inflow and outflow",
    icon: ArrowUpRight,
    available: false,
  },
];

export default function AccountingReportsPage() {
  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title="Reports"
        description="Profit & loss, aging reports, tax summaries"
      />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Card
              key={r.id}
              className={`border border-gray-200 shadow-sm ${
                r.available ? "cursor-pointer hover:shadow" : "opacity-75"
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="rounded-lg p-2 bg-pink-50 text-pink-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  {!r.available && (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <CardTitle className="mt-2 text-lg">{r.title}</CardTitle>
                <CardDescription>{r.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  {r.available ? "Click to generate" : "Available in Phase 3"}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
