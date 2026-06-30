"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STATUS_DOT_COLORS } from "@/lib/social-clients/constants.js";

const STATUS_BADGE = {
  Scheduled: "bg-blue-100 text-blue-700",
  Publishing: "bg-yellow-100 text-yellow-700",
  Published: "bg-green-100 text-green-700",
  PartiallyPublished: "bg-orange-100 text-orange-700",
  Failed: "bg-red-100 text-red-700",
  Cancelled: "bg-gray-100 text-gray-600",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SocialCalendarPage() {
  const { user } = useAuth();
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [calendarData, setCalendarData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayPosts, setSelectedDayPosts] = useState([]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;

  const loadCalendar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/social/calendar?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed to load calendar");
      const data = await res.json();
      setCalendarData(data.calendar || {});
    } catch {
      toast.error("Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }, [user, year, month]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  function prevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setSelectedDay(null);
  }

  function handleDayClick(dateStr, posts) {
    setSelectedDay(dateStr);
    setSelectedDayPosts(posts || []);
  }

  // Build calendar grid
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const grid = [];
  for (let i = 0; i < firstDayOfWeek; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              Content Calendar
            </h1>
            <p className="text-muted-foreground mt-1">View and manage scheduled posts</p>
          </div>
          <Link href="/admin/social-media/posts/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Post
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={prevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle>{MONTHS[month - 1]} {year}</CardTitle>
              <Button variant="ghost" size="sm" onClick={nextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              {Object.entries(STATUS_DOT_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1 text-xs">
                  <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                  <span className="text-muted-foreground">{status}</span>
                </div>
              ))}
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            {loading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="h-20 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {grid.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="h-20" />;
                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const posts = calendarData[dateStr] || [];
                  const isToday = today.getDate() === day && today.getMonth() + 1 === month && today.getFullYear() === year;
                  const isSelected = selectedDay === dateStr;

                  return (
                    <div
                      key={dateStr}
                      className={`h-20 p-1 rounded-lg border cursor-pointer transition-colors ${
                        isToday ? "border-primary bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/50"
                      } ${isSelected ? "ring-2 ring-primary" : ""}`}
                      onClick={() => handleDayClick(dateStr, posts)}
                    >
                      <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : ""}`}>{day}</div>
                      <div className="flex flex-wrap gap-0.5">
                        {posts.slice(0, 3).map((post, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[post.status] || "bg-gray-400"}`}
                            title={`${post.status}: ${post.content}`}
                          />
                        ))}
                        {posts.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{posts.length - 3}</span>
                        )}
                      </div>
                      {posts.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-tight line-clamp-1">
                          {posts.length} post{posts.length > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Day detail dialog */}
        <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedDay ? new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : ""}
              </DialogTitle>
            </DialogHeader>
            {selectedDayPosts.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No posts scheduled for this day</p>
                <Link href="/admin/social-media/posts/create">
                  <Button variant="outline" size="sm" className="mt-2">Schedule a Post</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayPosts.map((post) => (
                  <Link key={post.id} href={`/admin/social-media/posts/${post.id}`} onClick={() => setSelectedDay(null)}>
                    <div className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-xs ${STATUS_BADGE[post.status] || ""}`}>
                          {post.status}
                        </Badge>
                        {post.platforms?.map((code) => (
                          <Badge key={code} variant="secondary" className="text-xs capitalize">{code}</Badge>
                        ))}
                      </div>
                      <p className="text-sm font-medium">{post.title || post.content?.slice(0, 60)}</p>
                      {post.scheduled_for && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(post.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
