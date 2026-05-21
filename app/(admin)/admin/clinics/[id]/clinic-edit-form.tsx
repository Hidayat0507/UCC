"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Puzzle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import type {
  ClinicSummary,
  ParentOrganizationSummary,
} from "@/lib/fhir/admin-service";
import { useAdminPath } from "@/hooks/use-admin-path";

export default function ClinicEditForm({
  clinic,
  organisations,
  modules,
}: {
  clinic: ClinicSummary;
  organisations: ParentOrganizationSummary[];
  modules: { id: string; label: string; description?: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const adminPath = useAdminPath();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: clinic.name,
    parentId: clinic.parentId ?? organisations[0]?.id ?? "",
    phone: clinic.phone ?? "",
    address: clinic.address ?? "",
    logoUrl: clinic.logoUrl ?? "",
    enabledModuleIds: clinic.enabledModuleIds,
  });

  const handleChange =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const saveClinic = async () => {
    if (!form.name.trim() || !form.parentId) {
      toast({ title: "Clinic name and organisation are required", variant: "destructive" });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveClinic();
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
      router.replace(adminPath("/organisation"));
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
  const enabledModuleSet = new Set(form.enabledModuleIds);

  const toggleModule = (moduleId: string, enabled: boolean) => {
    setForm((prev) => {
      const next = new Set(prev.enabledModuleIds);
      if (enabled) {
        next.add(moduleId);
      } else {
        next.delete(moduleId);
      }
      return { ...prev, enabledModuleIds: Array.from(next) };
    });
  };
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={adminPath("/organisation")}>
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
          <CardTitle>Branch Details</CardTitle>
          <CardDescription>
            Update contact information and branding. The subdomain cannot be
            changed after creation.
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
                disabled={organisations.length === 0}
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
              <Button type="submit" disabled={saving || organisations.length === 0}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={adminPath("/organisation")}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branch Modules</CardTitle>
          <CardDescription>
            Choose which modules are available for this branch. Disabled
            modules are hidden from the branch sidebar and blocked on direct
            access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {modules.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No active modules are installed for this deployment.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {modules.map((module) => {
                const enabled = enabledModuleSet.has(module.id);
                return (
                <div
                  key={module.id}
                  className="flex items-start gap-3 rounded-md border bg-background p-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Puzzle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{module.label}</p>
                      <Badge variant="outline" className="text-xs">
                        {enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    {module.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {module.description}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(value) => toggleModule(module.id, value)}
                    aria-label={`Toggle ${module.label}`}
                  />
                </div>
                );
              })}
            </div>
          )}
          {modules.length > 0 && (
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={saveClinic} disabled={saving || organisations.length === 0}>
                {saving ? "Saving..." : "Save Module Settings"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Deleting a branch is permanent. All user assignments to this branch
            will be removed automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Deleting..." : "Delete Branch"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {clinic.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the branch and automatically
                  unassigns any users currently assigned to it.
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
