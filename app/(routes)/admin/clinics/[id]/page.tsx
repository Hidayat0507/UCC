import { notFound } from "next/navigation";
import {
  getOrganizationFromMedplum,
  getParentOrganizationsFromMedplum,
} from "@/lib/fhir/admin-service";
import ClinicEditForm from "./clinic-edit-form";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditClinicPage({ params }: Props) {
  const { id } = await params;
  const [clinic, organisations] = await Promise.all([
    getOrganizationFromMedplum(id),
    getParentOrganizationsFromMedplum(),
  ]);
  if (!clinic) {
    notFound();
  }
  return <ClinicEditForm clinic={clinic} organisations={organisations} />;
}
