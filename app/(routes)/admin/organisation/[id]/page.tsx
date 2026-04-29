import { notFound } from "next/navigation";
import { getParentOrganizationsFromMedplum } from "@/lib/fhir/admin-service";
import OrgForm from "../org-form";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditOrganisationPage({ params }: Props) {
  const { id } = await params;
  const organisations = await getParentOrganizationsFromMedplum();
  const organisation = organisations.find((org) => org.id === id);
  if (!organisation) {
    notFound();
  }

  return <OrgForm organisation={organisation} mode="edit" />;
}
