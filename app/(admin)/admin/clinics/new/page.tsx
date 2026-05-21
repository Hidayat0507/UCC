import { getParentOrganizationsFromMedplum } from "@/lib/fhir/admin-service";
import { adminPathForHost } from "@/lib/admin-routes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { getHostFromHeaders } from "@/lib/server/subdomain-host";
import NewBranchForm from "./new-branch-form";

export const dynamic = "force-dynamic";

export default async function NewBranchPage() {
  const host = getHostFromHeaders(await headers());
  const adminPath = (path: string) => adminPathForHost(path, host);
  const organisations = await getParentOrganizationsFromMedplum().catch(() => []);

  if (organisations.length === 0) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Branch</h1>
          <p className="text-muted-foreground text-sm">
            Register a new clinic branch.
          </p>
        </div>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="flex items-start gap-3 py-6">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-3">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                You need to create an organisation before adding clinic
                branches.
              </p>
              <Button asChild size="sm">
                <Link href={adminPath("/organisation")}>
                  Create Organisation
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <NewBranchForm organisations={organisations} />;
}
