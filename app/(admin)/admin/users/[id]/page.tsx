import { notFound } from "next/navigation";
import {
  getOrganizationsFromMedplum,
  getPractitionerFromMedplum,
} from "@/lib/fhir/admin-service";
import UserEditForm from "./user-edit-form";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditUserPage({ params }: Props) {
  const { id } = await params;
  const [user, clinics] = await Promise.all([
    getPractitionerFromMedplum(id),
    getOrganizationsFromMedplum().catch(() => []),
  ]);
  if (!user) {
    notFound();
  }
  return <UserEditForm user={user} clinics={clinics} />;
}
