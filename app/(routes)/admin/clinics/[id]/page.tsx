import { notFound } from "next/navigation";
import { getOrganizationFromMedplum } from "@/lib/fhir/admin-service";
import ClinicEditForm from "./clinic-edit-form";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditClinicPage({ params }: Props) {
  const { id } = await params;
  const clinic = await getOrganizationFromMedplum(id);
  if (!clinic) {
    notFound();
  }
  return <ClinicEditForm clinic={clinic} />;
}
