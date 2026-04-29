"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, RefreshCw, Users, CalendarDays, Activity } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Patient, Consultation } from "@/lib/models";
import QueueTable from "@/components/queue-table";
import Link from "next/link";
import { toast } from "@/components/ui/use-toast";
import { addPatientToQueue, removePatientFromQueue } from "@/lib/actions";
import { RegisterPatientDialog } from "@/components/dashboard/register-patient-dialog";
import UpcomingAppointmentsTable, { normalizeAppointmentStatus } from "@/modules/appointments/components/upcoming-appointments-table";
import type { UpcomingAppointment } from "@/modules/appointments/components/upcoming-appointments-table";
import BillingTable from "@/components/billing/billing-table";
import { BillableConsultation } from "@/lib/types";
import dynamic from "next/dynamic";
const BillModal = dynamic(() => import("@/components/billing/bill-modal"), { ssr: false });
const McModal = dynamic(() => import("@/components/mc/mc-modal"), { ssr: false });

interface RawAppointment {
  id: string;
  patientId?: string;
  patientName: string;
  clinician: string;
  reason?: string;
  status: string;
  scheduledAt?: string;
  date?: string;
}

export default function Dashboard() {
  const [queue, setQueue] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<UpcomingAppointment[]>([]);
  const [consultations, setConsultations] = useState<BillableConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [apptLoading, setApptLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [currentBillData, setCurrentBillData] = useState<{ patient: Patient | null; consultation: Consultation | null } | null>(null);
  const [billLoading, setBillLoading] = useState(false);
  const [isMcModalOpen, setIsMcModalOpen] = useState(false);
  const [currentMcData, setCurrentMcData] = useState<{ patient: Patient | null; consultation: Consultation | null } | null>(null);
  const [mcLoading, setMcLoading] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/queue');
      if (!response.ok) throw new Error(`Failed to fetch queue: ${response.statusText}`);
      const result = await response.json();
      setQueue(result.patients || []);
    } catch (err) {
      console.error('Error loading queue:', err);
      setError('Failed to load queue data.');
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async () => {
    setApptLoading(true);
    try {
      const response = await fetch('/api/appointments');
      if (!response.ok) throw new Error(`Failed to fetch appointments`);
      const result = await response.json();
      const raw: RawAppointment[] = result.appointments || [];
      const mapped: UpcomingAppointment[] = raw.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        patientName: a.patientName,
        clinician: a.clinician,
        reason: a.reason,
        status: normalizeAppointmentStatus(a.status),
        scheduledAt: a.scheduledAt || a.date || new Date().toISOString(),
      }));
      setAppointments(mapped);
    } catch (err) {
      console.error('Error loading appointments:', err);
    } finally {
      setApptLoading(false);
    }
  };

  const loadConsultations = async () => {
    try {
      const response = await fetch('/api/orders/billable');
      if (!response.ok) throw new Error('Failed to fetch consultations');
      const result = await response.json();
      setConsultations(result.consultations || []);
    } catch (err) {
      console.error('Error loading consultations:', err);
    }
  };

  const handleGenerate = async (consultationId: string, patientId: string, type: 'Bill' | 'MC' | 'Referral') => {
    if (type === 'Referral') {
      toast({ title: `Generating ${type}... (Not implemented)` });
      return;
    }

    const isBill = type === 'Bill';
    const setModalLoading = isBill ? setBillLoading : setMcLoading;
    const setCurrentData = isBill ? setCurrentBillData : setCurrentMcData;
    const setModalOpen = isBill ? setIsBillModalOpen : setIsMcModalOpen;

    setModalLoading(true);
    setCurrentData(null);
    setModalOpen(true);
    try {
      const res = await fetch(`/api/orders?consultationId=${consultationId}&patientId=${patientId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch details');
      }
      const { patient, consultation } = await res.json();
      if (!patient || !consultation) throw new Error('Failed to fetch details.');
      setCurrentData({ patient, consultation });
    } catch (err) {
      console.error(`Error fetching data for ${type}:`, err);
      toast({ title: `Error generating ${type}`, description: err instanceof Error ? err.message : 'Could not load details.', variant: 'destructive' });
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    loadAppointments();
    loadConsultations();
    const interval = setInterval(loadQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    await Promise.all([loadQueue(), loadAppointments(), loadConsultations()]);
    toast({ title: "Dashboard Updated", description: "Queue, appointments, and billing refreshed." });
  };

  const waiting = queue.filter(p => p.queueStatus === 'waiting' || p.queueStatus === 'arrived');
  const inProgress = queue.filter(p => p.queueStatus === 'in_consultation');

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((a) => {
        const scheduled = new Date(a.scheduledAt);
        return scheduled.getTime() >= now.getTime() && ["scheduled", "checked_in"].includes(a.status);
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [appointments]);

  const todayAppts = useMemo(() => {
    const now = new Date();
    return upcomingAppointments.filter((a) => {
      const d = new Date(a.scheduledAt);
      return d.toDateString() === now.toDateString();
    });
  }, [upcomingAppointments]);

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setRegisterDialogOpen(true)}>Register</Button>
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-3">
        <Card className="flex-1">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-muted-foreground">Today&apos;s Queue</p>
              <div className="text-lg font-bold">{queue.length}</div>
              <p className="text-xs text-muted-foreground">{waiting.length} waiting</p>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-muted-foreground">In Consultation</p>
              <div className="text-lg font-bold">{inProgress.length}</div>
              <p className="text-xs text-muted-foreground">active now</p>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-muted-foreground">Today&apos;s Appointments</p>
              <div className="text-lg font-bold">{todayAppts.length}</div>
              <p className="text-xs text-muted-foreground">scheduled today</p>
            </div>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-muted-foreground">Total Appointments</p>
              <div className="text-lg font-bold">{appointments.length}</div>
              <p className="text-xs text-muted-foreground">all upcoming</p>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Today&apos;s Queue</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Patient Queue</CardTitle>
              <CardDescription>Patients waiting for consultation today</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">Loading queue…</div>
              ) : error ? (
                <div className="text-center py-4 text-red-500">{error}</div>
              ) : (
                <QueueTable patients={queue} onQueueUpdate={loadQueue} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appointments</CardTitle>
              <CardDescription>
                Upcoming scheduled appointments.{" "}
                <Link href="/appointments" className="underline text-primary">View all</Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UpcomingAppointmentsTable
                appointments={upcomingAppointments}
                loading={apptLoading}
                onRefresh={loadAppointments}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing & Documents</CardTitle>
              <CardDescription>
                Generate bills, MCs, and referral letters.{" "}
                <Link href="/orders" className="underline text-primary">View all</Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BillingTable consultations={consultations} onGenerate={handleGenerate} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BillModal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        isLoading={billLoading}
        data={currentBillData}
      />

      <McModal
        isOpen={isMcModalOpen}
        onClose={() => setIsMcModalOpen(false)}
        isLoading={mcLoading}
        data={currentMcData}
      />

      <RegisterPatientDialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen} />
    </div>
  );
}
