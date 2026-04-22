"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import type { ClinicSummary } from "@/lib/fhir/admin-service";

export default function ClinicEditForm({ clinic }: { clinic: ClinicSummary }) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: clinic.name,
    phone: clinic.phone ?? "",
    address: clinic.address ?? "",
    logoUrl: clinic.logoUrl ?? "",
  });

  const handleChange =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const res = await fetch(`/api/admin/clinics/${clinic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save clinic");
      }
      toast({
        title: "Saved",
        description: `${form.name} has been updated.`,
      });
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/clinics/${clinic.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete clinic");
      }
      toast({
        title: "Clinic deleted",
        description: `${clinic.name} has been removed.`,
      });
      router.replace("/admin/clinics");
    } catch (err: any) {
      toast({
        title: "Cannot delete",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const baseDomain =
    process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com";
  const clinicUrl = `https://${clinic.subdomain}.${baseDomain}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/clinics">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{clinic.name}</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {clinic.subdomain}
            </Badge>
            <a
              href={clinicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
            >
              {clinic.subdomain}.{baseDomain}
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinic Details</CardTitle>
          <CardDescription>
            Update contact information and branding. The subdomain cannot be
            changed after creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Clinic Name *</Label>
              <Input
                id="name"
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
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/clinics">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Deleting a clinic is permanent. It will be refused if any users or
            branches are still assigned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Deleting..." : "Delete Clinic"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {clinic.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the Medplum Organization resource. Existing
                  patient data tied to this clinic will be orphaned. Users
                  assigned to this clinic must be removed first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
