import ClinicEditForm from "@/components/admin/clinic-edit-form";

export default async function ClinicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClinicEditForm clinicId={id} />;
}
