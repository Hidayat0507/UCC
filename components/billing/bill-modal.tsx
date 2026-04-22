"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Patient, Consultation } from "@/lib/models";
import { formatDisplayDate } from "@/lib/utils";
import { Loader2, Download } from "lucide-react";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { BillDocument } from "@/components/bill-document";
import {
  fetchOrganizationDetails,
  type OrganizationDetails,
} from "@/lib/org";

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  data: { patient: Patient | null; consultation: Consultation | null } | null;
}

const DEFAULT_CONSULTATION_FEE = 50;

export default function BillModal({ isOpen, onClose, isLoading, data }: BillModalProps) {
  const { patient, consultation } = data || {};
  const [organization, setOrganization] = useState<OrganizationDetails | null>(null);
  const [orgLoaded, setOrgLoaded] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);

  useEffect(() => {
    let active = true;
    setOrgLoading(true);
    fetchOrganizationDetails()
      .then((info) => {
        if (!active) return;
        setOrganization(info);
        setOrgLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setOrgLoaded(true);
      })
      .finally(() => {
        if (!active) return;
        setOrgLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const ensureOrganizationDetails = async (): Promise<OrganizationDetails | null> => {
    if (orgLoaded) {
      return organization;
    }

    setOrgLoading(true);
    try {
      const info = await fetchOrganizationDetails();
      setOrganization(info);
      setOrgLoaded(true);
      return info;
    } finally {
      setOrgLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!patient || !consultation) return;
    const orgInfo = await ensureOrganizationDetails();
    const dataForPdf = buildBillData(patient, consultation);
    const blob = await pdf(<BillDocument data={dataForPdf} organization={orgInfo} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-${dataForPdf.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveInvoice = async () => {
    if (!patient || !consultation?.id) return;
    setSavingInvoice(true);
    try {
      const response = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId: consultation.id,
          patientId: patient.id,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save invoice');
      }
    } finally {
      setSavingInvoice(false);
    }
  };

  const buildBillData = (patient: Patient, consultation: Consultation) => {
    const prescriptions = (consultation.prescriptions || []).map((p) => ({
      name: p.medication?.name || 'Medication',
      dosage: [p.medication?.strength, p.frequency, p.duration].filter(Boolean).join(' · '),
      price: p.price ?? 0,
    }));
    const procedures = (consultation.procedures || []).map((proc) => ({
      name: proc.name,
      description: proc.notes || '',
      price: proc.price ?? 0,
    }));
    const hasBillableItems =
      prescriptions.some((item) => item.price > 0) || procedures.some((item) => item.price > 0);

    return {
      id: consultation.id || `${patient.id}-${new Date().getTime()}`,
      patientName: patient.fullName,
      date: formatDisplayDate(consultation.date || new Date()),
      prescriptions,
      procedures: hasBillableItems
        ? procedures
        : [
            {
              name: 'Consultation Fee',
              description: 'Default consultation charge',
              price: DEFAULT_CONSULTATION_FEE,
            },
          ],
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl w-[95vw] p-0 overflow-hidden">
        <div className="flex h-[85vh] flex-col">
          <DialogHeader className="px-6 py-4 border-b space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold">Invoice / Bill</DialogTitle>
                <DialogDescription>
                  {patient && consultation ? (
                    <span>
                      {patient.fullName} · {formatDisplayDate(consultation.date)}
                    </span>
                  ) : (
                    <span>Details of charges for the consultation.</span>
                  )}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2" />
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 px-6 py-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !patient || !consultation ? (
              <div className="text-center py-10 text-muted-foreground">
                Failed to load bill details.
              </div>
            ) : (
              <div className="h-full border rounded-lg overflow-hidden">
                <PDFViewer className="w-full h-full">
                  <BillDocument
                    data={buildBillData(patient, consultation)}
                    organization={organization}
                  />
                </PDFViewer>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {patient && consultation && (
              <Button
                variant="secondary"
                onClick={handleSaveInvoice}
                disabled={isLoading || savingInvoice}
              >
                {savingInvoice ? 'Saving…' : 'Save Invoice'}
              </Button>
            )}
            {patient && consultation && (
              <Button
                onClick={handleDownloadPdf}
                disabled={isLoading || (orgLoading && !orgLoaded) || savingInvoice}
              >
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
