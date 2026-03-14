"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ClinicOption = {
  id: string;
  name: string;
  subdomain: string;
  parentOrganizationId?: string;
};

export default function NewClinicPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [existingClinics, setExistingClinics] = useState<ClinicOption[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [form, setForm] = useState({
    name: "",
    subdomain: "",
    phone: "",
    address: "",
    logoUrl: "",
    parentOrganizationId: "none",
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (field === "subdomain") {
      // Auto-sanitise subdomain: lowercase, alphanumeric + hyphens only
      value = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const parentOrganizations = existingClinics.filter((clinic) => !clinic.parentOrganizationId);

  useEffect(() => {
    const loadClinics = async () => {
      try {
        const res = await fetch("/api/admin/clinics");
        if (!res.ok) {
          throw new Error("Failed to load organizations");
        }
        const data = await res.json();
        setExistingClinics((data.clinics ?? []) as ClinicOption[]);
      } catch (error: any) {
        toast({
          title: "Unable to load organizations",
          description: error.message || "Please refresh and try again.",
          variant: "destructive",
        });
      } finally {
        setLoadingClinics(false);
      }
    };

    loadClinics();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.subdomain) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          parentOrganizationId:
            form.parentOrganizationId && form.parentOrganizationId !== "none"
              ? form.parentOrganizationId
              : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create clinic");
      }
      toast({ title: "Clinic created!", description: `${form.name} is now live.` });
      router.replace("/admin/clinics");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/clinics">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Clinic</h1>
          <p className="text-muted-foreground text-sm">Register a new clinic on the platform.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinic Details</CardTitle>
          <CardDescription>This creates an Organisation in Medplum and assigns a subdomain.</CardDescription>
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
                disabled={loadingClinics}
              >
                <SelectTrigger id="parentOrganizationId">
                  <SelectValue
                    placeholder={loadingClinics ? "Loading organizations..." : "No parent"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent (top-level organization)</SelectItem>
                  {parentOrganizations.map((clinic) => (
                    <SelectItem key={clinic.id} value={clinic.id}>
                      {clinic.name} ({clinic.subdomain})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose a parent to create this clinic as a branch.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Clinic Name *</Label>
              <Input
                id="name"
                placeholder="Klinik Anda"
                value={form.name}
                onChange={handleChange("name")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="subdomain"
                  placeholder="klinikanda"
                  value={form.subdomain}
                  onChange={handleChange("subdomain")}
                  required
                  className="flex-1"
                />
                <span className="text-muted-foreground text-sm whitespace-nowrap">
                  .{baseDomain}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers and hyphens only.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+60 3-1234 5678"
                value={form.phone}
                onChange={handleChange("phone")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="123 Jalan Bunga, Kuala Lumpur"
                value={form.address}
                onChange={handleChange("address")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                placeholder="https://example.com/logo.png"
                value={form.logoUrl}
                onChange={handleChange("logoUrl")}
              />
            </div>
            <div className="pt-2 flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Clinic"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/clinics">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
