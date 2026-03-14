import Link from "next/link";
import { AlertCircle, Database, KeyRound, LayoutGrid, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrganizationsFromMedplum, getPractitionersFromMedplum } from "@/lib/fhir/admin-service";

export default async function AdminSettingsPage() {
  const [clinics, practitioners] = await Promise.all([
    getOrganizationsFromMedplum().catch(() => []),
    getPractitionersFromMedplum().catch(() => []),
  ]);

  const topLevelOrganizations = clinics.filter((clinic) => !clinic.parentOrganizationId).length;
  const branches = clinics.filter((clinic) => clinic.parentOrganizationId).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Environment and support information for the admin workspace.
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Operational Admin Only</AlertTitle>
        <AlertDescription>
          This page is intentionally focused on working operational controls. Secrets are not shown
          here, and only live admin actions that exist in this app are surfaced.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Admin URL</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">/admin</p>
            <p className="text-xs text-muted-foreground">Canonical admin entry point</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{clinics.length}</p>
            <p className="text-xs text-muted-foreground">
              {topLevelOrganizations} top-level, {branches} branches
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Practitioners</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{practitioners.length}</p>
            <p className="text-xs text-muted-foreground">Visible Medplum practitioner records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">FHIR Backend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">Medplum</p>
            <p className="text-xs text-muted-foreground break-all">
              {process.env.MEDPLUM_BASE_URL || "Not configured"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Platform Configuration
            </CardTitle>
            <CardDescription>Read-only environment metadata for support use.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Base Domain</span>
              <Badge variant="outline">{process.env.NEXT_PUBLIC_BASE_DOMAIN || "Not set"}</Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Authentication</span>
              <Badge variant={process.env.NEXT_PUBLIC_DISABLE_AUTH === "true" ? "destructive" : "secondary"}>
                {process.env.NEXT_PUBLIC_DISABLE_AUTH === "true" ? "Disabled" : "Enabled"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Clinic Routing</span>
              <Badge variant="secondary">Subdomain-based</Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Admin Routing</span>
              <Badge variant="secondary">Path-based</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Admin Tools
            </CardTitle>
            <CardDescription>Only tools that have a working route in this deployment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/admin/clinics">Manage clinics and branches</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/admin/users">Manage clinic users</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/admin/create-medplum-client">Create Medplum client credentials</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Medplum Project
          </CardTitle>
          <CardDescription>Useful identifiers for support and self-hosted maintenance.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">Project ID</p>
            <p className="font-mono text-xs break-all">
              {process.env.NEXT_PUBLIC_MEDPLUM_PROJECT_ID || "Not configured"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Public Client ID</p>
            <p className="font-mono text-xs break-all">
              {process.env.NEXT_PUBLIC_MEDPLUM_CLIENT_ID || "Not configured"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
