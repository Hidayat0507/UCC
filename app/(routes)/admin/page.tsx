import { listActiveModules } from "@/lib/module-registry";
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
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  GitBranch,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { headers } from "next/headers";
import { getHostFromHeaders } from "@/lib/server/subdomain-host";

export default async function AdminOverviewPage() {
  const host = getHostFromHeaders(await headers());
  const adminPath = (path: string) => adminPathForHost(path, host);
  const [modules, clinics, organisations, practitioners] = await Promise.all([
    listActiveModules().catch(() => []),
    getOrganizationsFromMedplum().catch(() => []),
    getParentOrganizationsFromMedplum().catch(() => []),
    getPractitionersFromMedplum().catch(() => []),
  ]);
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com";
  const assignedUsers = practitioners.filter(
    (user) => (user.organizations?.length ?? 0) > 0
  );
  const setupItems = [
    {
      title: "Organisation",
      description: "Create the parent organisation that owns every branch.",
      ready: organisations.length > 0,
      href: adminPath("/organisation"),
      action: organisations.length > 0 ? "Manage" : "Create",
      icon: Building2,
      detail: `${organisations.length} configured`,
    },
    {
      title: "Branches",
      description: "Add clinic branches under the organisation.",
      ready: clinics.length > 0,
      href: adminPath(clinics.length > 0 ? "/clinics" : "/clinics/new"),
      action: clinics.length > 0 ? "Review" : "Add branch",
      icon: GitBranch,
      detail: `${clinics.length} branch${clinics.length === 1 ? "" : "es"}`,
    },
    {
      title: "Users",
      description: "Invite staff and assign them to branches.",
      ready: assignedUsers.length > 0,
      href: adminPath(assignedUsers.length > 0 ? "/users" : "/users/invite"),
      action: assignedUsers.length > 0 ? "Manage" : "Invite",
      icon: Users,
      detail: `${assignedUsers.length} assigned`,
    },
    {
      title: "Branch modules",
      description: "Review available capabilities before branch-level controls land.",
      ready: modules.length > 0,
      href: adminPath("/modules"),
      action: "View catalogue",
      icon: Activity,
      detail: `${modules.length} available`,
    },
    {
      title: "Settings",
      description: "Confirm domain, Medplum, and admin security settings.",
      ready: Boolean(process.env.NEXT_PUBLIC_BASE_DOMAIN),
      href: adminPath("/settings"),
      action: "Review",
      icon: Settings,
      detail: process.env.NEXT_PUBLIC_BASE_DOMAIN ? "Domain set" : "Needs domain",
    },
  ];
  const readyCount = setupItems.filter((item) => item.ready).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Portal</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Set up the organisation, then manage branches, staff, and branch
            capabilities from that structure.
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
          <p className="text-muted-foreground">Readiness</p>
          <p className="mt-1 text-xl font-semibold">
            {readyCount}/{setupItems.length}
          </p>
        </div>
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
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Setup path</CardTitle>
            <CardDescription>
              The admin structure is Organisation, Branches, then branch
              capabilities.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {setupItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.title}</p>
                        <Badge variant={item.ready ? "secondary" : "outline"}>
                          {item.ready ? "Ready" : "Needs setup"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-sm text-muted-foreground">
                      {item.detail}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={item.href}>
                        {item.action}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branch readiness</CardTitle>
            <CardDescription>
              Branches sit under organisations. Modules are shown as branch
              capabilities, not global setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clinics.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center">
                <p className="font-medium">No branches yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create the first branch after the organisation exists.
                </p>
                <Button className="mt-4" size="sm" asChild>
                  <Link href={adminPath("/clinics/new")}>Add Branch</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {clinics.slice(0, 5).map((clinic) => {
                  const organisationName =
                    clinic.parentName ?? organisations[0]?.name;

                  return (
                    <div
                      key={clinic.id}
                      className="rounded-md border bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{clinic.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {organisationName
                              ? `Under ${organisationName}`
                              : "Organisation context pending"}
                          </p>
                        </div>
                        {organisationName ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {clinic.subdomain}.{baseDomain}
                        </p>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={adminPath(`/clinics/${clinic.id}`)}>
                            Open branch
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {clinics.length > 5 && (
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={adminPath("/clinics")}>
                      View all branches
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
