"use client";

// src/components/ai-chat/SessionSidebar.js
// Session list sidebar for the AI chat page.
// Shows conversation history with titles, message counts, and timestamps.
// Allows creating new chats, switching between sessions, renaming, and archiving.

import { useState, useEffect, useCallback } from "react";
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Loader2 } from "lucide-react";

export default function SessionSidebar({ activeSessionId, onSelectSession, onNewChat }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/ai/sessions", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error("[sidebar] Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Refresh sessions when activeSessionId changes (new session created)
  useEffect(() => {
    if (activeSessionId) fetchSessions();
  }, [activeSessionId, fetchSessions]);

  const handleArchive = async (sessionId, e) => {
    e.stopPropagation();
    try {
      await fetch(`/api/v1/ai/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        onNewChat();
      }
    } catch (err) {
      console.error("[sidebar] Failed to archive session:", err);
    }
  };

  const handleStartRename = (session, e) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title || "");
  };

  const handleSaveRename = async (sessionId, e) => {
    e?.stopPropagation();
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await fetch(`/api/v1/ai/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
        credentials: "include",
      });
      setSessions(prev =>
        prev.map(s => s.id === sessionId ? { ...s, title: editTitle.trim() } : s)
      );
    } catch (err) {
      console.error("[sidebar] Failed to rename session:", err);
    }
    setEditingId(null);
  };

  const handleCancelRename = (e) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* New Chat button */}
      <div className="p-3 border-b border-border">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">
              No conversations yet. Start a new chat to begin.
            </p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => editingId !== session.id && onSelectSession(session.id)}
              className={`group relative cursor-pointer rounded-lg p-3 transition-colors ${
                activeSessionId === session.id
                  ? "bg-accent border border-primary/30"
                  : "hover:bg-accent/50 border border-transparent"
              }`}
            >
              {editingId === session.id ? (
                /* Rename mode */
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRename(session.id, e);
                      if (e.key === "Escape") handleCancelRename(e);
                    }}
                    autoFocus
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => handleSaveRename(session.id, e)}
                    className="rounded p-1 hover:bg-accent"
                  >
                    <Check className="h-3 w-3 text-green-500" />
                  </button>
                  <button
                    onClick={handleCancelRename}
                    className="rounded p-1 hover:bg-accent"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                /* Normal mode */
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        activeSessionId === session.id ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {session.title || "Untitled"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground/70">
                          {session._count?.messages || 0} messages
                        </span>
                        <span className="text-xs text-muted-foreground/70">
                          {formatRelativeTime(session.lastMessageAt || session.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hover actions */}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleStartRename(session, e)}
                      className="rounded p-1 bg-background/80 hover:bg-accent"
                      aria-label="Rename"
                    >
                      <Edit2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => handleArchive(session.id, e)}
                      className="rounded p-1 bg-background/80 hover:bg-accent"
                      aria-label="Archive"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <p className="text-xs text-muted-foreground text-center">
          {sessions.length} conversation{sessions.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
