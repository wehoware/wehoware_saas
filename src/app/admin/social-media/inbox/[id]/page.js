"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Archive, RotateCcw, CheckCheck, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "react-hot-toast";

const PLATFORM_LABELS = {
  facebook: "Messenger",
  instagram: "Instagram DM",
  twitter: "Twitter DM",
  tiktok: "TikTok Comments",
};

const PLATFORM_COLORS = {
  facebook: "bg-blue-100 text-blue-700",
  instagram: "bg-pink-100 text-pink-700",
  twitter: "bg-sky-100 text-sky-700",
  tiktok: "bg-black/10 text-gray-800",
};

const STATUS_COLORS = {
  Open: "bg-green-100 text-green-700",
  Archived: "bg-gray-100 text-gray-600",
  Closed: "bg-red-100 text-red-700",
};

function MessageBubble({ message, isOwn }) {
  const time = message.sent_at
    ? new Date(message.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const date = message.sent_at
    ? new Date(message.sent_at).toLocaleDateString()
    : "";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3`}>
      {!isOwn && (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold mr-2 flex-shrink-0 mt-1 uppercase">
          {message.sender_avatar
            ? <img src={message.sender_avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            : (message.sender_name?.[0] || "?")}
        </div>
      )}
      <div className={`max-w-xs lg:max-w-md ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
        {!isOwn && (
          <p className="text-xs text-muted-foreground mb-1 ml-1">{message.sender_name}</p>
        )}
        <div className={`px-3 py-2 rounded-2xl text-sm ${
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          {(message.media_urls || []).length > 0 && (
            <div className="mt-2 space-y-1">
              {message.media_urls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer"
                  className="text-xs underline opacity-80 block truncate">
                  📎 {url}
                </a>
              ))}
            </div>
          )}
        </div>
        <p className={`text-xs text-muted-foreground mt-0.5 ${isOwn ? "mr-1" : "ml-1"}`}>
          {date} {time}
          {isOwn && message.is_read && (
            <CheckCheck className="h-3 w-3 inline ml-1 text-primary" />
          )}
        </p>
        {/* TikTok comment likes */}
        {message.metadata?.likes > 0 && (
          <p className="text-xs text-muted-foreground ml-1">❤️ {message.metadata.likes}</p>
        )}
      </div>
    </div>
  );
}

export default function InboxConversationPage() {
  const { user } = useAuth();
  const params = useParams();
  const messagesEndRef = useRef(null);

  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadConversation = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/social/inbox/${params.id}`);
      if (!res.ok) { toast.error("Conversation not found"); return; }
      const data = await res.json();
      setConversation(data.conversation);

      // Mark as read silently
      await fetch(`/api/v1/social/inbox/${params.id}/read`, { method: "POST" });
    } catch {
      toast.error("Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => { if (user) loadConversation(); }, [user, loadConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  async function handleSend() {
    const text = replyText.trim();
    if (!text) return;
    if (!conversation) return;

    setSending(true);
    try {
      const res = await fetch(`/api/v1/social/inbox/${params.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");

      // Append the new outbound message locally
      setConversation((prev) => ({
        ...prev,
        messages: [...(prev.messages || []), data.message],
        last_message_at: data.message.sent_at,
        last_message_preview: text.slice(0, 100),
      }));
      setReplyText("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  async function updateStatus(status) {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/v1/social/inbox/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setConversation((prev) => ({ ...prev, status }));
      toast.success(`Conversation ${status.toLowerCase()}`);
    } catch {
      toast.error("Failed to update conversation");
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="h-16 bg-muted rounded-lg animate-pulse mb-4" />
        <div className="flex-1 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-12 bg-muted rounded-2xl animate-pulse ${i % 2 === 0 ? "ml-auto w-48" : "w-64"}`} />
          ))}
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Conversation not found</p>
        <Link href="/admin/social-media/inbox">
          <Button variant="outline" size="sm" className="mt-3">Back to Inbox</Button>
        </Link>
      </div>
    );
  }

  const isTikTok = conversation.platform_code === "tiktok";
  const isClosed = conversation.status === "Closed";

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/admin/social-media/inbox">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Inbox
            </Button>
          </Link>
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold uppercase flex-shrink-0">
            {conversation.participant_avatar
              ? <img src={conversation.participant_avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
              : (conversation.participant_name?.[0] || "?")}
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">{conversation.participant_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {conversation.participant_handle && (
                <span className="text-xs text-muted-foreground">{conversation.participant_handle}</span>
              )}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[conversation.platform_code] || "bg-gray-100"}`}>
                {PLATFORM_LABELS[conversation.platform_code] || conversation.platform_code}
              </span>
              <Badge variant="outline" className={`text-xs ${STATUS_COLORS[conversation.status] || ""}`}>
                {conversation.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {conversation.status !== "Archived" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={updatingStatus}
              onClick={() => updateStatus("Archived")}
              title="Archive"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
          {conversation.status === "Archived" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={updatingStatus}
              onClick={() => updateStatus("Open")}
              title="Reopen"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          {conversation.status === "Open" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={updatingStatus}
              onClick={() => updateStatus("Closed")}
              title="Close conversation"
            >
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {conversation.messages?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No messages yet</p>
          </div>
        ) : (
          conversation.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.direction === "Outbound"}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply box */}
      <div className="border-t pt-4 flex-shrink-0">
        {isClosed ? (
          <div className="text-center py-3">
            <p className="text-sm text-muted-foreground mb-2">This conversation is closed.</p>
            <Button variant="outline" size="sm" onClick={() => updateStatus("Open")}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reopen to reply
            </Button>
          </div>
        ) : (
          <div className="flex gap-3">
            <Textarea
              placeholder={
                isTikTok
                  ? "Post a comment on this video..."
                  : `Reply to ${conversation.participant_name}...`
              }
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              className="flex-1 resize-none"
            />
            <Button
              onClick={handleSend}
              disabled={sending || !replyText.trim()}
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {isTikTok
            ? "Replies appear as comments on the video"
            : "Press Enter to send · Shift+Enter for new line"}
        </p>
      </div>
    </div>
  );
}
