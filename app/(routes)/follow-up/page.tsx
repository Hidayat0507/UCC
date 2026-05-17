export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMedplumForRequest } from "@/lib/server/medplum-auth";
import { resolveClinicIdFromServerScope } from "@/lib/server/clinic";
import { getAllFollowUps } from "@/lib/fhir/communication-service";
import FollowUpClient from "./follow-up-client";

export default async function FollowUpPage() {
  let medplum;
  try {
    medplum = await getMedplumForRequest();
  } catch {
    redirect("/login");
  }

  const clinicId = await resolveClinicIdFromServerScope();
  const followUps = await getAllFollowUps(medplum, clinicId);

  return <FollowUpClient initialFollowUps={followUps} />;
}
