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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ExternalLink, Plus, AlertCircle } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { getHostFromHeaders } from "@/lib/server/subdomain-host";

export default async function BranchesPage() {
  const host = getHostFromHeaders(await headers());
  const adminPath = (path: string) => adminPathForHost(path, host);
  const [clinics, organisations] = await Promise.all([
    getOrganizationsFromMedplum().catch(() => []),
    getParentOrganizationsFromMedplum().catch(() => []),
  ]);
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branches</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage clinic branches across organisations.
          </p>
        </div>
        <Button asChild>
          <Link href={adminPath("/clinics/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Branch
          </Link>
        </Button>
      </div>

      {organisations.length === 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              No organisations configured yet.{" "}
              <Link
                href={adminPath("/organisation")}
                className="font-medium underline underline-offset-2"
              >
                Create one first
              </Link>{" "}
              before adding branches.
            </p>
          </CardContent>
        </Card>
      )}

      {clinics.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No branches yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              Get started by creating your first clinic branch.
            </p>
            <Button asChild>
              <Link href={adminPath("/clinics/new")}>Create First Branch</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clinics.map((clinic) => (
            <Card key={clinic.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {clinic.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={clinic.logoUrl}
                        alt={clinic.name}
                        className="h-10 w-10 rounded-md object-contain border bg-white"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">{clinic.name}</CardTitle>
                      <Badge variant="outline" className="text-xs mt-0.5">
                        {clinic.subdomain}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
                {clinic.parentName && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Part of:</span>{" "}
                    <span className="font-medium text-foreground">
                      {clinic.parentName}
                    </span>
                  </p>
                )}
                {clinic.phone && <p>📞 {clinic.phone}</p>}
                {clinic.address && <p>📍 {clinic.address}</p>}
                <p className="font-mono text-xs truncate">
                  {clinic.subdomain}.{baseDomain}
                </p>
              </CardContent>
              <div className="px-6 pb-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href={adminPath(`/clinics/${clinic.id}`)}>Edit</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={`https://${clinic.subdomain}.${baseDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
