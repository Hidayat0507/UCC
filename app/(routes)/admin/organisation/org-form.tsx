"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import type { ParentOrganizationSummary } from "@/lib/fhir/admin-service";
import { useAdminPath } from "@/hooks/use-admin-path";

interface Props {
  organisation: ParentOrganizationSummary | null;
  mode: "create" | "edit";
}

export default function OrgForm({ organisation, mode }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const adminPath = useAdminPath();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: organisation?.name ?? "",
    phone: organisation?.phone ?? "",
    address: organisation?.address ?? "",
    logoUrl: organisation?.logoUrl ?? "",
  });

  const handleChange =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Organisation name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const isNew = mode === "create";
      const res = await fetch("/api/admin/organisation", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? form
            : { id: organisation?.id, ...form }
        ),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save organisation");
      }
      toast({
        title: isNew ? "Organisation created" : "Saved",
        description: `${form.name} has been ${isNew ? "set up" : "updated"}.`,
      });
      router.replace(adminPath("/organisation"));
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isNew = mode === "create";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "New Organisation" : organisation?.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isNew
              ? "Create a parent company for clinic branches."
              : "Update this organisation's company details."}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organisation Details</CardTitle>
          <CardDescription>
            {isNew
              ? "This organisation can own one or more clinic branches."
              : "Update your organisation's contact information and branding."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                placeholder="Universal Care Clinic"
                value={form.name}
                onChange={handleChange("name")}
                required
              />
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
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : isNew ? "Create Organisation" : "Save Changes"}
              </Button>
              {!isNew && (
                <Button type="button" variant="outline" asChild>
                  <Link href={adminPath("/organisation")}>Cancel</Link>
                </Button>
              )}
              {isNew && (
                <Button type="button" variant="outline" asChild>
                  <Link href={adminPath("/organisation")}>Cancel</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
