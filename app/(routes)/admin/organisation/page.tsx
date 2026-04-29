import { getParentOrganizationsFromMedplum } from "@/lib/fhir/admin-service";
import { adminPathForHost } from "@/lib/admin-routes";
import { getHostFromHeaders } from "@/lib/server/subdomain-host";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Plus } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OrganisationPage() {
  const host = getHostFromHeaders(await headers());
  const adminPath = (path: string) => adminPathForHost(path, host);
  const organisations = await getParentOrganizationsFromMedplum();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organisations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage parent companies for clinic branches.
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
          {organisations.map((organisation) => (
            <Card key={organisation.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
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
                  <CardTitle className="text-base">
                    {organisation.name}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
                {organisation.phone && <p>{organisation.phone}</p>}
                {organisation.address && <p>{organisation.address}</p>}
              </CardContent>
              <div className="px-6 pb-4">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={adminPath(`/organisation/${organisation.id}`)}>
                    Edit
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
