'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import React, { useState } from 'react';
import { storage } from '@/lib/firebase';
import { useMedplumAuth } from '@/lib/auth-medplum';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { fetchOrganizationDetails, saveOrganizationDetails } from '@/lib/org';
import Image from 'next/image';
import { SmartTextManager } from '@/components/settings/smart-text-manager';
import { ModuleManager } from '@/components/settings/module-manager';

// Placeholder for user data - replace with actual data fetching/auth context later
interface UserSettings {
  fullName: string;
  email: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { profile, signOut } = useMedplumAuth();
  const profileEmail = (profile as any)?.telecom?.find((t: any) => t.system === 'email')?.value ?? (profile as any)?.name?.[0]?.text ?? profile?.id ?? 'Unknown';
  // Placeholder state - connect to user data later
  const [settings, setSettings] = useState<UserSettings>({
    fullName: 'Dr. John Doe', // Example data
    email: 'john.doe@example.com', // Example data
  });
  const [isEditing, setIsEditing] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgPhone, setOrgPhone] = useState("");

  React.useEffect(() => {
    // Load org settings (singleton doc)
    (async () => {
      try {
        const data = await fetchOrganizationDetails();
        if (data?.logoUrl) setLogoUrl(String(data.logoUrl));
        if (data?.name) setOrgName(String(data.name));
        if (data?.address) setOrgAddress(String(data.address));
        if (data?.phone) setOrgPhone(String(data.phone));
      } catch (e) {
        // ignore
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
    // TODO: Implement logic to save settings (e.g., call an API)
    console.log('Saving settings:', settings);
    setIsEditing(false);
    toast({
      title: "Settings Saved",
      description: "Your profile information has been updated.",
    });
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="text-sm text-muted-foreground">Signed in as: {profileEmail}</div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your personal information.</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Session controls</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={async () => { try { await fetch('/api/auth/medplum-session', { method: 'DELETE' }); } catch {}; await signOut(); if (typeof window !== 'undefined') window.location.assign('/login'); }}>Sign out</Button>
        </CardContent>
      </Card>

      <Separator />
      
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Upload your clinic/company logo for documents.</CardDescription>
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
            <div className="flex items-center gap-4">
              <Button asChild disabled={isUploading}>
                <label>
                  Upload Logo
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </label>
              </Button>
              <p className="text-sm text-muted-foreground">PNG or JPG recommended, up to ~1MB.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Clinic/company information displayed on documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-phone">Phone</Label>
              <Input id="org-phone" value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="org-address">Address</Label>
              <Input id="org-address" value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
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
              Save Organization
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Smart Text</CardTitle>
          <CardDescription>Manage custom text shortcuts for clinical notes.</CardDescription>
        </CardHeader>
        <CardContent>
          <SmartTextManager />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Feature Modules</CardTitle>
          <CardDescription>Enable or disable features based on your clinic&apos;s requirements.</CardDescription>
        </CardHeader>
        <CardContent>
          <ModuleManager />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize application behavior.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Preference settings coming soon...</p>
          {/* TODO: Add actual preference settings (e.g., theme, notifications) */}
        </CardContent>
      </Card>
       
      {/* Add more sections as needed (e.g., Security, Notifications) */}

    </div>
  );
} 