import { getOrganizationsFromMedplum } from "@/lib/fhir/admin-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import DeleteClinicButton from "@/components/admin/delete-clinic-button";

export default async function ClinicsPage() {
  const clinics = await getOrganizationsFromMedplum().catch(() => []);
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "yourdomain.com";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clinics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage all clinic organisations on this platform.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/clinics/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Clinic
          </Link>
        </Button>
      </div>

      {clinics.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No clinics yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              Get started by creating your first clinic.
            </p>
            <Button asChild>
              <Link href="/admin/clinics/new">Create First Clinic</Link>
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
                {clinic.parentOrganizationName && (
                  <p>↳ Branch of {clinic.parentOrganizationName}</p>
                )}
                {clinic.phone && <p>📞 {clinic.phone}</p>}
                {clinic.address && <p>📍 {clinic.address}</p>}
                <p className="font-mono text-xs truncate">
                  {clinic.subdomain}.{baseDomain}
                </p>
              </CardContent>
              <div className="px-6 pb-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href={`/admin/clinics/${clinic.id}`}>Edit</Link>
                </Button>
                <DeleteClinicButton clinicId={clinic.id} clinicName={clinic.name} />
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
