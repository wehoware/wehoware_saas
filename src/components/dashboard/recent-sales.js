"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Mail, User } from "lucide-react";

function timeAgo(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export function RecentSales({ clientId }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const cid = encodeURIComponent(clientId);
        const res = await fetch(`/api/v1/inquiries?limit=5&clientId=${cid}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setInquiries(json.data || []);
      } catch (err) {
        console.error("[RecentInquiries] fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (inquiries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Mail className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">No inquiries yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          New contact form submissions will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {inquiries.map((inq) => (
        <div key={inq.id} className="flex items-center">
          <Avatar className="h-9 w-9 mr-3">
            <AvatarFallback>{getInitials(inq.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium leading-none truncate">
              {inq.name || "Unknown"}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {inq.subject || "No subject"}
            </p>
          </div>
          <div className="ml-auto text-xs text-muted-foreground whitespace-nowrap pl-3">
            {timeAgo(inq.created_at)}
          </div>
        </div>
      ))}
    </div>
  );
}
