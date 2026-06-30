"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox, RefreshCw, Search, MessageSquare, Archive, X } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";

const PLATFORM_COLORS = {
  facebook: "bg-blue-100 text-blue-700",
  instagram: "bg-pink-100 text-pink-700",
  twitter: "bg-sky-100 text-sky-700",
  tiktok: "bg-black/10 text-gray-800",
};

const PLATFORM_LABELS = {
  facebook: "Messenger",
  instagram: "Instagram DM",
  twitter: "Twitter DM",
  tiktok: "TikTok Comments",
};

const STATUSES = ["Open", "Archived", "Closed"];

function PlatformBadge({ platformCode }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[platformCode] || "bg-gray-100 text-gray-700"}`}>
      {PLATFORM_LABELS[platformCode] || platformCode}
    </span>
  );
}

function RelativeTime({ date }) {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  let label;
  if (diff < 60) label = "just now";
  else if (diff < 3600) label = `${Math.floor(diff / 60)}m ago`;
  else if (diff < 86400) label = `${Math.floor(diff / 3600)}h ago`;
  else label = d.toLocaleDateString();
  return <span className="text-xs text-muted-foreground">{label}</span>;
}

export default function SocialInboxPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Open");
  const [platformFilter, setPlatformFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const LIMIT = 25;

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        limit: String(LIMIT),
      });
      if (platformFilter) params.set("platform", platformFilter);
      if (unreadOnly) params.set("unread", "true");
      if (search) params.set("search", search);

      const res = await fetch(`/api/v1/social/inbox?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setConversations(data.conversations || []);
      setTotal(data.total || 0);
      setUnreadTotal(data.unread_total || 0);
    } catch {
      toast.error("Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [user, page, statusFilter, platformFilter, unreadOnly, search]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/v1/social/inbox/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success(`Synced ${data.conversations_synced} conversations, ${data.messages_synced} messages`);
      setPage(1);
      await loadConversations();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function archiveConversation(convId, e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/social/inbox/${convId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Archived" }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      toast.success("Conversation archived");
      await loadConversations();
    } catch {
      toast.error("Failed to archive");
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  // Debounced search: update `search` (which triggers fetch) 500ms after typing stops
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            Social Inbox
            {unreadTotal > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadTotal}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">All messages from connected platforms in one place</p>
        </div>
        <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync All"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={platformFilter || "all"} onValueChange={(v) => { setPlatformFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="facebook">Messenger</SelectItem>
            <SelectItem value="instagram">Instagram DM</SelectItem>
            <SelectItem value="twitter">Twitter DM</SelectItem>
            <SelectItem value="tiktok">TikTok Comments</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={unreadOnly ? "default" : "outline"}
          size="sm"
          onClick={() => { setUnreadOnly((v) => !v); setPage(1); }}
        >
          Unread only
          {unreadOnly && <X className="h-3 w-3 ml-1" />}
        </Button>
      </div>

      {/* Conversation list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">No conversations</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {statusFilter !== "Open"
                ? `No ${statusFilter.toLowerCase()} conversations`
                : "Click Sync All to pull messages from your connected accounts"}
            </p>
            <Button onClick={handleSync} disabled={syncing} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              Sync Now
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link key={conv.id} href={`/admin/social-media/inbox/${conv.id}`}>
              <Card className={`hover:shadow-sm transition-shadow cursor-pointer ${conv.unread_count > 0 ? "border-primary/40 bg-primary/5" : ""}`}>
                <CardContent className="flex items-center gap-3 py-3">
                  {/* Avatar / initials */}
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold flex-shrink-0 uppercase">
                    {conv.participant_avatar
                      ? <img src={conv.participant_avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      : (conv.participant_name?.[0] || "?")}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm font-medium truncate ${conv.unread_count > 0 ? "font-semibold" : ""}`}>
                        {conv.participant_name}
                      </span>
                      {conv.participant_handle && (
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                          {conv.participant_handle}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs truncate ${conv.unread_count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {conv.last_message_preview || "No messages yet"}
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <PlatformBadge platformCode={conv.platform_code} />
                      <RelativeTime date={conv.last_message_at} />
                    </div>
                    <div className="flex items-center gap-1">
                      {conv.unread_count > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">
                          {conv.unread_count}
                        </span>
                      )}
                      {statusFilter === "Open" && (
                        <button
                          onClick={(e) => archiveConversation(conv.id, e)}
                          className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                          title="Archive"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({total} total)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Footer note for TikTok */}
      {(platformFilter === "tiktok" || !platformFilter) && (
        <p className="text-xs text-muted-foreground text-center">
          <MessageSquare className="h-3 w-3 inline mr-1" />
          TikTok shows video comment threads — direct messages are not available via the TikTok API.
        </p>
      )}
    </div>
  );
}
