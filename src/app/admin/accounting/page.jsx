"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/AdminPageHeader";
import { useAuth } from "@/contexts/auth-context";
import {
  ReceiptText,
  Receipt,
  Wallet,
  CreditCard,
  UserSquare,
  Users,
  BarChart,
  Settings,
  TrendingUp,
  AlertTriangle,
  Clock,
  Loader2,
  Link2,
} from "lucide-react";
const QUICK_LINKS = [
  {
    title: "Invoices",
    description: "Create and send invoices to your clients",
    href: "/admin/accounting/invoices",
    icon: ReceiptText,
    color: "text-blue-600 bg-blue-500/10",
  },
  {
    title: "Bills",
    description: "Track money you owe to vendors",
    href: "/admin/accounting/bills",
    icon: Receipt,
    color: "text-orange-600 bg-orange-500/10",
  },
  {
    title: "Transactions",
    description: "Bank transactions and reconciliation",
    href: "/admin/accounting/transactions",
    icon: CreditCard,
    color: "text-purple-600 bg-purple-500/10",
  },
  {
    title: "Expenses",
    description: "Submit and approve expense claims",
    href: "/admin/accounting/expenses",
    icon: Wallet,
    color: "text-emerald-600 bg-emerald-500/10",
  },
  {
    title: "Vendors",
    description: "Manage your vendor directory",
    href: "/admin/accounting/vendors",
    icon: UserSquare,
    color: "text-indigo-600 bg-indigo-500/10",
  },
  {
    title: "Customers",
    description: "Manage your customer directory",
    href: "/admin/accounting/customers",
    icon: Users,
    color: "text-sky-600 bg-sky-500/10",
  },
  {
    title: "Reports",
    description: "P&L, aging reports, tax summaries",
    href: "/admin/accounting/reports",
    icon: BarChart,
    color: "text-pink-600 bg-pink-500/10",
  },
  {
    title: "Bank Feeds (Plaid)",
    description: "Connect bank accounts and pull transactions automatically",
    href: "/admin/accounting/integrations/plaid",
    icon: Link2,
    color: "text-teal-600 bg-teal-500/10",
  },
];

export default function AccountingDashboardPage() {
  const router = useRouter();
  const { activeClient } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    invoicesOpen: 0,
    invoicesOpenAmount: 0,
    billsOpen: 0,
    billsOpenAmount: 0,
    expensesPending: 0,
    expensesPendingAmount: 0,
    transactionsUnreconciled: 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        // Fetch lightweight summary counts in parallel.
        const [invRes, billRes, expRes, txRes] = await Promise.all([
          fetch("/api/v1/invoices?status=Pending&limit=1"),
          fetch("/api/v1/bills?status=Open&limit=1"),
          fetch("/api/v1/expenses?status=Pending&limit=1"),
          fetch("/api/v1/transactions?limit=1"),
        ]);
        const [inv, bill, exp, tx] = await Promise.all([
          invRes.ok ? invRes.json() : { pagination: { totalItems: 0 }, data: [] },
          billRes.ok ? billRes.json() : { pagination: { totalItems: 0 }, data: [] },
          expRes.ok ? expRes.json() : { pagination: { totalItems: 0 }, data: [] },
          txRes.ok ? txRes.json() : { pagination: { totalItems: 0 }, data: [] },
        ]);

        if (cancelled) return;
        setStats({
          invoicesOpen: inv.pagination?.totalItems ?? 0,
          invoicesOpenAmount: 0, // Will be filled in Phase 3 with aggregations
          billsOpen: bill.pagination?.totalItems ?? 0,
          billsOpenAmount: 0,
          expensesPending: exp.pagination?.totalItems ?? 0,
          expensesPendingAmount: 0,
          transactionsUnreconciled: tx.pagination?.totalItems ?? 0,
        });
      } catch (err) {
        console.error("[AccountingDashboard] failed to load stats", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeClient?.id]);

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title="Accounting"
        description="Cashflow, invoices, bills, expenses and reconciliation"
        actionLabel="Settings"
        actionIcon={<Settings size={16} />}
        onAction={() => router.push("/admin/accounting/settings")}
      />

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Open Invoices"
          value={isLoading ? "—" : stats.invoicesOpen}
          icon={<ReceiptText className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          title="Open Bills"
          value={isLoading ? "—" : stats.billsOpen}
          icon={<Receipt className="h-5 w-5" />}
          tone="orange"
        />
        <StatCard
          title="Pending Expenses"
          value={isLoading ? "—" : stats.expensesPending}
          icon={<Clock className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          title="Unreconciled"
          value={isLoading ? "—" : stats.transactionsUnreconciled}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="red"
        />
      </div>

      {/* Quick Links */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Quick Access</CardTitle>
          <CardDescription>Jump into any accounting area</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => router.push(link.href)}
                  className="flex items-start gap-3 rounded-lg border border-border/40 p-4 text-left transition hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
                >
                  <div className={`rounded-lg p-2.5 ${link.color} shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{link.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {link.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Phase-2 placeholder: cashflow chart */}
      <Card className="border-border/60 shadow-sm mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Cashflow Overview
          </CardTitle>
          <CardDescription>
            Bank-feed driven cashflow analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-16 text-center border-2 border-dashed border-border/40 rounded-lg bg-muted/20">
            {isLoading ? (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </span>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <TrendingUp className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-sm text-muted-foreground max-w-sm">
                  Connect a bank account to start tracking cashflow.
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push("/admin/accounting/settings?tab=banks")
                  }
                >
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Connect Bank Account
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon, tone }) {
  const toneClasses = {
    blue: "text-blue-600 bg-blue-500/10",
    orange: "text-orange-600 bg-orange-500/10",
    amber: "text-amber-600 bg-amber-500/10",
    red: "text-red-600 bg-red-500/10",
  };
  const className = toneClasses[tone] ?? toneClasses.blue;
  return (
    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${className}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{title}</div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
