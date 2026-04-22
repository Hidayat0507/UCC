import { listActiveModules } from "@/lib/module-registry";
import { getOrganizationsFromMedplum } from "@/lib/fhir/admin-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminOverviewPage() {
  const [modules, clinics] = await Promise.all([
    listActiveModules().catch(() => []),
    getOrganizationsFromMedplum().catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Portal</h1>
        <p className="text-muted-foreground mt-1">
          Manage clinics, users, and platform settings.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clinics</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clinics.length}</div>
            <p className="text-xs text-muted-foreground">Active organisations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Modules</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{modules.length}</div>
            <p className="text-xs text-muted-foreground">Installed modules</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Platform</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Medplum</div>
            <p className="text-xs text-muted-foreground">FHIR backend</p>
          </CardContent>
        </Card>
      </div>

      {/* Clinics quick list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Clinics</CardTitle>
            <CardDescription>All registered clinics on this platform</CardDescription>
          </div>
          <Button asChild size="sm">
            <Link href="/admin/clinics/new">Add Clinic</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {clinics.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No clinics found.{" "}
              <Link href="/admin/clinics/new" className="underline">
                Create the first one.
              </Link>
            </p>
          ) : (
            <div className="divide-y">
              {clinics.map((clinic) => (
                <div key={clinic.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{clinic.name}</p>
                    <p className="text-xs text-muted-foreground">{clinic.subdomain}.{process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com"}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/clinics`}>Manage</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
