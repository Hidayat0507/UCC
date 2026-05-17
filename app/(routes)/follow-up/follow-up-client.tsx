"use client";

import type { ReactNode } from "react";
import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import {
  Bell,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  SendHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import type { FollowUp, FollowUpType } from "@/lib/fhir/communication-service";

type Tab = "pending" | "scheduled" | "sent";

const STATUS_BY_TAB = {
  pending: "preparation",
  scheduled: "in-progress",
  sent: "completed",
} as const;

const MAX_MESSAGE_LENGTH = 500;

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function TypeBadge({ type }: { type: FollowUpType }) {
  if (type === "review-request") {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">
        <Calendar className="mr-1 h-3 w-3" />
        Review Request
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
      <Bell className="mr-1 h-3 w-3" />
      Appointment Reminder
    </Badge>
  );
}

function StatusBadge({ status }: { status: FollowUp["status"] }) {
  switch (status) {
    case "preparation":
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Pending</Badge>;
    case "in-progress":
      return <Badge variant="secondary" className="bg-sky-100 text-sky-700 hover:bg-sky-100 border-sky-200">Scheduled</Badge>;
    case "completed":
      return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Sent</Badge>;
    case "stopped":
      return <Badge variant="secondary" className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function EmptyState({ tab }: { tab: Tab }) {
  const content: Record<Tab, { title: string; description: string }> = {
    pending: {
      title: "No pending follow ups",
      description: "Create a new follow up using the button above.",
    },
    scheduled: {
      title: "No scheduled follow ups",
      description: "Pending follow ups that have been scheduled will appear here.",
    },
    sent: {
      title: "No follow ups sent yet",
      description: "Follow ups marked as sent will appear here.",
    },
  };
  const { title, description } = content[tab];
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={5}>
        <div className="flex flex-col items-center gap-3 py-14">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <MessageCircle className="h-6 w-6 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatCard({
  icon,
  label,
  count,
  hint,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{count}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

interface NewFollowUpForm {
  patientId: string;
  patientName: string;
  type: FollowUpType;
  message: string;
  dueDate: string;
}

const EMPTY_FORM: NewFollowUpForm = {
  patientId: "",
  patientName: "",
  type: "review-request",
  message: "",
  dueDate: "",
};

type PatientResult = { id: string; name: string };

interface Props {
  initialFollowUps: FollowUp[];
}

export default function FollowUpClient({ initialFollowUps }: Props) {
  const [followUps, setFollowUps] = useState<FollowUp[]>(initialFollowUps);
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewFollowUpForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Patient search state
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientInputRef = useRef<HTMLInputElement>(null);

  // Debounced patient search — fires when user types in the patient field
  useEffect(() => {
    const q = form.patientName.trim();
    // If a patient is already confirmed or query too short, skip the search
    if (form.patientId || q.length < 2) {
      setPatientResults([]);
      setShowPatientDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setPatientSearching(true);
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(q)}`);
        const payload = await res.json().catch(() => ({}));
        if (res.ok && payload.success) {
          const results: PatientResult[] = (payload.patients ?? []).map(
            (p: { id: string; fullName: string }) => ({ id: p.id, name: p.fullName })
          );
          setPatientResults(results);
          setShowPatientDropdown(results.length > 0);
        }
      } catch {
        // silent — leave previous results
      } finally {
        setPatientSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [form.patientName, form.patientId]);

  const filtered = useMemo(() => {
    const targetStatus = STATUS_BY_TAB[activeTab];
    return followUps.filter((f) => {
      if (f.status !== targetStatus) return false;
      if (!search.trim()) return true;
      return f.patientName.toLowerCase().includes(search.toLowerCase());
    });
  }, [followUps, activeTab, search]);

  async function reload() {
    try {
      const res = await fetch("/api/follow-up");
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.success) {
        setFollowUps(payload.followUps ?? []);
      }
    } catch {
      // silent — stale data is acceptable on reload failure
    }
  }

  async function handleCreate() {
    setFormError(null);
    if (!form.patientName.trim()) { setFormError("Patient name is required."); return; }
    if (!form.message.trim()) { setFormError("Message is required."); return; }

    startTransition(async () => {
      try {
        const res = await fetch("/api/follow-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientName: form.patientName.trim(),
            patientId: form.patientId || undefined,
            type: form.type,
            message: form.message.trim(),
            dueDate: form.dueDate || undefined,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to create");
        toast({ title: "Follow up created", description: `Added for ${form.patientName}.` });
        setDialogOpen(false);
        setForm(EMPTY_FORM);
        await reload();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Failed to create follow up.");
      }
    });
  }

  async function handleSend(id: string, patientName: string) {
    setActionId(id);
    try {
      const res = await fetch(`/api/follow-up/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to send");
      toast({ title: "Sent", description: `Follow up for ${patientName} marked as sent.` });
      await reload();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send follow up.",
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  }

  async function handleDismiss(id: string, patientName: string) {
    setActionId(id);
    try {
      const res = await fetch(`/api/follow-up/${id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to dismiss");
      toast({ title: "Dismissed", description: `Follow up for ${patientName} removed.` });
      setFollowUps((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to dismiss follow up.",
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  }

  const totals = useMemo(
    () => ({
      pending: followUps.filter((f) => f.status === "preparation").length,
      scheduled: followUps.filter((f) => f.status === "in-progress").length,
      sent: followUps.filter((f) => f.status === "completed").length,
    }),
    [followUps]
  );

  const tabCounts = useMemo(() => {
    const q = search.toLowerCase().trim();
    const countFor = (status: string) =>
      followUps.filter(
        (f) => f.status === status && (!q || f.patientName.toLowerCase().includes(q))
      ).length;
    return {
      pending: countFor("preparation"),
      scheduled: countFor("in-progress"),
      sent: countFor("completed"),
    };
  }, [followUps, search]);

  const charCountColor =
    form.message.length > MAX_MESSAGE_LENGTH * 0.9 ? "text-amber-600" : "text-muted-foreground";

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Follow Up</h1>
        <p className="text-sm text-muted-foreground">
          Manage patient follow ups and reminders
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          label="Pending"
          count={totals.pending}
          hint="Awaiting action"
        />
        <StatCard
          icon={<CalendarClock className="h-4 w-4 text-sky-600" />}
          label="Scheduled"
          count={totals.scheduled}
          hint="Queued to send"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          label="Sent"
          count={totals.sent}
          hint="Successfully delivered"
        />
      </div>

      {/* Search + New Follow Up */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by patient name..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setForm(EMPTY_FORM);
              setFormError(null);
              setPatientResults([]);
              setShowPatientDropdown(false);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Follow Up
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Follow Up</DialogTitle>
              <DialogDescription>Create a follow up reminder for a patient.</DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Patient name — live search */}
              <div className="space-y-1.5">
                <div>
                  <label className="text-sm font-medium">Patient name</label>
                  <p className="text-xs text-muted-foreground">
                    Full name of the patient requiring follow up
                  </p>
                </div>
                <div className="relative">
                  {patientSearching ? (
                    <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  ) : (
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  )}
                  <Input
                    ref={patientInputRef}
                    className="pl-9"
                    placeholder="Type to search patients…"
                    autoComplete="off"
                    value={form.patientName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((f) => ({ ...f, patientName: value, patientId: "" }));
                      if (!value.trim()) {
                        setPatientResults([]);
                        setShowPatientDropdown(false);
                      }
                    }}
                    onFocus={() => {
                      if (patientResults.length > 0) setShowPatientDropdown(true);
                    }}
                    onBlur={() => {
                      // delay so a click on a result item can fire first
                      setTimeout(() => setShowPatientDropdown(false), 150);
                    }}
                  />
                  {showPatientDropdown && patientResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-md border border-slate-200 bg-white shadow-md">
                      {patientResults.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setForm((f) => ({ ...f, patientName: patient.name, patientId: patient.id }));
                            setShowPatientDropdown(false);
                            setPatientResults([]);
                          }}
                        >
                          <UserRound className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          {patient.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.patientId ? (
                  <p className="flex items-center gap-1 text-xs text-emerald-600">
                    <Check className="h-3 w-3" />
                    Patient matched
                  </p>
                ) : null}
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <p className="text-xs text-muted-foreground">
                    Choose the kind of follow up to send
                  </p>
                </div>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as FollowUpType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="review-request">Review Request</SelectItem>
                    <SelectItem value="appointment-reminder">Appointment Reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Message + char counter */}
              <div className="space-y-1.5">
                <div className="flex items-end justify-between">
                  <div>
                    <label className="text-sm font-medium">Message</label>
                    <p className="text-xs text-muted-foreground">
                      The content that will be sent to the patient
                    </p>
                  </div>
                  <span className={`text-xs tabular-nums ${charCountColor}`}>
                    {form.message.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                </div>
                <Textarea
                  placeholder="Enter the follow up message..."
                  rows={3}
                  maxLength={MAX_MESSAGE_LENGTH}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>

              {/* Schedule for (due date) */}
              <div className="space-y-1.5">
                <div>
                  <label className="text-sm font-medium">
                    Schedule for{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    When this follow up should be actioned or sent
                  </p>
                </div>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>

              {formError ? (
                <p className="text-sm text-destructive">{formError}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as Tab)}
        className="space-y-4"
      >
        <TabsList className="h-auto flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          <TabsTrigger value="pending" className="rounded-xl">
            Pending
            {tabCounts.pending > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                {tabCounts.pending}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="rounded-xl">
            Scheduled
            {tabCounts.scheduled > 0 && (
              <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
                {tabCounts.scheduled}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="rounded-xl">
            Sent
            {tabCounts.sent > 0 && (
              <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                {tabCounts.sent}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {(["pending", "scheduled", "sent"] as Tab[]).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-hidden rounded-[inherit] px-6">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="w-48 px-4 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Patient
                        </TableHead>
                        <TableHead className="w-48 px-4 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Type
                        </TableHead>
                        <TableHead className="w-36 px-4 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Schedule
                        </TableHead>
                        <TableHead className="w-28 px-4 py-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Status
                        </TableHead>
                        <TableHead className="w-32 px-4 py-4 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <EmptyState tab={tab} />
                      ) : (
                        filtered.map((followUp) => (
                          <TableRow
                            key={followUp.id}
                            className="border-slate-100 hover:bg-slate-50/60"
                          >
                            <TableCell className="w-48 px-4 py-4 font-medium text-slate-900">
                              {followUp.patientName}
                            </TableCell>
                            <TableCell className="w-48 px-4 py-4">
                              <TypeBadge type={followUp.type} />
                            </TableCell>
                            <TableCell className="w-36 px-4 py-4 text-sm text-slate-500">
                              {formatDate(followUp.dueDate)}
                            </TableCell>
                            <TableCell className="w-28 px-4 py-4">
                              <StatusBadge status={followUp.status} />
                            </TableCell>
                            <TableCell className="w-32 px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {followUp.status !== "completed" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    disabled={actionId === followUp.id}
                                    title="Mark this follow up as sent"
                                    onClick={() => handleSend(followUp.id, followUp.patientName)}
                                  >
                                    {actionId === followUp.id ? (
                                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <SendHorizontal className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    Send now
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  disabled={actionId === followUp.id}
                                  title="Remove this follow up"
                                  onClick={() => handleDismiss(followUp.id, followUp.patientName)}
                                >
                                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                  Dismiss
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
