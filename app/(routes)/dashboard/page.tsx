"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  Users, 
  Calendar, 
  Clock, 
  Heart,
  MoreHorizontal,
  RefreshCw
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Patient } from "@/lib/models";
import QueueTable from "@/components/queue-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('queue');
  const [queue, setQueue] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/queue');
      if (!response.ok) {
        throw new Error(`Failed to fetch queue: ${response.statusText}`);
      }
      const result = await response.json();
      setQueue(result.patients || []);
    } catch (err) {
      console.error('Error loading queue:', err);
      setError('Failed to load queue data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    loadQueue();

    // Set up refresh interval (every 30 seconds)
    const interval = setInterval(loadQueue, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    await loadQueue();
    toast({
      title: "Queue Updated",
      description: "Patient queue has been refreshed.",
    });
  };

  const handleStartConsultation = async (patient: Patient) => {
    try {
      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patientId: patient.id }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to add patient to queue');
      }
      toast({
        title: "Consultation Started",
        description: `${patient.fullName}'s consultation has been started.`,
      });
      await loadQueue();
    } catch (error) {
      console.error('Error starting consultation:', error);
      toast({
        title: "Error",
        description: "Failed to start consultation. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCompleteConsultation = async (patient: Patient) => {
    try {
      const response = await fetch('/api/queue', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patientId: patient.id }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to remove patient from queue');
      }
      toast({
        title: "Consultation Completed",
        description: `${patient.fullName}'s consultation has been completed.`,
      });
      await loadQueue();
    } catch (error) {
      console.error('Error completing consultation:', error);
      toast({
        title: "Error",
        description: "Failed to complete consultation. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, Dr. Smith</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {/* Notifications button removed per request */}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              +20.1% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Queue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queue.length}</div>
            <p className="text-xs text-muted-foreground">
              {queue.filter(p => p.queueStatus === 'waiting' || p.queueStatus === 'arrived').length} waiting/arrived patients
            </p>
          </CardContent>
        </Card>
        
      </div>

      {/* Main Content - Simplified to only show Queue Tab */}
      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Today&apos;s Queue</TabsTrigger>
          {/* REMOVED: Overview, Appointments, Patients, Analytics TabsTrigger */}
          {/* <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger> */}
        </TabsList>
        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Patient Queue</CardTitle>
              <CardDescription>Patients waiting for consultation today</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading queue...</div>
              ) : error ? (
                <div className="text-center py-4 text-red-500">{error}</div>
              ) : (
                <QueueTable 
                  patients={queue} 
                  onQueueUpdate={loadQueue}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* REMOVED: Overview, Appointments, Patients, Analytics TabsContent */}
        {/* <TabsContent value="overview" className="space-y-4"> ... </TabsContent> */}
        {/* <TabsContent value="appointments"> ... </TabsContent> */}
        {/* <TabsContent value="patients"> ... </TabsContent> */}
        {/* <TabsContent value="analytics"> ... </TabsContent> */}
      </Tabs>
    </div>
  );
}
