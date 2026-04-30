"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileText,
  ReceiptText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Patient, Consultation } from "@/lib/models";
import { formatDisplayDate } from "@/lib/utils";

type CheckoutClientProps = {
  consultationId: string;
  patientId: string;
};

type OrderDetails = {
  patient: Patient;
  consultation: Consultation;
};

type CheckoutItem = {
  id: string;
  name: string;
  description: string;
  type: "Item" | "Service";
  quantity: number;
  price: number;
};

type PaymentMethod = "cash" | "card" | "qr" | "panel";

const DEFAULT_CONSULTATION_FEE = 50;

function currency(amount: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(amount);
}

function buildCheckoutItems(consultation: Consultation | null): CheckoutItem[] {
  if (!consultation) return [];

  const procedures = (consultation.procedures || []).map((procedure, index) => ({
    id: `procedure-${index}`,
    name: procedure.name || "Procedure",
    description: procedure.notes || "Clinical service",
    type: "Service" as const,
    quantity: 1,
    price: procedure.price ?? 0,
  }));

  const prescriptions = (consultation.prescriptions || []).map((prescription, index) => ({
    id: `prescription-${index}`,
    name: prescription.medication?.name || "Medication",
    description: [prescription.medication?.strength, prescription.frequency, prescription.duration]
      .filter(Boolean)
      .join(" · "),
    type: "Item" as const,
    quantity: 1,
    price: prescription.price ?? 0,
  }));

  const items = [...procedures, ...prescriptions];

  if (items.length > 0) {
    return items;
  }

  return [
    {
      id: "consultation-fee",
      name: "Consultation Fee",
      description: consultation.chiefComplaint || "Default consultation charge",
      type: "Service",
      quantity: 1,
      price: DEFAULT_CONSULTATION_FEE,
    },
  ];
}

export default function CheckoutClient({ consultationId, patientId }: CheckoutClientProps) {
  const router = useRouter();
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDetails() {
      if (!consultationId || !patientId) {
        setError("Missing checkout patient or consultation reference.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/orders?consultationId=${encodeURIComponent(consultationId)}&patientId=${encodeURIComponent(patientId)}`
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.patient || !payload.consultation) {
          throw new Error(payload.error || "Failed to load checkout details.");
        }

        if (active) {
          setDetails({ patient: payload.patient, consultation: payload.consultation });
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load checkout details.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      active = false;
    };
  }, [consultationId, patientId]);

  const checkoutItems = useMemo(
    () => buildCheckoutItems(details?.consultation ?? null),
    [details?.consultation]
  );
  const subtotal = checkoutItems.reduce((total, item) => total + item.quantity * item.price, 0);
  const paid = Number.parseFloat(paidAmount) || 0;
  const balance = Math.max(subtotal - paid, 0);
  const handleCompleteVisitation = async () => {
    if (!details || completing || balance > 0) return;

    setCompleting(true);
    setCompletionError(null);

    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId,
          patientId,
          items: checkoutItems,
          paymentMethod,
          paidAmount: paid,
          totalAmount: subtotal,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to complete checkout.");
      }

      router.push(`/orders?checkout=completed&invoiceId=${encodeURIComponent(payload.invoiceId || "")}`);
    } catch (err) {
      setCompletionError(err instanceof Error ? err.message : "Failed to complete checkout.");
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <main className="container mx-auto flex min-h-[70vh] items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading checkout...</div>
      </main>
    );
  }

  if (error || !details) {
    return (
      <main className="container mx-auto max-w-3xl py-8">
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Billing
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Checkout unavailable</CardTitle>
            <CardDescription>{error || "The selected consultation could not be loaded."}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const { patient, consultation } = details;
  const billToName =
    patient.billingPerson === "dependent" && patient.dependentName
      ? patient.dependentName
      : patient.fullName;

  return (
    <main className="w-full space-y-6 px-3 py-8 sm:px-4 lg:px-5 2xl:px-6">
      <div className="flex flex-col gap-4">
        <div className="space-y-3">
          <Button asChild variant="ghost" className="-ml-3 w-fit">
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Billing
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Draft invoice</h1>
              <Badge variant="secondary">Checkout</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {patient.fullName} · {formatDisplayDate(consultation.date)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_340px] 2xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Patient</p>
                <Link href={`/patients/${patient.id}`} className="mt-1 block font-medium text-primary hover:underline">
                  {patient.fullName}
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">NRIC / Passport</p>
                  <p className="mt-1 font-medium">{patient.nric || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Phone</p>
                  <p className="mt-1 font-medium">{patient.phone || "N/A"}</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground">Bill to</p>
                <p className="mt-1 font-medium">{billToName}</p>
                {patient.billingPerson === "dependent" ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {patient.dependentRelationship || "Dependent"} · {patient.dependentPhone || "No phone recorded"}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Self</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Address</p>
                <p className="mt-1 text-sm">{patient.address || "No address recorded"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="all">
                <TabsList className="mb-4 flex w-full overflow-x-auto md:w-fit">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="items">Items</TabsTrigger>
                  <TabsTrigger value="services">Services</TabsTrigger>
                  <TabsTrigger value="packages">Packages</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                  <TreatmentRows items={checkoutItems} />
                </TabsContent>
                <TabsContent value="items">
                  <TreatmentRows items={checkoutItems.filter((item) => item.type === "Item")} emptyText="No items added." />
                </TabsContent>
                <TabsContent value="services">
                  <TreatmentRows items={checkoutItems.filter((item) => item.type === "Service")} emptyText="No services added." />
                </TabsContent>
                <TabsContent value="packages">
                  <EmptyPanel text="No packages added." />
                </TabsContent>
                <TabsContent value="documents">
                  <EmptyPanel text="No chargeable documents added." />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5" />
                Totals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{currency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium">{currency(0)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{currency(subtotal)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payments
              </CardTitle>
              <CardDescription>Record the amount collected before completing visitation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment method</Label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                  <SelectTrigger id="payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="qr">QR / DuitNow</SelectItem>
                    <SelectItem value="panel">Panel claim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid-amount">Paid amount</Label>
                <Input
                  id="paid-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={paidAmount}
                  onChange={(event) => setPaidAmount(event.target.value)}
                />
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-semibold">{currency(balance)}</span>
                </div>
              </div>
              {completionError ? (
                <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{completionError}</span>
                </div>
              ) : null}
              <Button
                variant="outline"
                className="w-full"
                type="button"
                onClick={() => setCompletionError("e-Invoice submission is not connected yet. Complete visitation records this checkout invoice.")}
              >
                <FileText className="mr-2 h-4 w-4" />
                Submit e-Invoice
              </Button>
              <Button
                className="w-full"
                disabled={balance > 0 || completing || checkoutItems.length === 0}
                onClick={handleCompleteVisitation}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {completing ? "Completing..." : "Complete visitation"}
              </Button>
              {balance > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Collect the full total to enable completion.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function TreatmentRows({
  items,
  emptyText = "No treatment added.",
}: {
  items: CheckoutItem[];
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <EmptyPanel text={emptyText} />;
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-[1fr_80px_120px] bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>Treatment</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Amount</span>
      </div>
      {items.map((item) => (
        <div key={item.id} className="grid grid-cols-[1fr_80px_120px] items-center border-t px-4 py-3 text-sm">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{item.name}</p>
              <Badge variant="outline">{item.type}</Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{item.description || "No description"}</p>
          </div>
          <span className="text-right">{item.quantity}</span>
          <span className="text-right font-medium">{currency(item.quantity * item.price)}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
