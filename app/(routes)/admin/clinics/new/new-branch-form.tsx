"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";
import { useAdminPath } from "@/hooks/use-admin-path";
import type { ParentOrganizationSummary } from "@/lib/fhir/admin-service";

interface Props {
  organisations: ParentOrganizationSummary[];
}

export default function NewBranchForm({ organisations }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const adminPath = useAdminPath();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    subdomain: "",
    parentId: organisations[0]?.id ?? "",
    phone: "",
    address: "",
    logoUrl: "",
  });

  const handleChange =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      if (field === "subdomain") {
        value = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      }
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.subdomain || !form.parentId) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create branch");
      }
      toast({
        title: "Branch created!",
        description: `${form.name} is now live.`,
      });
      router.replace(adminPath("/clinics"));
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
          <Link href={adminPath("/clinics")}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Branch</h1>
          <p className="text-muted-foreground text-sm">
            Register a new clinic branch under an organisation.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branch Details</CardTitle>
          <CardDescription>
            This creates an Organisation in Medplum linked to your parent
            company and assigns a subdomain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parentId">Organisation *</Label>
              <Select
                value={form.parentId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, parentId: value }))
                }
              >
                <SelectTrigger id="parentId">
                  <SelectValue placeholder="Select organisation" />
                </SelectTrigger>
                <SelectContent>
                  {organisations.map((organisation) => (
                    <SelectItem key={organisation.id} value={organisation.id}>
                      <span className="inline-flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {organisation.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Branch Name *</Label>
              <Input
                id="name"
                placeholder="UCC Kuala Lumpur"
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
                  placeholder="kl"
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
                {loading ? "Creating..." : "Create Branch"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={adminPath("/clinics")}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
