'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Clock, CheckCircle2, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { getAllPatients, type Patient } from "@/lib/fhir/patient-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMedplumAuth } from "@/lib/auth-medplum";

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    followUps: 0,
    inQueue: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { loading: authLoading } = useMedplumAuth();

  useEffect(() => {
    if (authLoading) {
      return;
    }

    async function loadPatients() {
      setLoading(true);
      setError(null);
      try {
        // 🎯 LOAD FROM MEDPLUM (FHIR) - Source of Truth
        const data = await getAllPatients(200);
        const active = data.filter((p) => (p as any).active !== false);
        console.log(`✅ Loaded ${active.length} active patients from Medplum FHIR`);

        setPatients(active as any);
        
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        
        setStats({
          total: data.length,
          new: data.filter((p) => {
            const createdAt = p.createdAt ? new Date(p.createdAt) : null;
            return createdAt && createdAt >= monthStart;
          }).length,
          followUps: data.filter((p) => {
            const lastVisit = (p as any).lastVisit ? new Date((p as any).lastVisit) : null;
            return lastVisit && lastVisit >= weekStart;
          }).length,
          inQueue: data.filter((p) => ['arrived', 'waiting', 'in_consultation'].includes((p as any).queueStatus)).length
        });
      } catch (err) {
        console.error('Error loading patients from Medplum:', err);
        const message =
          err instanceof Error ? err.message : 'Failed to load patient data from FHIR.';
        setError(
          message.includes('Authentication required')
            ? `${message} If you are signed in, try refreshing the page.`
            : message
        );
      } finally {
        setLoading(false);
      }
    }

    loadPatients();
  }, [authLoading]);

  const filteredPatients = useMemo(() => {
    if (!searchQuery) {
      return patients;
    }
    const searchLower = searchQuery.toLowerCase();
    return patients.filter((patient) => {
      return (
        (patient.fullName && patient.fullName.toLowerCase().includes(searchLower)) ||
        (patient.nric && patient.nric.includes(searchQuery)) ||
        (patient.phone && patient.phone.includes(searchQuery))
      );
    });
  }, [patients, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patients</h1>
          <p className="text-muted-foreground">
            Manage and view patient information
          </p>
        </div>
        <Button asChild>
          <Link href="/patients/new">
            <Plus className="mr-2 h-4 w-4" />
            New Patient
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <UserRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Current active patients</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.new}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Follow-ups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.followUps}</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Queue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inQueue}</div>
            <p className="text-xs text-muted-foreground">Waiting for consultation</p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Patient List</CardTitle>
          <CardDescription>
            View and manage all patient records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              className="pl-9 pr-4 py-2 w-full rounded-md border border-input bg-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {loading && <p>Loading...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!loading && !error && (
            <div className="mt-6 relative border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>NRIC</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/patients/${patient.id}`}
                            className="hover:underline"
                          >
                            {patient.fullName}
                          </Link>
                        </TableCell>
                        <TableCell>{patient.nric}</TableCell>
                        <TableCell>{patient.gender}</TableCell>
                        <TableCell>{patient.phone}</TableCell>
                        <TableCell>
                          {(patient as any).lastVisit 
                            ? new Date((patient as any).lastVisit).toLocaleDateString()
                            : 'No visits'}
                        </TableCell>
                        <TableCell>
                          {(patient as any).queueStatus === 'waiting' ? (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              In Queue
                            </Badge>
                          ) : (patient as any).queueStatus === 'arrived' ? (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Arrived
                            </Badge>
                          ) : (patient as any).lastVisit ? (
                            <Badge variant="outline">Active</Badge>
                          ) : (
                            <Badge variant="outline">New</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm">
                            <Link href={`/patients/${patient.id}/check-in`}>
                              Check-in
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        No patients found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
