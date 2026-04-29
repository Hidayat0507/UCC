import { listActiveModules } from "@/lib/module-registry";
import {
  getOrganizationsFromMedplum,
  getParentOrganizationsFromMedplum,
} from "@/lib/fhir/admin-service";
import { adminPathForHost } from "@/lib/admin-routes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, GitBranch, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { headers } from "next/headers";
import { getHostFromHeaders } from "@/lib/server/subdomain-host";

export default async function AdminOverviewPage() {
  const host = getHostFromHeaders(await headers());
  const adminPath = (path: string) => adminPathForHost(path, host);
  const [modules, clinics, organisations] = await Promise.all([
    listActiveModules().catch(() => []),
    getOrganizationsFromMedplum().catch(() => []),
    getParentOrganizationsFromMedplum().catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Portal</h1>
        <p className="text-muted-foreground mt-1">
          Manage your organisation, branches, and platform settings.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Organisations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {organisations.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {organisations.length > 0 ? (
                <Link
                  href={adminPath("/organisation")}
                  className="underline underline-offset-2"
                >
                  Manage organisations
                </Link>
              ) : (
                <Link
                  href={adminPath("/organisation")}
                  className="underline underline-offset-2 text-amber-600 dark:text-amber-400"
                >
                  None configured — create one
                </Link>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clinics.length}</div>
            <p className="text-xs text-muted-foreground">Clinic branches</p>
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
      </div>

      {/* Branches quick list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Branches</CardTitle>
            <CardDescription>
              All clinic branches across organisations
            </CardDescription>
          </div>
          <Button asChild size="sm">
            <Link href={adminPath("/clinics/new")}>Add Branch</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {clinics.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No branches yet.{" "}
              <Link href={adminPath("/clinics/new")} className="underline">
                Create the first one.
              </Link>
            </p>
          ) : (
            <div className="divide-y">
              {clinics.map((clinic) => (
                <div
                  key={clinic.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium">{clinic.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {clinic.subdomain}.
                      {process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={adminPath(`/clinics/${clinic.id}`)}>
                      Manage
                    </Link>
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
