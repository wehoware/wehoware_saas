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
import { Plus, Target, Trophy, Loader2, Trash2, ChevronRight, ArrowLeft } from "lucide-react";

const GOAL_TYPE_COLORS = { OKR: "default", Goal: "secondary", Milestone: "outline" };
const STATUS_COLORS = {
  "Not Started": "secondary",
  "In Progress": "default",
  Completed: "outline",
  Cancelled: "destructive",
};

function GoalCard({ goal, onSelect, onDelete, userRole }) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => onSelect(goal)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant={GOAL_TYPE_COLORS[goal.type] ?? "secondary"}>{goal.type}</Badge>
              <Badge variant={STATUS_COLORS[goal.status] ?? "secondary"}>{goal.status}</Badge>
            </div>
            <CardTitle className="text-base leading-snug">{goal.title}</CardTitle>
          </div>
          {userRole === "admin" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
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
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="font-medium">{goal.progress_percentage}%</span>
          </div>
          <Progress value={goal.progress_percentage} className="h-1.5" />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {goal.start_date ? format(new Date(goal.start_date), "MMM d") : "—"} →{" "}
            {goal.end_date ? format(new Date(goal.end_date), "MMM d, yyyy") : "—"}
          </span>
          {goal.owner && (
            <span>
              {goal.owner.first_name} {goal.owner.last_name}
            </span>
          )}
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{goal.key_results?.length ?? 0} key results</span>
          <span>{goal.task_links?.length ?? 0} linked tasks</span>
        </div>
        <Button variant="ghost" size="sm" className="w-full mt-1" onClick={(e) => { e.stopPropagation(); onSelect(goal); }}>
          View Details <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

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
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant={GOAL_TYPE_COLORS[goal.type]}>{goal.type}</Badge>
            <Badge variant={STATUS_COLORS[goal.status]}>{goal.status}</Badge>
          </div>
          <SheetTitle>{goal.title}</SheetTitle>
          {goal.description && <SheetDescription>{goal.description}</SheetDescription>}
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{goal.progress_percentage}%</span>
            </div>
            <Progress value={goal.progress_percentage} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Start</p>
              <p>{goal.start_date ? format(new Date(goal.start_date), "MMM d, yyyy") : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">End</p>
              <p>{goal.end_date ? format(new Date(goal.end_date), "MMM d, yyyy") : "—"}</p>
            </div>
          </div>

          {/* Status update */}
          <div>
            <label className="text-sm font-medium">Update Status</label>
            <div className="flex gap-2 mt-1">
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
              <p className="text-sm font-medium mb-2">Key Results</p>
              <div className="space-y-3">
                {goal.key_results.map((kr) => {
                  const kv = krValues[kr.id] ?? { current_value: kr.current_value, status: kr.status };
                  return (
                    <div key={kr.id} className="border rounded-md p-3 space-y-2">
                      <p className="text-sm font-medium">{kr.title}</p>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {kr.current_value}{kr.unit ? ` ${kr.unit}` : ""} / {kr.target_value ?? "—"}{kr.unit ? ` ${kr.unit}` : ""}
                        </span>
                        <span>{kr.progress_percentage}%</span>
                      </div>
                      <Progress value={kr.progress_percentage} className="h-1" />
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
                        Update
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
              <p className="text-sm font-medium mb-2">Linked Tasks ({goal.task_links.length})</p>
              <div className="space-y-1.5">
                {goal.task_links.map((link) => (
                  <div key={link.id} className="flex items-center justify-between text-sm py-1 border-b last:border-b-0">
                    <span className="truncate">{link.task?.title ?? "Task"}</span>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <Badge variant="outline" className="text-xs">{link.task?.status}</Badge>
                      <span className="text-xs text-muted-foreground">{link.contribution_pct}%</span>
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
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <AdminPageHeader
        title="Goals & Achievements"
        description="Track OKRs, business goals, and team achievements."
        backLink="/admin/tasks"
        backIcon={<ArrowLeft className="h-4 w-4" />}
        actionLabel="New Goal"
        actionIcon={<Plus className="mr-2 h-4 w-4" />}
        onAction={() => setShowCreate(true)}
      />

      {/* Summary row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Goals</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{goals.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">In Progress</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{inProgress}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Completed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{completed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Avg Progress</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{avgProgress}%</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
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
          </div>
        </CardContent>
      </Card>

      {/* Create goal form */}
      {showCreate && (
        <Card>
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
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No goals yet. Create your first goal to get started.</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Recent Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {achievements.slice(0, 12).map((a) => (
                <div key={a.id} className="flex items-center gap-2 border rounded-full px-3 py-1.5 text-sm">
                  <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                  <span>{a.title}</span>
                  {a.user && <span className="text-muted-foreground">— {a.user.first_name}</span>}
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
