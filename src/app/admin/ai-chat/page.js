"use client";

// src/app/admin/ai-chat/page.js
// Full-page AI chat interface for Baddy.
// Available to all roles (admin, employee, client) — data is scoped to activeClientId.

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, User, Loader2, Sparkles, Trash2, Copy, Check,
  Wrench, TrendingUp, FileText, Search, Plus, MessageSquare,
  ArrowDown, Square, PanelRightClose, PanelRightOpen, Calendar,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ChatMarkdown from "@/components/ai-chat/ChatMarkdown";

const BADDY_AVATAR = "/images/wehoware%20logo.png";

function getUserInitials(user) {
  const first = user?.firstName || "";
  const last = user?.lastName || "";
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (user?.email) return user.email.slice(0, 2).toUpperCase();
  return "U";
}

function formatTimestamp(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatSessionDate(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const QUICK_ACTION_CATEGORIES = [
  {
    icon: TrendingUp,
    label: "CRM",
    color: "text-cyan-500 bg-cyan-500/10",
    actions: [
      "Show me the CRM dashboard",
      "How many contacts do we have?",
      "List open deals",
    ],
  },
  {
    icon: Wrench,
    label: "Tasks",
    color: "text-orange-500 bg-orange-500/10",
    actions: [
      "What tasks are overdue?",
      "Show my completed tasks this week",
    ],
  },
  {
    icon: FileText,
    label: "Finance",
    color: "text-green-500 bg-green-500/10",
    actions: [
      "List recent invoices",
      "Show outstanding bills",
    ],
  },
  {
    icon: Search,
    label: "SEO & Social",
    color: "text-purple-500 bg-purple-500/10",
    actions: [
      "Get SEO keywords",
      "Show social media analytics",
    ],
  },
];

export default function AIChatPage() {
  const { user, activeClient, loading } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when streaming stops
  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  // Track scroll position to show/hide scroll-to-bottom button
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollDown(!isNearBottom);
  }, []);

  // Load session list
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/ai/sessions", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error("[ai-chat] Failed to load sessions:", err);
    }
  }, []);

  // Load messages for a specific session
  const loadSession = useCallback(async (id) => {
    setIsLoadingHistory(true);
    try {
      const msgRes = await fetch(`/api/v1/ai/sessions/${id}/messages`, {
        credentials: "include",
      });
      if (!msgRes.ok) return;
      const msgData = await msgRes.json();
      const dbMessages = (msgData.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }));
      setSessionId(id);
      setMessages(dbMessages);
    } catch (err) {
      console.error("[ai-chat] Failed to load session:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Load chat history + sessions when client changes
  useEffect(() => {
    if (!activeClient?.id || !user) return;

    let cancelled = false;

    async function loadHistory() {
      setIsLoadingHistory(true);
      try {
        await fetchSessions();
        const res = await fetch("/api/v1/ai/sessions", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const sessionList = data.sessions || [];

        if (sessionList.length === 0) {
          if (!cancelled) {
            setMessages([]);
            setSessionId(null);
          }
          return;
        }

        if (!cancelled) await loadSession(sessionList[0].id);
      } catch (err) {
        console.error("[ai-chat] Failed to load history:", err);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [activeClient?.id, user?.id, fetchSessions, loadSession]);

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setInput("");
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
    textareaRef.current?.focus();
  };

  const handleSelectSession = (id) => {
    if (id === sessionId) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
    loadSession(id);
  };

  const handleClearChat = () => {
    setMessages([]);
    setSessionId(null);
    setInput("");
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  const handleCopy = (content, idx) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 128) + "px";
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeClient) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">Please select a client to start chatting with Baddy.</p>
        </div>
      </div>
    );
  }

  const sendMessage = async (overrideText) => {
    const trimmed = (overrideText !== undefined ? overrideText : input).trim();
    if (!trimmed || isStreaming) return;

    const userMessage = { role: "user", content: trimmed, createdAt: new Date().toISOString() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, enableThinking: false, sessionId }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                assistantContent += data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                  return updated;
                });
              }
              if (data.done) {
                if (data.sessionId) setSessionId(data.sessionId);
              }
              if (data.error) {
                throw new Error(data.content || data.error);
              }
            } catch (e) {
              if (e.message && !e.message.includes("JSON")) throw e;
            }
          }
        }
      }

      if (!assistantContent) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "I didn't get a response. Please try again." };
          return updated;
        });
      }

      // Refresh session list after a successful message
      fetchSessions();
    } catch (err) {
      if (err.name === "AbortError") {
        // User stopped streaming — keep partial content, just stop the spinner
        setMessages((prev) => {
          const updated = [...prev];
          if (updated[updated.length - 1]?.role === "assistant" && !updated[updated.length - 1]?.content) {
            updated[updated.length - 1] = { role: "assistant", content: "*(stopped)*" };
          }
          return updated;
        });
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: `Error: ${err.message}` };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0">
      {/* ─── Session Sidebar ─── */}
      {showSidebar && (
        <div className="w-64 shrink-0 border-r border-border flex flex-col bg-muted/30">
          <div className="p-3 border-b border-border">
            <Button
              onClick={handleNewChat}
              className="w-full"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
            {sessions.length === 0 ? (
              <div className="text-center py-8 px-3">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No conversations yet</p>
              </div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors group",
                    s.id === sessionId
                      ? "bg-primary/10 text-foreground border border-primary/20"
                      : "hover:bg-accent text-muted-foreground hover:text-foreground border border-transparent"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-xs leading-tight">
                        {s.title || "Untitled"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {formatSessionDate(s.updatedAt)}
                        </span>
                        {s._count?.messages > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            · {s._count.messages} msgs
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── Main Chat Area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full overflow-hidden ring-2 ring-blue-500/30">
              <img src={BADDY_AVATAR} alt="Baddy" className="h-full w-full object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                Baddy AI
                <Sparkles className="h-4 w-4 text-yellow-500" />
              </h1>
              <p className="text-xs text-muted-foreground">
                Connected to {activeClient?.name} — data scoped to this client
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={showSidebar ? "Hide sessions" : "Show sessions"}
              title={showSidebar ? "Hide sessions" : "Show sessions"}
            >
              {showSidebar ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto space-y-4 pb-4 scrollbar-thin relative"
        >
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            /* ─── Empty State ─── */
            <div className="flex flex-col items-center justify-center h-full space-y-6 px-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full overflow-hidden ring-2 ring-blue-500/30 shadow-lg">
                <img src={BADDY_AVATAR} alt="Baddy" className="h-full w-full object-cover" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold">Hi, I&apos;m Baddy</h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
                  Your AI assistant for {activeClient?.name}. I can help with CRM, tasks,
                  invoices, social media, SEO, and more.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
                {QUICK_ACTION_CATEGORIES.map((cat) => (
                  <div key={cat.label} className="rounded-xl border border-border/60 p-3 space-y-2 bg-card/50">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", cat.color)}>
                        <cat.icon className="h-3.5 w-3.5" />
                      </div>
                      {cat.label}
                    </div>
                    {cat.actions.map((action) => (
                      <button
                        key={action}
                        onClick={() => {
                          setInput(action);
                          setTimeout(() => sendMessage(action), 50);
                        }}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm text-left transition-all hover:bg-accent hover:border-primary/30 hover:shadow-sm"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ─── Messages ─── */
            <>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden ring-1 ring-blue-500/30">
                      <img src={BADDY_AVATAR} alt="Baddy" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start", "max-w-[75%] sm:max-w-prose")}>
                    <div
                      className={cn(
                        "group relative rounded-2xl px-4 py-3 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <>
                          {msg.content ? (
                            <ChatMarkdown content={msg.content} />
                          ) : (
                            <span className="text-muted-foreground">...</span>
                          )}
                          {isStreaming && idx === messages.length - 1 && msg.content && (
                            <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-500 animate-pulse rounded-sm align-middle" />
                          )}
                          {msg.content && !isStreaming && (
                            <button
                              onClick={() => handleCopy(msg.content, idx)}
                              className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background opacity-0 transition-opacity group-hover:opacity-100"
                              aria-label="Copy response"
                            >
                              {copiedIdx === idx ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      )}
                    </div>
                    {msg.createdAt && (
                      <span className="text-[10px] text-muted-foreground mt-1 px-1">
                        {formatTimestamp(msg.createdAt)}
                      </span>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <Avatar className="h-9 w-9 shrink-0 border border-border">
                      {user?.avatarUrl ? (
                        <AvatarImage src={user.avatarUrl} alt={user.firstName || "You"} />
                      ) : null}
                      <AvatarFallback className="text-xs font-medium bg-muted">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {/* Thinking indicator */}
              {isStreaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
                <div className="flex gap-3 justify-start">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden ring-1 ring-blue-500/30">
                    <img src={BADDY_AVATAR} alt="Baddy" className="h-full w-full object-cover opacity-70" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 text-sm text-muted-foreground flex items-center gap-1.5">
                    <span>Thinking</span>
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}

          {/* Scroll-to-bottom button */}
          {showScrollDown && messages.length > 0 && !isLoadingHistory && (
            <button
              onClick={scrollToBottom}
              className="sticky bottom-4 left-1/2 -translate-x-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background shadow-md transition-all hover:shadow-lg text-muted-foreground hover:text-foreground"
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border pt-3">
          <div className="flex items-center gap-2 mx-auto max-w-3xl">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask Baddy anything about your business..."
                rows={1}
                className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3.5 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-primary max-h-32 scrollbar-thin"
                disabled={isStreaming}
              />
            </div>
            {isStreaming ? (
              <button
                onClick={handleStopStreaming}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
                aria-label="Stop generating"
                title="Stop"
              >
                <Square className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Baddy can see data for {activeClient?.name} only — press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
