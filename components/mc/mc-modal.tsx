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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Patient, Consultation } from "@/lib/models";
import { formatDisplayDate } from "@/lib/utils";
import { Loader2, Download } from "lucide-react";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { McDocument } from "./mc-document";
import {
  fetchOrganizationDetails,
  type OrganizationDetails,
} from "@/lib/org";

interface McModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  data: { patient: Patient | null; consultation: Consultation | null } | null;
}

export default function McModal({ isOpen, onClose, isLoading, data }: McModalProps) {
  const { patient, consultation } = data || {};

  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [numDaysText, setNumDaysText] = useState<string>("1");
  const [doctorName, setDoctorName] = useState("Dr. Default");

  const [organization, setOrganization] = useState<OrganizationDetails | null>(null);
  const [orgLoaded, setOrgLoaded] = useState(false);
  const [orgLoading, setOrgLoading] = useState(true);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
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
    });
    return () => {
      active = false;
    };
  }, []);

  const getSafeNumDays = () => {
    const n = parseInt(numDaysText, 10);
    if (Number.isNaN(n) || n <= 0) return 1;
    return n;
  };

  const isValidNumDays = () => {
    const n = parseInt(numDaysText, 10);
    return !Number.isNaN(n) && n >= 1 && n <= 365;
  };

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
    if (!patient || !consultation || !isValidNumDays()) return;

    const orgInfo = await ensureOrganizationDetails();
    const issued = formatDisplayDate(new Date());
    const start = formatDisplayDate(startDate);
    const end = calculateEndDate();

    const blob = await pdf(
      <McDocument
        patient={patient}
        issuedDate={issued}
        startDate={start}
        endDate={end}
        numDays={getSafeNumDays()}
        doctorName={doctorName}
        organization={orgInfo}
      />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mc-${patient.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const calculateEndDate = () => {
    const n = parseInt(numDaysText, 10);
    if (!startDate || Number.isNaN(n) || n <= 0) return "N/A";
    const start = new Date(startDate);
    start.setDate(start.getDate() + n - 1);
    return formatDisplayDate(start);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl w-[95vw] p-0 overflow-hidden">
        <div className="flex h-[90vh] flex-col">
          <DialogHeader className="px-6 py-4 border-b space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle>Medical Certificate (MC)</DialogTitle>
                <DialogDescription>
                  {patient ? `${patient.fullName}` : "Generate an MC for the patient."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-4 flex-1 min-h-0">
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !patient || !consultation ? (
              <div className="text-center py-10 text-muted-foreground">
                Failed to load required data.
              </div>
            ) : (
              <div className="flex flex-col h-full gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mc-start-date">Start Date</Label>
                    <Input
                      id="mc-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Issue date is set to today automatically.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="mc-days">Number of Days</Label>
                    <Input
                      id="mc-days"
                      type="number"
                      min="1"
                      value={numDaysText}
                      onChange={(e) => setNumDaysText(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Calculated end date: {calculateEndDate()}
                    </p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="mc-doctor">Doctor&apos;s Name</Label>
                  <Input
                    id="mc-doctor"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                  />
                </div>

                <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
                  <PDFViewer className="w-full h-full">
                    <McDocument
                      patient={patient}
                      issuedDate={formatDisplayDate(new Date())}
                      startDate={formatDisplayDate(startDate)}
                      endDate={calculateEndDate()}
                      numDays={getSafeNumDays()}
                      doctorName={doctorName}
                      organization={organization}
                    />
                  </PDFViewer>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={isLoading || !patient || !consultation || !isValidNumDays() || (orgLoading && !orgLoaded)}
            >
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
