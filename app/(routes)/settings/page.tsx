'use client';

import React, { useState } from 'react';
import { ClipboardList, CreditCard, FileText, IdCard, MessageCircle, Stethoscope, UserRound } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { storage } from '@/lib/firebase';
import { useMedplumAuth } from '@/lib/auth-medplum';
import { fetchOrganizationDetails, saveOrganizationDetails } from '@/lib/org';
import { InsurerManager } from '@/components/settings/insurer-manager';
import { ClinicalCatalogManager } from '@/components/catalogs/clinical-catalog-manager';
import { FollowUpSettings } from '@/components/settings/follow-up-settings';

interface UserSettings {
  fullName: string;
  email: string;
}

function WorkflowIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { profile } = useMedplumAuth();
  const profileEmail =
    (profile as any)?.telecom?.find((t: any) => t.system === 'email')?.value ??
    (profile as any)?.name?.[0]?.text ??
    profile?.id ??
    'Unknown';
  const [settings, setSettings] = useState<UserSettings>({
    fullName: 'Dr. John Doe',
    email: 'john.doe@example.com',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgPhone, setOrgPhone] = useState("");

  React.useEffect(() => {
    (async () => {
      try {
        const data = await fetchOrganizationDetails();
        if (data?.logoUrl) setLogoUrl(String(data.logoUrl));
        if (data?.name) setOrgName(String(data.name));
        if (data?.address) setOrgAddress(String(data.address));
        if (data?.phone) setOrgPhone(String(data.phone));
      } catch {
        // Organization settings are optional during initial clinic setup.
      }
    })();
  }, []);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const objectRef = ref(storage, `branding/logo-${Date.now()}-${file.name}`);
      await uploadBytes(objectRef, file, { contentType: file.type });
      const url = await getDownloadURL(objectRef);
      setLogoUrl(url);
      await saveOrganizationDetails({
        name: orgName,
        address: orgAddress,
        phone: orgPhone,
        logoUrl: url,
      });
      toast({ title: 'Logo updated', description: 'Company logo will appear on MCs, bills, and referral letters.' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message || 'Could not upload logo', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    toast({
      title: "Settings Saved",
      description: "Your profile information has been updated.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure the clinic workflows staff use every day.</p>
        </div>
        <div className="text-sm text-muted-foreground">Signed in as: {profileEmail}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <WorkflowIcon><IdCard className="h-4 w-4" /></WorkflowIcon>
            <div>
              <CardTitle>Registration</CardTitle>
              <CardDescription>Clinic identity shown on patient documents and registration output.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="org-name">Clinic name</Label>
                <Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-phone">Phone</Label>
                <Input id="org-phone" value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-address">Address</Label>
                <Input id="org-address" value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} />
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={async () => {
                try {
                  await saveOrganizationDetails({
                    name: orgName,
                    address: orgAddress,
                    phone: orgPhone,
                    logoUrl: logoUrl || null,
                  });
                  toast({ title: 'Organization saved', description: 'Details will appear on documents.' });
                } catch (e: any) {
                  toast({ title: 'Save failed', description: e.message || 'Could not save', variant: 'destructive' });
                }
              }}
            >
              Save Registration Details
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <WorkflowIcon><ClipboardList className="h-4 w-4" /></WorkflowIcon>
            <div>
              <CardTitle>Check In</CardTitle>
              <CardDescription>Panel insurers available during patient arrival and triage.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <InsurerManager />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <WorkflowIcon><CreditCard className="h-4 w-4" /></WorkflowIcon>
            <div>
              <CardTitle>Invoice</CardTitle>
              <CardDescription>Branding used on bills, MCs, referral letters, and receipts.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {logoUrl ? (
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded border bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                </div>
                <Button asChild variant="outline" disabled={isUploading}>
                  <label>
                    Change Logo
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button asChild disabled={isUploading}>
                  <label>
                    Upload Logo
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                </Button>
                <p className="text-sm text-muted-foreground">PNG or JPG recommended, up to 1MB.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <WorkflowIcon><Stethoscope className="h-4 w-4" /></WorkflowIcon>
            <div>
              <CardTitle>Service Catalogs</CardTitle>
              <CardDescription>Orderable catalogs used by the treatment composer, labs, imaging, and generated letters.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ClinicalCatalogManager />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <WorkflowIcon><MessageCircle className="h-4 w-4" /></WorkflowIcon>
            <div>
              <CardTitle>Follow Up</CardTitle>
              <CardDescription>WhatsApp delivery mode and templates for review requests and appointment reminders.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <FollowUpSettings />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <WorkflowIcon><FileText className="h-4 w-4" /></WorkflowIcon>
            <div>
              <CardTitle>Consultation</CardTitle>
              <CardDescription>Text shortcuts used while writing clinical notes.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed p-6">
              <p className="text-sm font-medium">Smart Text is disabled for now.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Built-in note shortcuts can be re-enabled after the storage path is finalized.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <WorkflowIcon><UserRound className="h-4 w-4" /></WorkflowIcon>
            <div>
              <CardTitle>Account</CardTitle>
              <CardDescription>User profile details for this workstation session.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveChanges} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  value={settings.fullName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={settings.email}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                {isEditing ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                  </>
                ) : (
                  <Button type="button" onClick={() => setIsEditing(true)}>Edit Profile</Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
