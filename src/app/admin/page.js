"use client";

import { useState, useEffect, useCallback } from "react";
import supabase from "@/lib/supabase";
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
} from "lucide-react";
import { Overview } from "@/components/dashboard/overview";
import { RecentSales } from "@/components/dashboard/recent-sales";
import AdminPageHeader from "@/components/AdminPageHeader";
import { toast } from "react-hot-toast"; // For error reporting

// Initial state for dashboard data
const initialDashboardData = {
  totalRevenue: null, // Placeholder - requires payment/subscription data
  revenueChange: null, // Placeholder
  pendingInquiries: 0,
  inquiriesChange: null, // Placeholder - requires tracking over time
  blogPosts: 0,
  postsChange: null, // Placeholder
  activeServices: 0,
  servicesChange: null, // Placeholder
  recentSalesData: [], // Placeholder - requires sales/payment data
  overviewData: [], // Placeholder - requires analytics data
};

export default function DashboardPage() {
  const { activeClient, isEmployee } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(initialDashboardData);

  // Fetch data for the dashboard cards
  const fetchDashboardData = useCallback(async () => {
    if (!activeClient?.id) return;
    setIsLoading(true);
    try {
      // Fetch counts in parallel
      const [inquiriesRes, postsRes, servicesRes, categoriesRes] = await Promise.all([
        supabase
          .from("wehoware_inquiries")
          .select("id", { count: "exact", head: true })
          .eq("client_id", activeClient.id),
        supabase
          .from("wehoware_blogs")
          .select("id", { count: "exact", head: true })
          .eq("client_id", activeClient.id),
        supabase
          .from("wehoware_services")
          .select("id", { count: "exact", head: true })
          .eq("client_id", activeClient.id),
        supabase
          .from("wehoware_blog_categories")
          .select("id", { count: "exact", head: true })
          .eq("client_id", activeClient.id),
      ]);
      // Check for errors (simplified error check)
      if (inquiriesRes.error || postsRes.error || servicesRes.error || categoriesRes.error) {
        console.error(
          "Error fetching counts:",
          inquiriesRes.error,
          postsRes.error,
          servicesRes.error,
          categoriesRes.error
        );
        throw new Error("Failed to load some dashboard data.");
      }

      setDashboardData((prev) => ({
        ...prev, // Keep placeholders for now
        pendingInquiries: inquiriesRes.count || 0,
        blogPosts: postsRes.count || 0,
        activeServices: servicesRes.count || 0,
        blogCategories: categoriesRes.count || 0,
      }));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard data. " + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeClient?.id]);

  // Fetch data on initial load or when client changes
  useEffect(() => {
    if (activeClient?.id) {
      fetchDashboardData();
    } else if (isEmployee) {
      setIsLoading(false);
      setDashboardData(initialDashboardData); // Reset data if no client selected
    }
  }, [activeClient, isEmployee, fetchDashboardData]);

  // --- Render Logic ---

  // Display message if employee hasn't selected a client
  if (isEmployee && !activeClient) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground">
          Please select a client from the header dropdown to view the dashboard.
        </p>
      </div>
    );
  }

  // Display loading spinner
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // --- Main Dashboard JSX ---
  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Dashboard"
          description={new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        />
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Pending Inquiries Card (Dynamic) */}
              <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pending Inquiries
                  </CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardData.pendingInquiries}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total inquiries submitted
                  </p>
                </CardContent>
              </Card>
              {/* Blog Posts Card (Dynamic) */}
              <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Blog Posts
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardData.blogPosts}
                  </div>
                  {/* Change placeholder */}
                  {/* <p className="text-xs text-muted-foreground">
                    +3 new posts this week
                  </p> */}
                  <p className="text-xs text-muted-foreground">
                    Total posts published
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Services
                  </CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardData.activeServices}
                  </div>
                  {/* Change placeholder */}
                  {/* <p className="text-xs text-muted-foreground">
                    2 services updated
                  </p> */}
                  <p className="text-xs text-muted-foreground">
                    Total services listed
                  </p>
                </CardContent>
              </Card>
              <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Categories for Blogs
                  </CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardData.blogCategories}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total categories listed
                  </p>
                </CardContent>
              </Card>
            </div>
            {/* Overview and Recent Sales (Still using static components) */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4 border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
                <CardHeader>
                  <CardTitle>Website Traffic Overview</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <Overview />
                </CardContent>
              </Card>
              <Card className="col-span-3 border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
                <CardHeader>
                  <CardTitle>Recent Inquiries</CardTitle>
                  <CardDescription>
                    You have received new inquiries.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentSales />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          {/* Other Tabs remain unchanged */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-7 border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
                <CardHeader>
                  <CardTitle>Analytics</CardTitle>
                  <CardDescription>
                    Detailed website analytics and visitor behavior.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="flex h-[400px] items-center justify-center text-muted-foreground">
                    Analytics data will be displayed here.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="notifications" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-7 border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>
                    System notifications and pending actions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="flex h-[400px] items-center justify-center text-muted-foreground">
                    Notification timeline will be displayed here.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
