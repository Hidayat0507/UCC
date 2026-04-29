'use client';

import { useState } from 'react';
import { Consultation, Patient } from "@/lib/models";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { BillableConsultation } from '@/lib/types';
import dynamic from "next/dynamic";
import BillingTable from "@/components/billing/billing-table";
const BillModal = dynamic(() => import("@/components/billing/bill-modal"), { ssr: false });
const McModal = dynamic(() => import("@/components/mc/mc-modal"), { ssr: false });

interface OrdersClientProps {
  initialConsultations: BillableConsultation[];
  otcContext?: {
    patientId: string;
    patientName?: string;
  };
}

export default function OrdersClient({ initialConsultations, otcContext }: OrdersClientProps) {
  const [consultations] = useState<BillableConsultation[]>(initialConsultations);
  const { toast } = useToast();

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [currentBillData, setCurrentBillData] = useState<{ patient: Patient | null; consultation: Consultation | null } | null>(null);
  const [billLoading, setBillLoading] = useState(false);

  const [isMcModalOpen, setIsMcModalOpen] = useState(false);
  const [currentMcData, setCurrentMcData] = useState<{ patient: Patient | null; consultation: Consultation | null } | null>(null);
  const [mcLoading, setMcLoading] = useState(false);

  const fetchDetails = async (consultationId: string, patientId: string) => {
    const res = await fetch(`/api/orders?consultationId=${consultationId}&patientId=${patientId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch details');
    }
    return res.json();
  };

  const handleGenerate = async (consultationId: string, patientId: string, type: 'Bill' | 'MC' | 'Referral') => {
    if (type === 'Referral') {
      toast({ title: `Generating ${type}... (Not implemented)` });
      return;
    }

    const isBill = type === 'Bill';
    const setLoading = isBill ? setBillLoading : setMcLoading;
    const setCurrentData = isBill ? setCurrentBillData : setCurrentMcData;
    const setModalOpen = isBill ? setIsBillModalOpen : setIsMcModalOpen;

    setLoading(true);
    setCurrentData(null);
    setModalOpen(true);
    try {
      const { patient, consultation } = await fetchDetails(consultationId, patientId);
      if (!patient || !consultation) throw new Error('Failed to fetch details.');
      setCurrentData({ patient, consultation });
    } catch (err) {
      console.error(`Error fetching data for ${type}:`, err);
      toast({ title: `Error generating ${type}`, description: err instanceof Error ? err.message : 'Could not load details.', variant: 'destructive' });
      setModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 container mx-auto py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Documents</h1>
        <p className="text-muted-foreground">
          Generate bills, MCs, and referral letters for completed consultations.
        </p>
      </div>

      {otcContext ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm font-medium">OTC registration handoff received</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Patient {otcContext.patientName || otcContext.patientId} was sent from registration. Use search and complete billing actions for this patient.
            </p>
            <div className="mt-3">
              <Link href={`/patients/${otcContext.patientId}`} className="text-sm underline">
                Open patient profile
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Completed Consultations</CardTitle>
          <CardDescription>Select a consultation to generate documents.</CardDescription>
        </CardHeader>
        <CardContent>
          <BillingTable consultations={consultations} onGenerate={handleGenerate} />
        </CardContent>
      </Card>

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
    </div>
  );
}
