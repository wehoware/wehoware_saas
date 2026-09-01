"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminPageHeader from "@/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/auth-context";
import { format } from "date-fns";
import {
  Plus, Target, Trophy, Loader2, Trash2, ChevronRight, ArrowLeft,
  CheckCircle2, Clock, TrendingUp, ListTodo, Calendar, User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Style maps ──────────────────────────────────────────────

const GOAL_TYPE_STYLES = {
  OKR: "bg-purple-500/10 text-purple-600",
  Goal: "bg-blue-500/10 text-blue-600",
  Milestone: "bg-cyan-500/10 text-cyan-600",
};

const STATUS_STYLES = {
  "Not Started": "bg-muted text-muted-foreground",
  "In Progress": "bg-yellow-500/10 text-yellow-600",
  "Completed": "bg-green-500/10 text-green-600",
  "Cancelled": "bg-red-500/10 text-red-600",
};

function TypeBadge({ type }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
      GOAL_TYPE_STYLES[type] || GOAL_TYPE_STYLES.Goal
    )}>
      {type}
    </span>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
      STATUS_STYLES[status] || STATUS_STYLES["Not Started"]
    )}>
      {status}
    </span>
  );
}

// ─── Stat Card ───────────────────────────────────────────────

function StatCard({ title, value, subtitle, icon: Icon, accent }) {
  return (
    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accent)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Goal Card ───────────────────────────────────────────────

function GoalCard({ goal, onSelect, onDelete, userRole }) {
  const isCompleted = goal.status === "Completed";
  const isCancelled = goal.status === "Cancelled";

  return (
    <Card
      className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
      onClick={() => onSelect(goal)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <TypeBadge type={goal.type} />
              <StatusBadge status={goal.status} />
            </div>
            <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors">
              {goal.title}
            </CardTitle>
          </div>
          {userRole === "admin" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onDelete(goal.id); }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {goal.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{goal.description}</p>
        )}

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold tabular-nums">{goal.progress_percentage}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isCompleted ? "bg-green-500"
                : isCancelled ? "bg-red-400"
                : "bg-primary"
              )}
              style={{ width: `${goal.progress_percentage}%` }}
            />
          </div>
        </div>

        {/* Dates + owner */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {goal.start_date ? format(new Date(goal.start_date), "MMM d") : "—"} →{" "}
            {goal.end_date ? format(new Date(goal.end_date), "MMM d, yyyy") : "—"}
          </span>
          {goal.owner && (
            <span className="flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              {goal.owner.first_name} {goal.owner.last_name}
            </span>
          )}
        </div>

        {/* Stats footer */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border/40">
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            {goal.key_results?.length ?? 0} key results
          </span>
          <span className="flex items-center gap-1">
            <ListTodo className="h-3 w-3" />
            {goal.task_links?.length ?? 0} linked tasks
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Create Goal Form ────────────────────────────────────────

function CreateGoalForm({ onCreated, onCancel, clients }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "Goal",
    status: "Not Started",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    key_results: [{ title: "", target_value: "", unit: "", weight: 25 }],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleKrChange = (i, field, value) =>
    setFormData((prev) => {
      const krs = [...prev.key_results];
      krs[i] = { ...krs[i], [field]: value };
      return { ...prev, key_results: krs };
    });

  const addKr = () =>
    setFormData((prev) => ({
      ...prev,
      key_results: [...prev.key_results, { title: "", target_value: "", unit: "", weight: 25 }],
    }));

  const removeKr = (i) =>
    setFormData((prev) => ({
      ...prev,
      key_results: prev.key_results.filter((_, idx) => idx !== i),
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) { setError("Title is required"); return; }
    if (!formData.start_date) { setError("Start date is required"); return; }
    if (!formData.end_date) { setError("End date is required"); return; }
    if (formData.end_date < formData.start_date) { setError("End date must be after start date"); return; }

    const key_results = formData.key_results
      .filter((kr) => kr.title.trim())
      .map((kr) => ({
        title: kr.title.trim(),
        target_value: kr.target_value ? parseFloat(kr.target_value) : undefined,
        unit: kr.unit || undefined,
        weight: parseInt(kr.weight) || 25,
      }));

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/v1/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          key_results,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create goal");
      toast.success("Goal created");
      onCreated?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Title *</label>
        <Input
          value={formData.title}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder="Goal title..."
          maxLength={500}
          disabled={submitting}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="What does success look like?"
          rows={3}
          disabled={submitting}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Type</label>
          <Select value={formData.type} onValueChange={(v) => handleChange("type", v)} disabled={submitting}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Goal">Goal</SelectItem>
              <SelectItem value="OKR">OKR</SelectItem>
              <SelectItem value="Milestone">Milestone</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Status</label>
          <Select value={formData.status} onValueChange={(v) => handleChange("status", v)} disabled={submitting}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Not Started">Not Started</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Start Date *</label>
          <Input type="date" value={formData.start_date} onChange={(e) => handleChange("start_date", e.target.value)} disabled={submitting} />
        </div>
        <div>
          <label className="text-sm font-medium">End Date *</label>
          <Input type="date" value={formData.end_date} onChange={(e) => handleChange("end_date", e.target.value)} min={formData.start_date} disabled={submitting} />
        </div>
      </div>

      {/* Key results */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Key Results</label>
          <Button type="button" variant="ghost" size="sm" onClick={addKr} disabled={submitting}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add KR
          </Button>
        </div>
        <div className="space-y-2">
          {formData.key_results.map((kr, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1.5">
                <Input
                  placeholder={`Key result ${i + 1}`}
                  value={kr.title}
                  onChange={(e) => handleKrChange(i, "title", e.target.value)}
                  disabled={submitting}
                />
                <div className="grid grid-cols-3 gap-1.5">
                  <Input
                    type="number"
                    placeholder="Target"
                    value={kr.target_value}
                    onChange={(e) => handleKrChange(i, "target_value", e.target.value)}
                    disabled={submitting}
                  />
                  <Input
                    placeholder="Unit (%, $, etc)"
                    value={kr.unit}
                    onChange={(e) => handleKrChange(i, "unit", e.target.value)}
                    disabled={submitting}
                  />
                  <Input
                    type="number"
                    placeholder="Weight %"
                    value={kr.weight}
                    min={1}
                    max={100}
                    onChange={(e) => handleKrChange(i, "weight", e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
              {formData.key_results.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeKr(i)} disabled={submitting}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
          Create Goal
        </Button>
      </div>
    </form>
  );
}

// ─── Goal Detail Sheet ───────────────────────────────────────

function GoalDetailSheet({ goal, open, onClose, onUpdated }) {
  const [editStatus, setEditStatus] = useState(goal?.status ?? "");
  const [updating, setUpdating] = useState(false);
  const [krValues, setKrValues] = useState({});

  useEffect(() => {
    if (goal) {
      setEditStatus(goal.status);
      const kv = {};
      goal.key_results?.forEach((kr) => { kv[kr.id] = { current_value: kr.current_value, status: kr.status }; });
      setKrValues(kv);
    }
  }, [goal]);

  const updateGoalStatus = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/v1/goals/${goal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast.success("Goal updated");
      onUpdated?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const updateKr = async (krId) => {
    const vals = krValues[krId];
    if (!vals) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/v1/goals/${goal.id}/key-results/${krId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_value: parseFloat(vals.current_value) || 0, status: vals.status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update KR");
      toast.success("Key result updated");
      onUpdated?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (!goal) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto scrollbar-thin">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <TypeBadge type={goal.type} />
            <StatusBadge status={goal.status} />
          </div>
          <SheetTitle>{goal.title}</SheetTitle>
          {goal.description && <SheetDescription>{goal.description}</SheetDescription>}
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-semibold tabular-nums">{goal.progress_percentage}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  goal.status === "Completed" ? "bg-green-500"
                  : goal.status === "Cancelled" ? "bg-red-400"
                  : "bg-primary"
                )}
                style={{ width: `${goal.progress_percentage}%` }}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Start
              </p>
              <p className="font-medium mt-1">{goal.start_date ? format(new Date(goal.start_date), "MMM d, yyyy") : "—"}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" /> End
              </p>
              <p className="font-medium mt-1">{goal.end_date ? format(new Date(goal.end_date), "MMM d, yyyy") : "—"}</p>
            </div>
          </div>

          {/* Status update */}
          <div>
            <label className="text-sm font-medium">Update Status</label>
            <div className="flex gap-2 mt-1.5">
              <Select value={editStatus} onValueChange={setEditStatus} disabled={updating}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Not Started">Not Started</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={updateGoalStatus} disabled={updating || editStatus === goal.status}>
                {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>

          {/* Key results */}
          {goal.key_results?.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2.5">Key Results</p>
              <div className="space-y-3">
                {goal.key_results.map((kr) => {
                  const kv = krValues[kr.id] ?? { current_value: kr.current_value, status: kr.status };
                  return (
                    <div key={kr.id} className="rounded-lg border border-border/60 p-3 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{kr.title}</p>
                        <span className={cn(
                          "text-xs font-medium rounded-full px-2 py-0.5 shrink-0",
                          STATUS_STYLES[kr.status] || STATUS_STYLES["Not Started"]
                        )}>
                          {kr.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {kr.current_value}{kr.unit ? ` ${kr.unit}` : ""} / {kr.target_value ?? "—"}{kr.unit ? ` ${kr.unit}` : ""}
                        </span>
                        <span className="font-medium">{kr.progress_percentage}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            kr.status === "Completed" ? "bg-green-500" : "bg-primary"
                          )}
                          style={{ width: `${kr.progress_percentage}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          step="any"
                          value={kv.current_value}
                          onChange={(e) => setKrValues((prev) => ({ ...prev, [kr.id]: { ...prev[kr.id], current_value: e.target.value } }))}
                          disabled={updating}
                          placeholder="Current value"
                        />
                        <Select
                          value={kv.status}
                          onValueChange={(v) => setKrValues((prev) => ({ ...prev, [kr.id]: { ...prev[kr.id], status: v } }))}
                          disabled={updating}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Not Started">Not Started</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => updateKr(kr.id)} disabled={updating}>
                        Update Key Result
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Linked tasks */}
          {goal.task_links?.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2.5">Linked Tasks ({goal.task_links.length})</p>
              <div className="space-y-1.5">
                {goal.task_links.map((link) => (
                  <div key={link.id} className="flex items-center justify-between text-sm py-2 border-b last:border-b-0 border-border/40">
                    <span className="truncate">{link.task?.title ?? "Task"}</span>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <span className={cn(
                        "text-xs font-medium rounded-full px-2 py-0.5",
                        STATUS_STYLES[link.task?.status] || "bg-muted text-muted-foreground"
                      )}>
                        {link.task?.status}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{link.contribution_pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ───────────────────────────────────────────────

export default function GoalsPage() {
  const { activeClient } = useAuth();
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [achievements, setAchievements] = useState([]);

  const fetchGoals = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/v1/goals?${params}`);
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter]);

  const fetchAchievements = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/achievements");
      if (res.ok) {
        const data = await res.json();
        setAchievements(data.achievements ?? []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (activeClient?.id) {
      fetchGoals();
      fetchAchievements();
    }
  }, [activeClient?.id, fetchGoals, fetchAchievements]);

  const handleGoalCreated = () => {
    setShowCreate(false);
    fetchGoals();
  };

  const handleDeleteGoal = async (goalId) => {
    if (!confirm("Delete this goal and all its data?")) return;
    try {
      const res = await fetch(`/api/v1/goals/${goalId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete goal");
      }
      toast.success("Goal deleted");
      fetchGoals();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSelectGoal = async (goal) => {
    try {
      const res = await fetch(`/api/v1/goals/${goal.id}`);
      if (res.ok) setSelectedGoal(await res.json());
    } catch { setSelectedGoal(goal); }
  };

  const inProgress = goals.filter((g) => g.status === "In Progress").length;
  const completed = goals.filter((g) => g.status === "Completed").length;
  const avgProgress = goals.length
    ? Math.round(goals.reduce((s, g) => s + g.progress_percentage, 0) / goals.length)
    : 0;

  return (
    <div className="flex-1 space-y-4">
      <AdminPageHeader
        title="Goals & Achievements"
        description="Track OKRs, business goals, and team achievements."
        backLink="/admin/tasks"
        backIcon={<ArrowLeft className="h-4 w-4" />}
        actionLabel="New Goal"
        actionIcon={<Plus className="mr-2 h-4 w-4" />}
        onAction={() => setShowCreate(true)}
      />

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Goals"
          value={goals.length}
          subtitle="All goals"
          icon={Target}
          accent="text-blue-500 bg-blue-500/10"
        />
        <StatCard
          title="In Progress"
          value={inProgress}
          subtitle="Currently being worked on"
          icon={Clock}
          accent="text-yellow-500 bg-yellow-500/10"
        />
        <StatCard
          title="Completed"
          value={completed}
          subtitle="Successfully achieved"
          icon={CheckCircle2}
          accent="text-green-500 bg-green-500/10"
        />
        <StatCard
          title="Avg Progress"
          value={`${avgProgress}%`}
          subtitle="Across all goals"
          icon={TrendingUp}
          accent="text-purple-500 bg-purple-500/10"
        />
      </div>

      {/* Overall progress bar */}
      {goals.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Overall Goal Progress</span>
              </div>
              <span className="text-2xl font-bold tabular-nums">{avgProgress}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                style={{ width: `${avgProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{completed} completed</span>
              <span>{goals.length - completed} remaining</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-xs font-medium text-muted-foreground">Filter:</span>
            <Select value={statusFilter || "_all"} onValueChange={(v) => setStatusFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All statuses</SelectItem>
                <SelectItem value="Not Started">Not Started</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter || "_all"} onValueChange={(v) => setTypeFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All types</SelectItem>
                <SelectItem value="Goal">Goal</SelectItem>
                <SelectItem value="OKR">OKR</SelectItem>
                <SelectItem value="Milestone">Milestone</SelectItem>
              </SelectContent>
            </Select>
            {(statusFilter || typeFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStatusFilter(""); setTypeFilter(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create goal form */}
      {showCreate && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Create New Goal</CardTitle>
            <CardDescription>Define your goal, key results, and timeline.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateGoalForm onCreated={handleGoalCreated} onCancel={() => setShowCreate(false)} />
          </CardContent>
        </Card>
      )}

      {/* Goals grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : goals.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
              <Target className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium">No goals yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Create your first goal to start tracking progress.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onSelect={handleSelectGoal}
              onDelete={handleDeleteGoal}
              userRole="admin"
            />
          ))}
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Recent Achievements
            </CardTitle>
            <CardDescription>Team milestones and awards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {achievements.slice(0, 12).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/5 px-3 py-1.5 text-sm"
                >
                  <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                  <span className="font-medium">{a.title}</span>
                  {a.user && (
                    <span className="text-muted-foreground">— {a.user.first_name}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goal detail sheet */}
      {selectedGoal && (
        <GoalDetailSheet
          goal={selectedGoal}
          open={Boolean(selectedGoal)}
          onClose={() => setSelectedGoal(null)}
          onUpdated={() => { fetchGoals(); handleSelectGoal(selectedGoal); }}
        />
      )}
    </div>
  );
}
