"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Loader2,
  Activity as ActivityIcon,
  CheckCircle,
  Clock,
  Trash2,
  Phone,
  Mail,
  Calendar,
  FileText,
  MessageSquare,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import ActivityForm from "@/components/crm/ActivityForm";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "react-hot-toast";

const TYPE_ICONS = {
  Call: Phone,
  Email: Mail,
  Meeting: Calendar,
  Note: FileText,
  Task: CheckCircle,
  SocialMessage: MessageSquare,
  FormBuilderSubmission: FileText,
  AppointmentBooked: Calendar,
};

export default function ActivitiesPage() {
  const router = useRouter();
  const { activeClient, user, isLoading: authLoading } = useAuth();
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [completedFilter, setCompletedFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!activeClient) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (typeFilter) params.set("type", typeFilter);
      if (completedFilter) params.set("completed", completedFilter);

      const res = await fetch(`/api/v1/crm/activities?${params}`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      const { data, pagination } = await res.json();
      setActivities(data || []);
      setTotalPages(pagination?.totalPages || 1);
      setTotalItems(pagination?.totalItems || 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeClient, page, typeFilter, completedFilter]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (activeClient) {
        fetchActivities();
      }
    }
  }, [authLoading, user, activeClient, router, fetchActivities]);

  const handleDelete = async () => {
    if (!activityToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/crm/activities/${activityToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete activity");
      toast.success("Activity deleted");
      setDeleteDialogOpen(false);
      setActivityToDelete(null);
      fetchActivities();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleComplete = async (activity) => {
    try {
      const res = await fetch(`/api/v1/crm/activities/${activity.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Failed to complete activity");
      toast.success("Activity marked complete");
      fetchActivities();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Activities"
        description="Track calls, emails, meetings, and tasks"
        actionLabel="New Activity"
        actionIcon={<Plus className="h-4 w-4" />}
        onAction={() => setFormOpen(true)}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Types</option>
              <option value="Call">Call</option>
              <option value="Email">Email</option>
              <option value="Meeting">Meeting</option>
              <option value="Note">Note</option>
              <option value="Task">Task</option>
              <option value="SocialMessage">Social Message</option>
              <option value="FormBuilderSubmission">Form Submission</option>
              <option value="AppointmentBooked">Appointment Booked</option>
            </select>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={completedFilter}
              onChange={(e) => { setCompletedFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Activities</option>
              <option value="false">Pending</option>
              <option value="true">Completed</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivityIcon className="h-5 w-5" />
            Activities ({totalItems})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No activities found.
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => {
                const Icon = TYPE_ICONS[activity.type] || ActivityIcon;
                return (
                  <div
                    key={activity.id}
                    className={`flex items-start gap-3 border rounded-lg p-3 ${
                      activity.completed_at ? "opacity-60" : ""
                    }`}
                  >
                    <div className="mt-0.5">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium truncate">
                          {activity.title}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {activity.type}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {activity.direction}
                        </Badge>
                      </div>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {activity.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {activity.contact && (
                          <span>
                            {activity.contact.first_name} {activity.contact.last_name}
                          </span>
                        )}
                        {activity.deal && <span>· {activity.deal.title}</span>}
                        <span>{new Date(activity.created_at).toLocaleDateString()}</span>
                        {activity.completed_at ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-3 w-3" /> Completed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!activity.completed_at && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleComplete(activity)}
                          title="Mark complete"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setActivityToDelete(activity);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ActivityForm open={formOpen} onOpenChange={setFormOpen} onSaved={() => { setFormOpen(false); fetchActivities(); }} />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Activity"
        description="Are you sure you want to delete this activity?"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
