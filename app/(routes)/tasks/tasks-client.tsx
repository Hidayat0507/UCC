"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, ClipboardCheck, Clock, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UnifiedTaskItem } from "@/lib/fhir/task-reminder-service";

type TaskFilter = "open" | "follow-ups" | "billing" | "all";
type UpdateStatus = "in-progress" | "completed" | "cancelled";

type TaskSummary = {
  dueFollowUps: number;
  attentionNeeded: number;
  billingExceptions: number;
};

function formatDate(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function sourceBadge(task: UnifiedTaskItem) {
  if (task.source === "follow-up") {
    return (
      <Badge variant="secondary" className="bg-sky-100 text-sky-700 hover:bg-sky-100 border-sky-200">
        <MessageCircle className="mr-1 h-3 w-3" />
        Follow Up
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">
      <ClipboardCheck className="mr-1 h-3 w-3" />
      Billing
    </Badge>
  );
}

function statusBadge(task: UnifiedTaskItem) {
  if (task.status === "due") return <Badge>Due</Badge>;
  if (task.status === "blocked") return <Badge variant="destructive">Missing phone</Badge>;
  if (task.status === "failed") return <Badge variant="destructive">Failed</Badge>;
  if (task.status === "requested") return <Badge variant="secondary">Requested</Badge>;
  if (task.status === "in-progress") return <Badge>In Progress</Badge>;
  if (task.status === "completed") return <Badge variant="outline">Completed</Badge>;
  if (task.status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge variant="outline">{task.status}</Badge>;
}

function statCard(label: string, count: number, hint: string, icon: ReactNode) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{count}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function queryForFilter(filter: TaskFilter): string {
  if (filter === "follow-ups") return "type=follow-up&status=open";
  if (filter === "billing") return "type=billing-exception&status=open";
  if (filter === "all") return "type=all&status=all";
  return "type=all&status=open";
}

export function TasksClient() {
  const [filter, setFilter] = useState<TaskFilter>("open");
  const [tasks, setTasks] = useState<UnifiedTaskItem[]>([]);
  const [summary, setSummary] = useState<TaskSummary>({
    dueFollowUps: 0,
    attentionNeeded: 0,
    billingExceptions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleSummary = useMemo(() => {
    if (filter !== "all") return summary;
    return {
      dueFollowUps: tasks.filter((task) => task.kind === "follow-up-due").length,
      attentionNeeded: tasks.filter((task) => task.kind === "follow-up-missing-phone" || task.kind === "follow-up-failed").length,
      billingExceptions: tasks.filter((task) => task.kind === "billing-exception").length,
    };
  }, [filter, summary, tasks]);

  async function loadTasks(nextFilter: TaskFilter) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks?${queryForFilter(nextFilter)}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to load tasks");
      }
      setTasks(payload.tasks || []);
      setSummary(payload.summary || { dueFollowUps: 0, attentionNeeded: 0, billingExceptions: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadTasks(filter);
    });
  }, [filter]);

  async function updateStatus(taskId: string, status: UpdateStatus) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.success) {
          throw new Error(payload?.error || "Failed to update task");
        }
        await loadTasks(filter);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update task");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground mt-1">
          Daily clinic checklist for due follow-ups, attention items, and billing exceptions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {statCard("Due follow-ups", visibleSummary.dueFollowUps, "WhatsApp reminders ready for staff action.", <Clock className="h-4 w-4" />)}
        {statCard("Attention needed", visibleSummary.attentionNeeded, "Missing phone numbers and failed sends.", <AlertTriangle className="h-4 w-4" />)}
        {statCard("Billing exceptions", visibleSummary.billingExceptions, "Checkout issues that need resolution.", <ClipboardCheck className="h-4 w-4" />)}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-end justify-between">
          <div>
            <CardTitle>Queue</CardTitle>
            <CardDescription>Open items are staff actions that should be reviewed today.</CardDescription>
          </div>
          <div className="w-44">
            <Select value={filter} onValueChange={(value) => setFilter(value as TaskFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="follow-ups">Follow-ups</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm text-destructive mb-3">{error}</p> : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <ClipboardCheck className="h-6 w-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">No staff action needed</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Due follow-ups and exceptions will appear here.</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={`${task.source}-${task.id}`}>
                    <TableCell>{sourceBadge(task)}</TableCell>
                    <TableCell>{task.patient}</TableCell>
                    <TableCell className="max-w-[420px]">
                      <div className="font-medium">{task.title}</div>
                      {task.description ? (
                        <div className="truncate text-xs text-muted-foreground" title={task.description}>
                          {task.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatDate(task.dueDate || task.createdAt)}</TableCell>
                    <TableCell>{statusBadge(task)}</TableCell>
                    <TableCell>
                      {task.source === "follow-up" ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={task.actionHref || "/follow-up"}>Open Follow Up</Link>
                        </Button>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending || task.status === "in-progress"}
                            onClick={() => updateStatus(task.id, "in-progress")}
                          >
                            In Progress
                          </Button>
                          <Button
                            size="sm"
                            disabled={isPending || task.status === "completed"}
                            onClick={() => updateStatus(task.id, "completed")}
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isPending || task.status === "cancelled"}
                            onClick={() => updateStatus(task.id, "cancelled")}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
