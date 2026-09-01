"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  CreditCard,
  DollarSign,
  Users,
  FileText,
  MessageSquare,
  Briefcase,
  Loader2,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  Target,
  ArrowUpRight,
  Plus,
  Calendar,
  Mail,
  PenSquare,
} from "lucide-react";
import Link from "next/link";
import { Overview } from "@/components/dashboard/overview";
import { RecentSales } from "@/components/dashboard/recent-sales";
import AdminPageHeader from "@/components/AdminPageHeader";
import { toast } from "react-hot-toast";

const initialDashboardData = {
  pendingInquiries: 0,
  blogPosts: 0,
  activeServices: 0,
  blogCategories: 0,
  crmContacts: 0,
  crmLeads: 0,
  crmCustomers: 0,
  openDeals: 0,
  pipelineValue: 0,
  pendingActivities: 0,
  tasksTodo: 0,
  tasksInProgress: 0,
  tasksDone: 0,
  tasksTotal: 0,
};

const QUICK_ACTIONS = [
  { label: "New Blog Post", href: "/admin/blogs", icon: PenSquare, color: "text-blue-500 bg-blue-500/10" },
  { label: "Add Service", href: "/admin/services", icon: Briefcase, color: "text-purple-500 bg-purple-500/10" },
  { label: "New Task", href: "/admin/tasks", icon: ListTodo, color: "text-orange-500 bg-orange-500/10" },
  { label: "View Inquiries", href: "/admin/inquiries", icon: Mail, color: "text-green-500 bg-green-500/10" },
  { label: "CRM Contacts", href: "/admin/crm/contacts", icon: Users, color: "text-cyan-500 bg-cyan-500/10" },
  { label: "Appointments", href: "/admin/appointments", icon: Calendar, color: "text-pink-500 bg-pink-500/10" },
];

