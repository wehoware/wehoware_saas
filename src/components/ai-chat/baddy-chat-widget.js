"use client";

// src/components/ai-chat/baddy-chat-widget.js
// Floating chat widget for the Baddy AI assistant.
// Appears on all admin pages. Uses the user's activeClientId for isolation.

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Bot, User, Loader2, Trash2, Copy, Check } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import ChatMarkdown from "@/components/ai-chat/ChatMarkdown";

export default function BaddyChatWidget() {
  const { user, activeClient, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isStreaming) {
      inputRef.current?.focus();
    }
  }, [isOpen, isStreaming]);

  // Reset messages when client changes (enforce isolation in UI too)
  useEffect(() => {
    setMessages([]);
  }, [activeClient?.id]);

  const handleCopy = (content, idx) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const sendMessage = useCallback(async (overrideText) => {
    const trimmed = (overrideText !== undefined ? overrideText : input).trim();
    if (!trimmed || isStreaming) return;

    const userMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    // Add a placeholder for the assistant response
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          enableThinking: false,
        }),
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
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                  return updated;
                });
              }
              if (data.done) {
                // Stream complete
              }
              if (data.error) {
                throw new Error(data.content || data.error);
              }
            } catch (e) {
              // Ignore parse errors for partial lines
            }
          }
        }
      }

      if (!assistantContent) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "I didn't get a response. Please try again.",
          };
          return updated;
        });
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `⚠️ ${err.message || "Connection error. Please try again."}`,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages]);

  // Don't render if not authenticated or no active client
  if (loading || !user || !activeClient) return null;

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { icon: "📊", label: "CRM Dashboard", text: "Show me the CRM dashboard" },
    { icon: "⏰", label: "Overdue Tasks", text: "What tasks are overdue?" },
    { icon: "🧾", label: "Recent Invoices", text: "List recent invoices" },
    { icon: "👥", label: "Contacts", text: "How many contacts do we have?" },
  ];

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-110 hover:shadow-xl"
          aria-label="Open Baddy AI Chat"
        >
          <MessageSquare className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
          </span>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[600px] max-h-[calc(100vh-3rem)] w-[400px] max-w-[calc(100vw-3rem)] flex-col rounded-2xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                <Bot className="h-5 w-5 text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
              </div>
              <div>
                <div className="font-semibold">Baddy AI</div>
                <div className="text-xs text-muted-foreground">
                  {activeClient?.name || "No client"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <div>
                  <div className="font-medium">Hi, I&apos;m Baddy</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Your AI assistant for {activeClient?.name || "your business"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                  {quickActions.map((action) => (
                    <button
                      key={action.text}
                      onClick={() => {
                        setInput(action.text);
                        setTimeout(() => sendMessage(action.text), 50);
                      }}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-left transition-all hover:bg-accent hover:border-primary/30"
                    >
                      <span className="text-base">{action.icon}</span>
                      <span className="text-xs">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`group relative max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
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
                          className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Copy"
                        >
                          {copiedIdx === idx ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isStreaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                </div>
                <div className="bg-muted rounded-2xl px-4 py-2 text-sm text-muted-foreground flex items-center gap-1">
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
          <div className="border-t border-border p-4">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Baddy anything..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary max-h-32"
                disabled={isStreaming}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                {isStreaming ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">
              Baddy can only see data for {activeClient?.name || "your client"}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
