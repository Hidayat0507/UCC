"use client";

import { Patient } from "@/lib/models";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MoreHorizontal, UserPlus, X, Receipt, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { TRIAGE_LEVELS } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { QueueStatus } from "@/lib/types";
import { useRouter } from 'next/navigation';

interface QueueTableProps {
  patients: Patient[];
  onQueueUpdate?: () => Promise<void>;
}

function formatAddedAt(value?: string | Date | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const iso = date.toISOString();
  return iso.slice(11, 19); // HH:MM:SS (UTC) to avoid hydration mismatch
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function QueueTable({ patients, onQueueUpdate }: QueueTableProps) {
  const router = useRouter();

  const handleAddToQueue = async (patient: Patient) => {
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add to queue');
      }
      toast({
        title: "Added to Queue",
        description: `${patient.fullName} has been added to the queue.`,
      });
      if (onQueueUpdate) {
        await onQueueUpdate();
      }
    } catch (error) {
      console.error('Error adding to queue:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add to queue. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleStartConsultation = async (patient: Patient) => {
    try {
      const res = await fetch('/api/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient.id, status: 'in_consultation' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update status');
      }
      router.push(`/patients/${patient.id}/consultation`);
      
      toast({
        title: "Starting Consultation",
        description: `Redirecting to ${patient.fullName}'s consultation page...`,
      });
      
      if (onQueueUpdate) {
        await onQueueUpdate();
      }
    } catch (error) {
      console.error('Error starting consultation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start consultation. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCompleteConsultation = async (patient: Patient) => {
    try {
      const res = await fetch('/api/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient.id, status: 'completed' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update status');
      }
      toast({
        title: "Consultation Completed",
        description: `${patient.fullName}'s consultation has been marked as completed.`,
      });
      if (onQueueUpdate) {
        await onQueueUpdate();
      }
    } catch (error) {
      console.error('Error completing consultation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete consultation. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveFromQueue = async (patient: Patient) => {
    try {
      const res = await fetch('/api/queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to remove from queue');
      }
      toast({
        title: "Removed from Queue",
        description: `${patient.fullName} has been removed from the queue.`,
      });
      if (onQueueUpdate) {
        await onQueueUpdate();
      }
    } catch (error) {
      console.error('Error removing from queue:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove from queue. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: QueueStatus | undefined) => {
    switch (status) {
      case 'arrived':
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Arrived (awaiting triage)
          </Badge>
        );
      case 'waiting':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Waiting
          </Badge>
        );
      case 'in_consultation':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <UserPlus className="h-3 w-3" />
            In Consultation
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <X className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'meds_and_bills':
        return (
          <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-400 text-zinc-900 hover:bg-yellow-500">
            <Receipt className="h-3 w-3" />
            Meds & Bills
          </Badge>
        );
      default:
        return null;
    }
  };

  const getTriageBadge = (triageLevel: number | undefined) => {
    if (!triageLevel) {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Not Triaged
        </Badge>
      );
    }

    const triageInfo = TRIAGE_LEVELS[triageLevel as keyof typeof TRIAGE_LEVELS];
    const colorClasses = {
      1: "bg-red-500 text-white hover:bg-red-600",
      2: "bg-orange-500 text-white hover:bg-orange-600",
      3: "bg-yellow-500 text-zinc-900 hover:bg-yellow-600",
      4: "bg-green-500 text-white hover:bg-green-600",
      5: "bg-blue-500 text-white hover:bg-blue-600",
    };

    return (
      <Badge className={`flex items-center gap-1 ${colorClasses[triageLevel as keyof typeof colorClasses]}`}>
        <span className="font-bold">{triageLevel}</span>
        <span className="hidden md:inline">- {triageInfo?.label}</span>
      </Badge>
    );
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Queue No.</TableHead>
            <TableHead>Patient Name</TableHead>
            <TableHead>NRIC</TableHead>
            <TableHead>Triage Level</TableHead>
            <TableHead>Chief Complaint</TableHead>
            <TableHead>Visit Context</TableHead>
            <TableHead>Added At</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient, index) => (
            <TableRow key={patient.id}>
              <TableCell className="font-medium text-center">{(index + 1).toString().padStart(3, '0')}</TableCell>
              <TableCell className="font-medium">
                <Link
                  href={`/patients/${patient.id}`}
                  className="hover:underline"
                >
                  {patient.fullName}
                </Link>
              </TableCell>
              <TableCell>{patient.nric}</TableCell>
              <TableCell>
                {getTriageBadge(patient.triage?.triageLevel)}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {patient.triage?.chiefComplaint || 'N/A'}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {patient.visitIntent ? (
                    <Badge variant="outline">{formatLabel(patient.visitIntent)}</Badge>
                  ) : null}
                  {patient.payerType ? (
                    <Badge variant="secondary">{formatLabel(patient.payerType)}</Badge>
                  ) : null}
                  {patient.assignedClinician ? (
                    <Badge variant="outline" className="max-w-[160px] truncate">
                      {patient.assignedClinician}
                    </Badge>
                  ) : null}
                  {!patient.visitIntent && !patient.payerType && !patient.assignedClinician ? (
                    <span className="text-xs text-muted-foreground">N/A</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                {formatAddedAt(patient.queueAddedAt)}
              </TableCell>
              <TableCell>
                {getStatusBadge(patient.queueStatus)}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/patients/${patient.id}`}>
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    {!patient.triage?.isTriaged && (
                      <DropdownMenuItem asChild>
                        <Link href={`/patients/${patient.id}/triage`}>
                          Perform Triage
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {patient.queueStatus === 'waiting' && (
                      <DropdownMenuItem onClick={() => handleStartConsultation(patient)}>
                        Start Consultation
                      </DropdownMenuItem>
                    )}
                    {(patient.queueStatus === 'waiting' || patient.queueStatus === 'in_consultation' || patient.queueStatus === 'meds_and_bills') && (
                      <DropdownMenuItem onClick={() => handleCompleteConsultation(patient)}>
                        Mark as Complete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {patients.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-4">
                No patients in queue
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
} 
