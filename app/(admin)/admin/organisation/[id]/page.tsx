import { notFound } from "next/navigation";
import {
  getOrganizationsFromMedplum,
  getParentOrganizationsFromMedplum,
} from "@/lib/fhir/admin-service";
import OrgForm from "../org-form";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditOrganisationPage({ params }: Props) {
  const { id } = await params;
  const [organisations, clinics] = await Promise.all([
    getParentOrganizationsFromMedplum(),
    getOrganizationsFromMedplum(),
  ]);
  const organisation = organisations.find((org) => org.id === id);
  if (!organisation) {
    notFound();
  }

  return (
    <OrgForm
      organisation={organisation}
      mode="edit"
      branches={clinics.filter(
        (clinic) =>
          clinic.parentId === organisation.id ||
          (!clinic.parentId &&
            organisations.length === 1 &&
            organisations[0]?.id === organisation.id)
      )}
    />
  );
}
