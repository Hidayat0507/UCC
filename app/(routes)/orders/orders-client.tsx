'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { BillableConsultation } from '@/lib/types';
import BillingTable from "@/components/billing/billing-table";
import { useToast } from "@/components/ui/use-toast";

interface OrdersClientProps {
  initialConsultations: BillableConsultation[];
  otcContext?: {
    patientId: string;
    patientName?: string;
  };
  checkoutComplete?: {
    invoiceId?: string;
    invoiceNumber?: string;
  };
}

export default function OrdersClient({ initialConsultations, otcContext, checkoutComplete }: OrdersClientProps) {
  const { toast } = useToast();
  const checkoutToastShown = useRef(false);
  const [consultations, setConsultations] = useState<BillableConsultation[]>(initialConsultations);

  useEffect(() => {
    if (!checkoutComplete || checkoutToastShown.current) return;

    checkoutToastShown.current = true;
    toast({
      title: "Checkout completed",
      description: `Invoice ${checkoutComplete.invoiceNumber || checkoutComplete.invoiceId || "record"} was saved.`,
    });

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("checkout");
    cleanUrl.searchParams.delete("invoiceId");
    cleanUrl.searchParams.delete("invoiceNumber");
    window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }, [checkoutComplete, toast]);

  useEffect(() => {
    let active = true;

    fetch("/api/orders/billable", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (active && Array.isArray(payload?.consultations)) {
          setConsultations(payload.consultations);
        }
      })
      .catch((error) => {
        console.error("Failed to refresh billable consultations:", error);
      });

    return () => {
      active = false;
    };
  }, []);

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

      <Card>
        <CardHeader>
          <CardTitle>Ready for Billing</CardTitle>
          <CardDescription>Select a patient to open checkout.</CardDescription>
        </CardHeader>
        <CardContent>
          <BillingTable consultations={consultations} />
        </CardContent>
      </Card>
    </div>
  );
}
