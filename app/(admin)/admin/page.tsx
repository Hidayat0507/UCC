import {
  getOrganizationsFromMedplum,
  getParentOrganizationsFromMedplum,
  getPractitionersFromMedplum,
} from "@/lib/fhir/admin-service";
import { adminPathForHost } from "@/lib/admin-routes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Building2,
  GitBranch,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { headers } from "next/headers";
import { getHostFromHeaders } from "@/lib/server/subdomain-host";

export default async function AdminOverviewPage() {
  const host = getHostFromHeaders(await headers());
  const adminPath = (path: string) => adminPathForHost(path, host);
  const [clinics, organisations, practitioners] = await Promise.all([
    getOrganizationsFromMedplum().catch(() => []),
    getParentOrganizationsFromMedplum().catch(() => []),
    getPractitionersFromMedplum().catch(() => []),
  ]);
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com";
  const assignedUsers = practitioners.filter(
    (user) => (user.organizations?.length ?? 0) > 0
  );
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Portal</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Manage organisations, their branches, and each branch's modules
            from one hierarchy.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={adminPath("/organisation")}>Manage Organisation</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={adminPath("/clinics/new")}>Add Branch</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground">Organisations</p>
          <p className="mt-1 text-xl font-semibold">{organisations.length}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Branches</p>
          <p className="mt-1 text-xl font-semibold">{clinics.length}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Assigned users</p>
          <p className="mt-1 text-xl font-semibold">{assignedUsers.length}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Domain</p>
          <p className="mt-1 truncate text-xl font-semibold">{baseDomain}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Organisation Hierarchy</CardTitle>
            <CardDescription>
              Open an organisation to see its branches. Open a branch to manage
              its modules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {organisations.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center">
                <p className="font-medium">No organisations yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create an organisation before adding branches.
                </p>
                <Button className="mt-4" size="sm" asChild>
                  <Link href={adminPath("/organisation/new")}>Add Organisation</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {organisations.map((organisation) => {
                  const branches = branchesByParentId.get(organisation.id) ?? [];

                  return (
                    <div
                      key={organisation.id}
                      className="rounded-md border bg-background p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={adminPath(`/organisation/${organisation.id}`)}
                          className="inline-flex min-w-0 items-center gap-2 font-medium hover:underline"
                        >
                          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{organisation.name}</span>
                        </Link>
                        <Badge variant="outline">
                          {branches.length} branch{branches.length === 1 ? "" : "es"}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        {branches.length === 0 ? (
                          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                            No branches under this organisation.
                          </p>
                        ) : (
                          branches.map((clinic) => (
                            <Link
                              key={clinic.id}
                              href={adminPath(`/clinics/${clinic.id}`)}
                              className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-muted/50"
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
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Assign staff to the branches they can access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">{assignedUsers.length} assigned users</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Users inherit access from their branch assignments.
              </p>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link href={adminPath("/users")}>
                Manage Users
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
