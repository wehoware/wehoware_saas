"use client";

// src/app/admin/ai-chat/page.js
// Full-page AI chat interface for Baddy.
// Available to all roles (admin, employee, client) — data is scoped to activeClientId.

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, Sparkles, Trash2, Copy, Check, Wrench, TrendingUp, FileText, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import ChatMarkdown from "@/components/ai-chat/ChatMarkdown";

export default function AIChatPage() {
  const { user, activeClient, loading } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  // Load chat history when client changes
  useEffect(() => {
    if (!activeClient?.id || !user) return;

    let cancelled = false;

    async function loadHistory() {
      setIsLoadingHistory(true);
      try {
        const res = await fetch("/api/v1/ai/sessions", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const sessions = data.sessions || [];

        if (sessions.length === 0) {
          if (!cancelled) {
            setMessages([]);
            setSessionId(null);
          }
          return;
        }

        const latestSession = sessions[0];
        const msgRes = await fetch(`/api/v1/ai/sessions/${latestSession.id}/messages`, {
          credentials: "include",
        });
        if (!msgRes.ok) return;
        const msgData = await msgRes.json();
        const dbMessages = (msgData.messages || []).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        if (!cancelled) {
          setSessionId(latestSession.id);
          setMessages(dbMessages);
        }
      } catch (err) {
        console.error("[ai-chat] Failed to load history:", err);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [activeClient?.id, user?.id]);

  const handleClearChat = () => {
    setMessages([]);
    setSessionId(null);
    setInput("");
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

    const userMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, enableThinking: false, sessionId }),
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
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: `Error: ${err.message}` };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActionCategories = [
    {
      icon: TrendingUp,
      label: "CRM",
      actions: [
        "Show me the CRM dashboard",
        "How many contacts do we have?",
        "List open deals",
      ],
    },
    {
      icon: Wrench,
      label: "Tasks",
      actions: [
        "What tasks are overdue?",
        "Show my completed tasks this week",
      ],
    },
    {
      icon: FileText,
      label: "Finance",
      actions: [
        "List recent invoices",
        "Show outstanding bills",
      ],
    },
    {
      icon: Search,
      label: "SEO",
      actions: [
        "Get SEO keywords",
        "Show social media analytics",
      ],
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Baddy AI Assistant
              <Sparkles className="h-4 w-4 text-yellow-500" />
            </h1>
            <p className="text-sm text-muted-foreground">
              Connected to {activeClient?.name} — data is scoped to this client only
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <Bot className="h-10 w-10 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold">Hi, I&apos;m Baddy</h2>
              <p className="text-muted-foreground mt-1">
                Your AI assistant for {activeClient?.name}. Ask me about your CRM, tasks, invoices, and more.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-2xl w-full">
              {quickActionCategories.map((cat) => (
                <div key={cat.label} className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-1">
                    <cat.icon className="h-3.5 w-3.5" />
                    {cat.label}
                  </div>
                  {cat.actions.map((action) => (
                    <button
                      key={action}
                      onClick={() => {
                        setInput(action);
                        setTimeout(() => sendMessage(action), 50);
                      }}
                      className="w-full rounded-xl border border-border px-4 py-2.5 text-sm text-left transition-all hover:bg-accent hover:border-primary/30"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                <Bot className="h-5 w-5 text-white" />
              </div>
            )}
            <div
              className={`group relative max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
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
            {msg.role === "user" && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
          <div className="flex gap-3 justify-start">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-3 text-sm text-muted-foreground flex items-center gap-1">
              <span>Thinking</span>
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border pt-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask Baddy anything about your business..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary max-h-32"
            disabled={isStreaming}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isStreaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground text-center">
          Baddy can see data for {activeClient?.name} only — press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
