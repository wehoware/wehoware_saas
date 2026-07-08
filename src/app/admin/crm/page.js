"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  List,
  Plus,
  ArrowRight,
  Loader2,
  CheckCircle,
  Clock,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import { useAuth } from "@/contexts/auth-context";

export default function CrmDashboardPage() {
  const router = useRouter();
  const { activeClient, user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!activeClient) return;
    try {
      const res = await fetch("/api/v1/crm/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      const { data } = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [activeClient]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (activeClient) {
        fetchStats();
      }
    }
  }, [authLoading, user, activeClient, router, fetchStats]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load dashboard data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="CRM Dashboard"
        description="Overview of your contacts, deals, and activities"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.contacts.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.contacts.leads} leads · {stats.contacts.customers} customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.deals.pipeline_value.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.deals.open} open deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Won Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats.deals.won_value.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.deals.won} won · {stats.deals.lost} lost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activities.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activities.total} total activities
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deals by Stage */}
      <Card>
        <CardHeader>
          <CardTitle>Deals by Stage</CardTitle>
          <CardDescription>Current open deals across pipeline stages</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.deals.by_stage.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No open deals in pipeline.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.deals.by_stage.map((stage) => (
                <div key={stage.stage_id} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color || "#6b7280" }}
                  />
                  <span className="text-sm font-medium w-32 truncate">
                    {stage.stage_name}
                  </span>
                  <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${stats.deals.open > 0 ? (stage.deal_count / stats.deals.open) * 100 : 0}%`,
                        backgroundColor: stage.color || "#6b7280",
                        opacity: 0.3,
                      }}
                    />
                    <span className="absolute inset-0 flex items-center px-3 text-xs font-medium">
                      {stage.deal_count} deals · ${stage.total_value.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contacts by Status + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Contacts by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(stats.contacts.by_status).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between border rounded-lg p-2">
                  <span className="text-sm">{status}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
              {Object.keys(stats.contacts.by_status).length === 0 && (
                <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
                  No contacts yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/crm/contacts">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Manage Contacts
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/crm/pipeline">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Pipeline Board
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/crm/deals">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Manage Deals
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/crm/activities">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Activities
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/crm/lists">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Contact Lists
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
