"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import DeleteClinicButton from "@/components/admin/delete-clinic-button";

type ClinicRecord = {
  id: string;
  name: string;
  subdomain: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  parentOrganizationId?: string;
  parentOrganizationName?: string;
};

interface ClinicEditFormProps {
  clinicId: string;
}

export default function ClinicEditForm({ clinicId }: ClinicEditFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clinic, setClinic] = useState<ClinicRecord | null>(null);
  const [allClinics, setAllClinics] = useState<ClinicRecord[]>([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    logoUrl: "",
    parentOrganizationId: "none",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [clinicRes, clinicsRes] = await Promise.all([
          fetch(`/api/admin/clinics/${clinicId}`),
          fetch("/api/admin/clinics"),
        ]);

        if (!clinicRes.ok) {
          throw new Error("Failed to load clinic");
        }
        if (!clinicsRes.ok) {
          throw new Error("Failed to load clinic list");
        }

        const clinicData = await clinicRes.json();
        const clinicsData = await clinicsRes.json();
        const nextClinic = clinicData.clinic as ClinicRecord;
        const nextClinics = (clinicsData.clinics ?? []) as ClinicRecord[];

        setClinic(nextClinic);
        setAllClinics(nextClinics);
        setForm({
          name: nextClinic.name ?? "",
          phone: nextClinic.phone ?? "",
          address: nextClinic.address ?? "",
          logoUrl: nextClinic.logoUrl ?? "",
          parentOrganizationId: nextClinic.parentOrganizationId ?? "none",
        });
      } catch (error: any) {
        toast({
          title: "Unable to load clinic",
          description: error.message || "Please refresh and try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [clinicId, toast]);

  const parentOrganizations = useMemo(
    () =>
      allClinics.filter(
        (candidate) => !candidate.parentOrganizationId && candidate.id !== clinicId
      ),
    [allClinics, clinicId]
  );

  const handleChange = (field: "name" | "phone" | "address" | "logoUrl") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Clinic name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || undefined,
          address: form.address || undefined,
          logoUrl: form.logoUrl || undefined,
          parentOrganizationId:
            form.parentOrganizationId !== "none" ? form.parentOrganizationId : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to update clinic");
      }

      toast({
        title: "Clinic updated",
        description: `${form.name} has been saved.`,
      });
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com";

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading clinic details...
      </div>
    );
  }

  if (!clinic) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clinic not found</CardTitle>
          <CardDescription>The requested clinic could not be loaded.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/admin/clinics">Back to Clinics</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/clinics">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{clinic.name}</h1>
            <p className="text-sm text-muted-foreground">
              {clinic.subdomain}.{baseDomain}
            </p>
          </div>
        </div>
        <DeleteClinicButton clinicId={clinic.id} clinicName={clinic.name} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Clinic Details</CardTitle>
            <CardDescription>
              Update the organization profile that backs this clinic in Medplum.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="parentOrganizationId">Parent Organization</Label>
                <Select
                  value={form.parentOrganizationId}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, parentOrganizationId: value }))
                  }
                >
                  <SelectTrigger id="parentOrganizationId">
                    <SelectValue placeholder="No parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent (top-level organization)</SelectItem>
                    {parentOrganizations.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.name} ({parent.subdomain})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Clinic Name</Label>
                <Input id="name" value={form.name} onChange={handleChange("name")} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={handleChange("phone")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={form.address} onChange={handleChange("address")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input id="logoUrl" value={form.logoUrl} onChange={handleChange("logoUrl")} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/admin/clinics">Back</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clinic Meta</CardTitle>
            <CardDescription>Useful identifiers for support and migration work.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium">Organization ID</p>
              <p className="font-mono text-xs text-muted-foreground break-all">{clinic.id}</p>
            </div>
            <div>
              <p className="font-medium">Subdomain</p>
              <p className="text-muted-foreground">{clinic.subdomain}</p>
            </div>
            <div>
              <p className="font-medium">Hierarchy</p>
              <p className="text-muted-foreground">
                {clinic.parentOrganizationName
                  ? `Branch of ${clinic.parentOrganizationName}`
                  : "Top-level organization"}
              </p>
            </div>
            <div>
              <p className="font-medium">Open Clinic URL</p>
              <a
                className="text-primary underline-offset-4 hover:underline"
                href={`https://${clinic.subdomain}.${baseDomain}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                https://{clinic.subdomain}.{baseDomain}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
