"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useAdminPath } from "@/hooks/use-admin-path";

type ClinicOption = {
  id: string;
  name: string;
  subdomain: string;
  parentOrganizationName?: string;
};

export default function InviteUserPage() {
  const router = useRouter();
  const { toast } = useToast();
  const adminPath = useAdminPath();
  const [loading, setLoading] = useState(false);
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    clinicId: "",
    password: "",
    sendEmail: false,
  });

  const handleChange =
    (field: "firstName" | "lastName" | "email" | "password") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  useEffect(() => {
    const loadClinics = async () => {
      try {
        const res = await fetch("/api/admin/clinics");
        if (!res.ok) {
          throw new Error("Failed to load clinics");
        }
        const data = await res.json();
        const clinicList = (data.clinics ?? []) as ClinicOption[];
        setClinics(clinicList);
        if (clinicList.length > 0) {
          setForm((prev) => ({ ...prev, clinicId: clinicList[0].id }));
        }
      } catch (err: any) {
        toast({
          title: "Unable to load clinics",
          description: err.message || "Please refresh and try again",
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
    if (!form.firstName || !form.lastName || !form.email || !form.clinicId) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }
    if (!form.sendEmail && !form.password) {
      toast({
        title: "Password required",
        description: "Set a password when creating a user without email invite.",
        variant: "destructive",
      });
      return;
    }

    if (!form.sendEmail && form.password.trim().length < 8) {
      toast({
        title: "Password too short",
        description: "Temporary password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          clinicId: form.clinicId,
          password: form.password || undefined,
          sendEmail: form.sendEmail,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to invite user");
      }

      toast({
        title: form.sendEmail ? "Invitation sent" : "User created",
        description: form.sendEmail
          ? `${form.firstName} ${form.lastName} has been invited.`
          : `${form.firstName} ${form.lastName} can now sign in.`,
      });
      router.replace(adminPath("/users"));
    } catch (err: any) {
      toast({
        title: "Invite failed",
        description: err.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={adminPath("/users")}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invite User</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a clinic user directly or send a Medplum invitation email.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Practitioner Details</CardTitle>
          <CardDescription>
            Assign the user to a clinic and optionally email an invitation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clinicId">Clinic *</Label>
              <Select
                value={form.clinicId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, clinicId: value }))}
                disabled={loadingClinics || clinics.length === 0}
              >
                <SelectTrigger id="clinicId">
                  <SelectValue placeholder={loadingClinics ? "Loading clinics..." : "Select clinic"} />
                </SelectTrigger>
                <SelectContent>
                  {clinics.map((clinic) => (
                    <SelectItem key={clinic.id} value={clinic.id}>
                      {clinic.name}
                      {clinic.parentOrganizationName
                        ? ` - Branch of ${clinic.parentOrganizationName}`
                        : ""}
                      {` (${clinic.subdomain})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={handleChange("firstName")}
                required
                placeholder="Aina"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={handleChange("lastName")}
                required
                placeholder="Rahman"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={handleChange("email")}
                required
                placeholder="doctor@clinic.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password</Label>
              <PasswordInput
                id="password"
                value={form.password}
                onChange={handleChange("password")}
                placeholder="Set a password for direct sign-in"
              />
              <p className="text-xs text-muted-foreground">
                Required when email invite is disabled. Minimum 8 characters.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="sendEmailInvite">Send Email Invite</Label>
                <p className="text-xs text-muted-foreground">
                  Turn this on only if the email address can receive Medplum invites.
                </p>
              </div>
              <Switch
                id="sendEmailInvite"
                checked={form.sendEmail}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, sendEmail: Boolean(checked) }))
                }
              />
            </div>

            <div className="pt-2 flex gap-3">
              <Button type="submit" disabled={loading || loadingClinics || clinics.length === 0}>
                {loading ? "Saving..." : form.sendEmail ? "Send Invite" : "Create User"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={adminPath("/users")}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
