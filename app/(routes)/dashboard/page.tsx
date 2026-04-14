"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, RefreshCw, Users, CalendarDays, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Patient } from "@/lib/models";
import QueueTable from "@/components/queue-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { addPatientToQueue, removePatientFromQueue } from "@/lib/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Appointment {
  id: string;
  patientName: string;
  date: string;
  status: string;
  reason?: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [queue, setQueue] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [apptLoading, setApptLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);

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
      setAppointments(result.appointments || []);
    } catch (err) {
      console.error('Error loading appointments:', err);
    } finally {
      setApptLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    loadAppointments();
    const interval = setInterval(loadQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    await Promise.all([loadQueue(), loadAppointments()]);
    toast({ title: "Dashboard Updated", description: "Queue and appointments refreshed." });
  };

  const waiting = queue.filter(p => p.queueStatus === 'waiting' || p.queueStatus === 'arrived');
  const inProgress = queue.filter(p => p.queueStatus === 'in_consultation');
  const todayAppts = appointments.filter(a => {
    const d = new Date(a.date);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  return (
    <div className="flex flex-col space-y-6">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Queue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queue.length}</div>
            <p className="text-xs text-muted-foreground">{waiting.length} waiting</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Consultation</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgress.length}</div>
            <p className="text-xs text-muted-foreground">active now</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Appointments</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayAppts.length}</div>
            <p className="text-xs text-muted-foreground">scheduled today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{appointments.length}</div>
            <p className="text-xs text-muted-foreground">all upcoming</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Today&apos;s Queue</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
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
              {apptLoading ? (
                <div className="text-center py-4 text-muted-foreground">Loading appointments…</div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No upcoming appointments.{" "}
                  <Link href="/appointments/new" className="underline text-primary">Schedule one</Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.slice(0, 20).map((appt) => (
                      <TableRow key={appt.id}>
                        <TableCell className="font-medium">{appt.patientName || '—'}</TableCell>
                        <TableCell>{appt.date ? new Date(appt.date).toLocaleString() : '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{appt.reason || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={appt.status === 'booked' ? 'default' : 'secondary'}>
                            {appt.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Patient</DialogTitle>
            <DialogDescription>
              Choose how you want to start registration, just like front-desk flow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => {
                setRegisterDialogOpen(false);
                router.push("/patients/new");
              }}
            >
              Add new patient
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => {
                setRegisterDialogOpen(false);
                router.push("/check-in");
              }}
            >
              Search existing patient
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRegisterDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
