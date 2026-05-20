import { notFound } from "next/navigation";
import {
  getOrganizationFromMedplum,
  getParentOrganizationsFromMedplum,
} from "@/lib/fhir/admin-service";
import { listActiveModules } from "@/lib/module-registry";
import ClinicEditForm from "./clinic-edit-form";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditClinicPage({ params }: Props) {
  const { id } = await params;
  const [clinic, organisations, modules] = await Promise.all([
    getOrganizationFromMedplum(id),
    getParentOrganizationsFromMedplum(),
    listActiveModules().catch(() => []),
  ]);
  if (!clinic) {
    notFound();
  }
  return (
    <ClinicEditForm
      clinic={clinic}
      organisations={organisations}
      modules={modules.map((module) => ({
        id: module.id,
        label: module.label,
        description: module.description,
      }))}
    />
  );
}