function StatCard({ title, value, subtitle, icon: Icon, accent }) {
  return (
    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { activeClient, isEmployee } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(initialDashboardData);

  const fetchDashboardData = useCallback(async () => {
    if (!activeClient?.id) return;
    setIsLoading(true);
    try {
      const cid = encodeURIComponent(activeClient.id);
      const [
        inquiriesRes,
        postsRes,
        servicesRes,
        categoriesRes,
        crmRes,
        tasksRes,
      ] = await Promise.all([
        fetch(`/api/v1/inquiries?limit=1&clientId=${cid}`),
        fetch(`/api/v1/blogs?limit=1&clientId=${cid}`),
        fetch(`/api/v1/services?limit=1&clientId=${cid}`),
        fetch(`/api/v1/blogs/categories?clientId=${cid}`),
        fetch(`/api/v1/crm/dashboard`),
        fetch(`/api/v1/tasks/stats`),
      ]);

      const [inquiriesJson, postsJson, servicesJson, categoriesJson, crmJson, tasksJson] =
        await Promise.all([
          inquiriesRes.ok ? inquiriesRes.json() : {},
          postsRes.ok ? postsRes.json() : {},
          servicesRes.ok ? servicesRes.json() : {},
          categoriesRes.ok ? categoriesRes.json() : {},
          crmRes.ok ? crmRes.json() : {},
          tasksRes.ok ? tasksRes.json() : {},
        ]);

      const crm = crmJson.data || {};
      const taskStats = tasksJson || {};

      setDashboardData((prev) => ({
        ...prev,
        pendingInquiries: inquiriesJson.pagination?.totalItems || 0,
        blogPosts: postsJson.pagination?.totalItems || 0,
        activeServices: servicesJson.pagination?.totalItems || 0,
        blogCategories: (categoriesJson.data || []).length,
        crmContacts: crm.contacts?.total || 0,
        crmLeads: crm.contacts?.leads || 0,
        crmCustomers: crm.contacts?.customers || 0,
        openDeals: crm.deals?.open || 0,
        pipelineValue: crm.deals?.pipeline_value || 0,
        pendingActivities: crm.activities?.pending || 0,
        tasksTodo: taskStats.todo || 0,
        tasksInProgress: taskStats.inProgress || 0,
        tasksDone: taskStats.done || 0,
        tasksTotal: taskStats.total || 0,
      }));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard data. " + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeClient?.id]);

  useEffect(() => {
    if (activeClient?.id) {
      fetchDashboardData();
    } else if (isEmployee) {
      setIsLoading(false);
      setDashboardData(initialDashboardData);
    }
  }, [activeClient, isEmployee, fetchDashboardData]);

  if (isEmployee && !activeClient) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground">
          Please select a client from the header dropdown to view the dashboard.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const taskCompletionRate =
    dashboardData.tasksTotal > 0
      ? Math.round((dashboardData.tasksDone / dashboardData.tasksTotal) * 100)
      : 0;

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-6">
        <AdminPageHeader
          title="Dashboard"
          description={new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        />

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-center text-muted-foreground group-hover:text-foreground transition-colors">
                {action.label}
              </span>
            </Link>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>

          {/* ─── Overview Tab ─── */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Pending Inquiries"
                value={dashboardData.pendingInquiries}
                subtitle="Total inquiries submitted"
                icon={MessageSquare}
                accent="text-green-500 bg-green-500/10"
              />
              <StatCard
                title="Blog Posts"
                value={dashboardData.blogPosts}
                subtitle="Total posts published"
                icon={FileText}
                accent="text-blue-500 bg-blue-500/10"
              />
              <StatCard
                title="Active Services"
                value={dashboardData.activeServices}
                subtitle="Total services listed"
                icon={Briefcase}
                accent="text-purple-500 bg-purple-500/10"
              />
              <StatCard
                title="Blog Categories"
                value={dashboardData.blogCategories}
                subtitle="Total categories listed"
                icon={FileText}
                accent="text-orange-500 bg-orange-500/10"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    Inquiries Overview
                  </CardTitle>
                  <CardDescription>
                    Inquiries received over the last 6 months
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <Overview clientId={activeClient?.id} />
                </CardContent>
              </Card>
              <Card className="col-span-3 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Recent Inquiries</CardTitle>
                  <CardDescription>
                    Latest contact form submissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentSales clientId={activeClient?.id} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── CRM Tab ─── */}
          <TabsContent value="crm" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Contacts"
                value={dashboardData.crmContacts}
                subtitle={`${dashboardData.crmLeads} leads · ${dashboardData.crmCustomers} customers`}
                icon={Users}
                accent="text-cyan-500 bg-cyan-500/10"
              />
              <StatCard
                title="Open Deals"
                value={dashboardData.openDeals}
                subtitle="Active sales opportunities"
                icon={Target}
                accent="text-blue-500 bg-blue-500/10"
              />
              <StatCard
                title="Pipeline Value"
                value={
                  dashboardData.pipelineValue > 0
                    ? `$${dashboardData.pipelineValue.toLocaleString()}`
                    : "$0"
                }
                subtitle="Total value of open deals"
                icon={DollarSign}
                accent="text-green-500 bg-green-500/10"
              />
              <StatCard
                title="Pending Activities"
                value={dashboardData.pendingActivities}
                subtitle="Tasks awaiting completion"
                icon={Activity}
                accent="text-orange-500 bg-orange-500/10"
              />
            </div>
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle>CRM Quick Links</CardTitle>
                <CardDescription>Jump to CRM modules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Contacts", href: "/admin/crm/contacts" },
                    { label: "Pipeline", href: "/admin/crm/pipeline" },
                    { label: "Deals", href: "/admin/crm/deals" },
                    { label: "Activities", href: "/admin/crm/activities" },
                    { label: "Lists", href: "/admin/crm/lists" },
                    { label: "Dashboard", href: "/admin/crm" },
                  ].map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 text-sm font-medium hover:bg-accent hover:border-primary/30 transition-all"
                    >
                      {link.label}
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Tasks Tab ─── */}
          <TabsContent value="tasks" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Tasks"
                value={dashboardData.tasksTotal}
                subtitle="All tasks"
                icon={ListTodo}
                accent="text-blue-500 bg-blue-500/10"
              />
              <StatCard
                title="To Do"
                value={dashboardData.tasksTodo}
                subtitle="Not started yet"
                icon={ListTodo}
                accent="text-orange-500 bg-orange-500/10"
              />
              <StatCard
                title="In Progress"
                value={dashboardData.tasksInProgress}
                subtitle="Currently being worked on"
                icon={Activity}
                accent="text-yellow-500 bg-yellow-500/10"
              />
              <StatCard
                title="Completed"
                value={dashboardData.tasksDone}
                subtitle={`${taskCompletionRate}% completion rate`}
                icon={CheckCircle2}
                accent="text-green-500 bg-green-500/10"
              />
            </div>

            {/* Task completion progress bar */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle>Task Completion Rate</CardTitle>
                <CardDescription>
                  {dashboardData.tasksDone} of {dashboardData.tasksTotal} tasks completed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${taskCompletionRate}%` }}
                    />
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    {taskCompletionRate}%
                  </span>
                </div>
                <div className="mt-4">
                  <Link
                    href="/admin/tasks"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    View all tasks
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
