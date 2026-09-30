"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Loader2,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import toast from "react-hot-toast";

const NOTIF_COLORS = {
  "appointment.booked": "bg-blue-500",
  "appointment.rescheduled": "bg-amber-500",
  "appointment.cancelled": "bg-red-500",
  "appointment.confirmed": "bg-green-500",
  "appointment.completed": "bg-emerald-500",
  "appointment.noshow": "bg-orange-500",
};

const NOTIF_LABELS = {
  "appointment.booked": "New Booking",
  "appointment.rescheduled": "Rescheduled",
  "appointment.cancelled": "Cancelled",
  "appointment.confirmed": "Confirmed",
  "appointment.completed": "Completed",
  "appointment.noshow": "No-Show",
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleString();
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const { activeClient } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchNotifications = useCallback(
    async (reset = false) => {
      setLoading(true);
      try {
        const filterParam = filter === "unread" ? "&filter=unread" : "";
        const currentPage = reset ? 0 : page;
        const res = await fetch(
          `/api/v1/notifications?limit=${pageSize}${filterParam}`
        );
        if (!res.ok) return;
        const json = await res.json();
        setNotifications(json.notifications || []);
        setUnreadCount(json.unread_count || 0);
        setTotal(json.total || 0);
        if (reset) setPage(0);
      } catch (err) {
        console.error("[NotificationsPage] fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [filter, page]
  );

  useEffect(() => {
    if (activeClient?.id) {
      fetchNotifications(true);
    }
  }, [activeClient?.id, filter, fetchNotifications]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/v1/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("All notifications marked as read");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await fetch("/api/v1/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      toast.error("Failed to mark as read");
    }
  };

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "All caught up!"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNotifications(true)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              {markingAll ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-2" />
              )}
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">
            All {total > 0 && `(${total})`}
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notifications List */}
      {loading && notifications.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
          <p className="text-muted-foreground">
            {filter === "unread"
              ? "No unread notifications"
              : "No notifications yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                !notif.read
                  ? "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20"
                  : "border-border bg-card"
              }`}
            >
              {/* Color dot */}
              <span
                className={`mt-1.5 h-3 w-3 rounded-full flex-shrink-0 ${
                  NOTIF_COLORS[notif.type] || "bg-gray-400"
                }`}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className={`text-sm ${
                      !notif.read ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {notif.title}
                  </p>
                  {!notif.read && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
                      New
                    </span>
                  )}
                </div>
                {notif.message && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {notif.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1.5">
                  {formatDate(notif.created_at)} · {timeAgo(notif.created_at)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!notif.read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleMarkRead(notif.id)}
                    title="Mark as read"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                {notif.link && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      if (!notif.read) handleMarkRead(notif.id);
                      window.location.href = notif.link;
                    }}
                    title="Open"
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
