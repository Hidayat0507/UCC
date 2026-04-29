import OrgForm from "../org-form";

export const dynamic = "force-dynamic";

export default function NewOrganisationPage() {
  return <OrgForm organisation={null} mode="create" />;
}
