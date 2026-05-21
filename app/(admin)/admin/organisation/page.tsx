import {
  getOrganizationsFromMedplum,
  getParentOrganizationsFromMedplum,
} from "@/lib/fhir/admin-service";
import { adminPathForHost } from "@/lib/admin-routes";
import { getHostFromHeaders } from "@/lib/server/subdomain-host";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, GitBranch, Plus } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OrganisationPage() {
  const host = getHostFromHeaders(await headers());
  const adminPath = (path: string) => adminPathForHost(path, host);
  const [organisations, clinics] = await Promise.all([
    getParentOrganizationsFromMedplum(),
    getOrganizationsFromMedplum(),
  ]);
  const branchesByParentId = new Map<string, typeof clinics>();
  const fallbackParentId =
    organisations.length === 1 ? organisations[0]?.id : undefined;
  for (const clinic of clinics) {
    const key = clinic.parentId ?? fallbackParentId ?? "";
    const list = branchesByParentId.get(key) ?? [];
    list.push(clinic);
    branchesByParentId.set(key, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organisations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Open an organisation to review the branches underneath it.
          </p>
        </div>
        <Button asChild>
          <Link href={adminPath("/organisation/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Organisation
          </Link>
        </Button>
      </div>

      {organisations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No organisations yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              Create an organisation before adding clinic branches.
            </p>
            <Button asChild>
              <Link href={adminPath("/organisation/new")}>
                Create Organisation
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organisations.map((organisation) => {
            const branches = branchesByParentId.get(organisation.id) ?? [];
            return (
            <Card key={organisation.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {organisation.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={organisation.logoUrl}
                        alt={organisation.name}
                        className="h-10 w-10 rounded-md object-contain border bg-white"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">
                        {organisation.name}
                      </CardTitle>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {branches.length} branch{branches.length === 1 ? "" : "es"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 text-sm text-muted-foreground">
                {organisation.phone && <p>{organisation.phone}</p>}
                {organisation.address && <p>{organisation.address}</p>}
                <div className="space-y-2">
                  {branches.length === 0 ? (
                    <p className="rounded-md border border-dashed p-3">
                      No branches under this organisation.
                    </p>
                  ) : (
                    branches.map((clinic) => (
                      <Link
                        key={clinic.id}
                        href={adminPath(`/clinics/${clinic.id}`)}
                        className="flex items-center justify-between gap-3 rounded-md border p-3 text-foreground hover:bg-muted/50"
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{clinic.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {clinic.enabledModuleIds.length} modules
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </CardContent>
              <div className="grid gap-2 px-6 pb-4 sm:grid-cols-2">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={adminPath(`/organisation/${organisation.id}`)}>
                    Edit
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={adminPath("/clinics/new")}>Add Branch</Link>
                </Button>
              </div>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
