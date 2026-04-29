'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { BillableConsultation } from '@/lib/types';
import BillingTable from "@/components/billing/billing-table";

interface OrdersClientProps {
  initialConsultations: BillableConsultation[];
  otcContext?: {
    patientId: string;
    patientName?: string;
  };
  checkoutComplete?: {
    invoiceId?: string;
  };
}

export default function OrdersClient({ initialConsultations, otcContext, checkoutComplete }: OrdersClientProps) {
  const [consultations] = useState<BillableConsultation[]>(initialConsultations);

  return (
    <div className="space-y-6 container mx-auto py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Documents</h1>
        <p className="text-muted-foreground">
          Open checkout for completed consultations and manage visit documents.
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

      {checkoutComplete ? (
        <Card className="border-emerald-500/30 bg-emerald-500/10">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
              Checkout completed
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Medplum invoice {checkoutComplete.invoiceId || "record"} was saved and the visit was marked completed.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Completed Consultations</CardTitle>
          <CardDescription>Select a patient to open checkout.</CardDescription>
        </CardHeader>
        <CardContent>
          <BillingTable consultations={consultations} />
        </CardContent>
      </Card>
    </div>
  );
}
