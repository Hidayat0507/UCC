import Link from "next/link";
import { getPractitionersFromMedplum } from "@/lib/fhir/admin-service";
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
import { ChevronRight, Users, UserPlus } from "lucide-react";
import { headers } from "next/headers";
import { getHostFromHeaders } from "@/lib/server/subdomain-host";

export default async function UsersPage() {
  const host = getHostFromHeaders(await headers());
  const adminPath = (path: string) => adminPathForHost(path, host);
  const practitioners = await getPractitionersFromMedplum().catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All practitioners registered across the platform.
          </p>
        </div>
        <Button asChild>
          <Link href={adminPath("/users/invite")}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Practitioners ({practitioners.length})</CardTitle>
          <CardDescription>
            These are registered Medplum Practitioner resources. Click a row to
            edit profile or clinic assignments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {practitioners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold">No users yet</h3>
              <p className="text-muted-foreground text-sm mt-1 mb-4">
                Invite practitioners to get started.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {practitioners.map((p) => (
                <Link
                  key={p.id}
                  href={adminPath(`/users/${p.id}`)}
                  className="flex items-center gap-3 py-3 hover:bg-muted/40 rounded-md px-2 -mx-2 transition-colors"
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    {p.email && (
                      <p className="text-xs text-muted-foreground truncate">
                        {p.email}
                      </p>
                    )}
                  </div>
                  <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-xs">
                    {p.organizations && p.organizations.length > 0 ? (
                      p.organizations.map((org) => (
                        <Badge
                          key={org.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {org.name}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        No clinic
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
