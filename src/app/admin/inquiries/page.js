"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Calendar,
  ArrowRight,
  Eye,
  CheckCircle,
  Clock,
  Loader2,
  ArrowUpDown,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import supabase from "@/lib/supabase";
import AlertComponent from "@/components/ui/alert-component";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function InquiriesPage() {
  const router = useRouter();
  const [inquiries, setInquiries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [services, setServices] = useState([]);

  // Fetch inquiries when statusFilter, sortField, or sortOrder changes (runs on mount too)
  useEffect(() => {
    fetchInquiries();
  }, [statusFilter, sortField, sortOrder]);

  // Fetch services on mount
  useEffect(() => {
    fetchServices();
  }, []);

  const fetchInquiries = async () => {
    try {
      setIsLoading(true);

      // Build query for inquiries with a join on services (only title)
      let query = supabase
        .from("wehoware_inquiries")
        .select(
          `
          *,
          wehoware_services(title)
        `
        )
        .order(sortField, { ascending: sortOrder === "asc" });

      // Filter by status if needed
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Format data to include service name and formatted date
      const formattedData = data.map((inquiry) => ({
        ...inquiry,
        service: inquiry.wehoware_services ? inquiry.wehoware_services.title : "General Inquiry",
        date: new Date(inquiry.created_at).toISOString().split("T")[0],
      }));

      setInquiries(formattedData || []);
    } catch (error) {
      console.error("Error fetching inquiries:", error);
      setErrorMessage(error.message || "Failed to fetch inquiries");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("wehoware_services")
        .select("id, title")
        .eq("active", true)
        .order("title");

      if (error) {
        throw error;
      }

      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  // Local search filtering (for larger datasets consider server-side search)
  const filteredInquiries = inquiries.filter((inquiry) => {
    return (
      searchTerm === "" ||
      (inquiry.name &&
        inquiry.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inquiry.email &&
        inquiry.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inquiry.subject &&
        inquiry.subject.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  // Handle sort order and field
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Update inquiry status
  const handleStatusUpdate = async (inquiry, newStatus) => {
    try {
      setIsLoading(true);

      const { error } = await supabase
        .from("wehoware_inquiries")
        .update({ status: newStatus })
        .eq("id", inquiry.id);

      if (error) {
        throw error;
      }

      // Update local inquiry state
      setInquiries((prev) =>
        prev.map((item) =>
          item.id === inquiry.id ? { ...item, status: newStatus } : item
        )
      );

      setSuccessMessage(`Inquiry status updated to ${newStatus}`);
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error updating inquiry status:", error);
      setErrorMessage(error.message || "Failed to update inquiry status");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Render status badge based on status value
  const getStatusBadge = (status) => {
    switch (status) {
      case "New":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            New
          </Badge>
        );
      case "In Progress":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200"
          >
            In Progress
          </Badge>
        );
      case "Resolved":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Resolved
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4">
        <AdminPageHeader
          title="Inquiries"
          description="Manage and respond to customer inquiries"
        />

        <Card className="border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200">
          <CardHeader>
            <CardTitle>Inquiries Dashboard</CardTitle>
            <CardDescription>
              View and manage customer inquiries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Statistics */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                  <div className="text-sm font-medium text-muted-foreground">
                    Total Inquiries
                  </div>
                  <div className="text-2xl font-bold">{inquiries.length}</div>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                  <div className="text-sm font-medium text-muted-foreground">
                    New
                  </div>
                  <div className="text-2xl font-bold">
                    {inquiries.filter((i) => i.status === "New").length}
                  </div>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                  <div className="text-sm font-medium text-muted-foreground">
                    In Progress
                  </div>
                  <div className="text-2xl font-bold">
                    {inquiries.filter((i) => i.status === "In Progress").length}
                  </div>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm">
                  <div className="text-sm font-medium text-muted-foreground">
                    Resolved
                  </div>
                  <div className="text-2xl font-bold">
                    {inquiries.filter((i) => i.status === "Resolved").length}
                  </div>
                </div>
              </div>

              {/* Inquiries List */}
              <div>
                <h3 className="text-lg font-medium mb-4">All Inquiries</h3>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search inquiries..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-4 items-center">
                      <Select
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="In Progress">
                            In Progress
                          </SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                            Sort by
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleSort("created_at")}
                          >
                            Date{" "}
                            {sortField === "created_at" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSort("name")}>
                            Name{" "}
                            {sortField === "name" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleSort("subject")}
                          >
                            Subject{" "}
                            {sortField === "subject" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleSort("status")}
                          >
                            Status{" "}
                            {sortField === "status" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-muted/50 border-b border-gray-200">
                            <th className="text-left p-3 font-medium">
                              Inquiry
                            </th>
                            <th className="text-left p-3 font-medium hidden md:table-cell">
                              Service
                            </th>
                            <th className="text-left p-3 font-medium hidden md:table-cell">
                              Date
                            </th>
                            <th className="text-left p-3 font-medium">
                              Status
                            </th>
                            <th className="text-left p-3 font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInquiries.length === 0 ? (
                            <tr>
                              <td
                                colSpan="5"
                                className="p-4 text-center text-muted-foreground"
                              >
                                No inquiries found
                              </td>
                            </tr>
                          ) : (
                            filteredInquiries.map((inquiry) => (
                              <tr
                                key={inquiry.id}
                                className="border-b border-gray-200 last:border-0"
                              >
                                <td className="p-3">
                                  <div className="font-medium">
                                    {inquiry.subject}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {inquiry.name}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {inquiry.email}
                                  </div>
                                </td>
                                <td className="p-3 hidden md:table-cell">
                                  {inquiry.service}
                                </td>
                                <td className="p-3 hidden md:table-cell">
                                  <div className="flex items-center space-x-1">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span>{inquiry.date}</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  {getStatusBadge(inquiry.status)}
                                </td>
                                <td className="p-3">
                                  <div className="flex space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2"
                                      onClick={() => {
                                        // Show inquiry details in a modal/dialog
                                        setSuccessMessage(
                                          <div className="space-y-2">
                                            <p>
                                              <strong>From:</strong>{" "}
                                              {inquiry.name} ({inquiry.email})
                                            </p>
                                            <p>
                                              <strong>Subject:</strong>{" "}
                                              {inquiry.subject}
                                            </p>
                                            <p>
                                              <strong>Message:</strong>
                                            </p>
                                            <p className="whitespace-pre-wrap">
                                              {inquiry.message}
                                            </p>
                                          </div>
                                        );
                                        setSuccessDialogOpen(true);
                                      }}
                                    >
                                      <Eye className="h-3.5 w-3.5 mr-1" />
                                      View
                                    </Button>

                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 px-2"
                                        >
                                          <ArrowRight className="h-3.5 w-3.5 mr-1" />
                                          Status
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleStatusUpdate(inquiry, "New")
                                          }
                                          disabled={inquiry.status === "New"}
                                        >
                                          <Clock className="h-4 w-4 mr-2" />
                                          Mark as New
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleStatusUpdate(
                                              inquiry,
                                              "In Progress"
                                            )
                                          }
                                          disabled={
                                            inquiry.status === "In Progress"
                                          }
                                        >
                                          <Clock className="h-4 w-4 mr-2" />
                                          Mark as In Progress
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleStatusUpdate(
                                              inquiry,
                                              "Resolved"
                                            )
                                          }
                                          disabled={
                                            inquiry.status === "Resolved"
                                          }
                                        >
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          Mark as Resolved
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {filteredInquiries.length} of {inquiries.length}{" "}
                      inquiries
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error dialog */}
      <AlertComponent
        open={errorDialogOpen}
        onOpenChange={setErrorDialogOpen}
        title="Error"
        message={errorMessage}
        actionLabel="OK"
      />

      {/* Success dialog */}
      <AlertComponent
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        title="Inquiry Details"
        message={successMessage}
        actionLabel="Close"
      />
    </div>
  );
}
