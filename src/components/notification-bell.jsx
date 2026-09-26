"use client";

import * as React from "react";
import { Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const NOTIF_COLORS = {
  "appointment.booked": "bg-blue-500",
  "appointment.rescheduled": "bg-amber-500",
  "appointment.cancelled": "bg-red-500",
  "appointment.confirmed": "bg-green-500",
  "appointment.completed": "bg-emerald-500",
  "appointment.noshow": "bg-orange-500",
};

export function NotificationBell() {
  const { activeClient } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = React.useState([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // Poll for notifications every 15s
  React.useEffect(() => {
    if (!activeClient?.id) return;

    let cancelled = false;

    async function fetchNotifications() {
      try {
        // Sync notifications from external servers (non-blocking, silent)
        fetch("/api/v1/notifications/sync", { method: "POST" }).catch(() => {});

        const res = await fetch("/api/v1/notifications?limit=20");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setNotifications(json.notifications || []);
        setUnreadCount(json.unread_count || 0);
      } catch (err) {
        // silent fail
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeClient?.id]);

  // Also fetch immediately when dropdown opens
  React.useEffect(() => {
    if (open && activeClient?.id) {
      fetch("/api/v1/notifications?limit=20")
        .then((res) => res.json())
        .then((json) => {
          setNotifications(json.notifications || []);
          setUnreadCount(json.unread_count || 0);
        })
        .catch(() => {});
    }
  }, [open, activeClient?.id]);

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await fetch("/api/v1/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("[NotificationBell] mark all read error:", err);
    } finally {
      setLoading(false);
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
      console.error("[NotificationBell] mark read error:", err);
    }
  };

  const handleClickNotification = (notif) => {
    if (!notif.read) handleMarkRead(notif.id);
    if (notif.link) router.push(notif.link);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex items-center justify-center rounded-lg p-2 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-96 max-h-[500px] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-2 py-1.5 sticky top-0 bg-background z-10 border-b">
          <DropdownMenuLabel className="p-0">
            Notifications {unreadCount > 0 && (
              <span className="ml-1 text-xs text-red-500 font-normal">
                ({unreadCount} unread)
              </span>
            )}
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={loading}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          notifications.map((notif) => (
            <DropdownMenuItem
              key={notif.id}
              className="flex flex-col items-start gap-1 p-3 cursor-pointer"
              onClick={() => handleClickNotification(notif)}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        NOTIF_COLORS[notif.type] || "bg-gray-400"
                      }`}
                    />
                    <p
                      className={`text-sm truncate ${
                        !notif.read ? "font-semibold" : ""
                      }`}
                    >
                      {notif.title}
                    </p>
                  </div>
                  {notif.message && (
                    <p className="text-xs text-muted-foreground truncate pl-4 mt-0.5">
                      {notif.message}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5 pl-4">
                    {timeAgo(notif.created_at)}
                  </p>
                </div>
                {!notif.read && (
                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                )}
              </div>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer justify-center text-sm text-muted-foreground"
          onClick={() => {
            router.push("/admin/notifications");
            setOpen(false);
          }}
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
