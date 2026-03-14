import { getPractitionersFromMedplum } from "@/lib/fhir/admin-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus } from "lucide-react";
import Link from "next/link";
import DeleteUserButton from "@/components/admin/delete-user-button";

export default async function UsersPage() {
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
          <Link href="/admin/users/invite">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Practitioners ({practitioners.length})</CardTitle>
          <CardDescription>
            These are registered Medplum Practitioner resources.
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
                <div key={p.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      {p.email && (
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      )}
                      {p.organizations && p.organizations.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Clinic: {p.organizations.map((o) => o.name).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Practitioner</Badge>
                    <DeleteUserButton userId={p.id} userName={p.name} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
