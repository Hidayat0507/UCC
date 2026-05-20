export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { getAllFollowUps } from "@/lib/fhir/communication-service";
import { resolveClinicIdFromServerScope } from "@/lib/server/clinic";
import { getMedplumForRequest } from "@/lib/server/medplum-auth";
import FollowUpClient from "@/app/(routes)/follow-up/follow-up-client";

export default async function FollowUpRootPage() {
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
