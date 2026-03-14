/**
 * Admin Service - Server-side helpers for admin portal
 * Uses Medplum client credentials to access all organisations.
 */
import type { MedplumClient } from "@medplum/core";
import { getMedplumClient } from "./patient-service";

export interface ClinicSummary {
  id: string;
  name: string;
  subdomain: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  parentOrganizationId?: string;
  parentOrganizationName?: string;
}

const CLINIC_IDENTIFIER_SYSTEM = "clinic";
const ORG_LOGO_EXTENSION_URL = "https://ucc.emr/organization-logo-url";

function getIdFromReference(reference?: string): string | undefined {
  if (!reference) return undefined;
  const [resourceType, id] = reference.split("/");
  if (!resourceType || !id) return undefined;
  return id;
}

export async function getOrganizationsFromMedplum(): Promise<ClinicSummary[]> {
  const medplum = await getMedplumClient();
  const organizations = await medplum.searchResources("Organization", { _count: "200" });
  const orgNamesById = new Map<string, string>();

  for (const org of organizations ?? []) {
    if (org.id) {
      orgNamesById.set(org.id, org.name ?? "Unnamed clinic");
    }
  }

  return (organizations ?? []).map((org) => {
    const subdomain =
      org.identifier?.find((id) => id.system === CLINIC_IDENTIFIER_SYSTEM)?.value ?? org.id ?? "";
    const phone = org.telecom?.find((t) => t.system === "phone")?.value;
    const address = org.address?.[0]?.text;
    const logoExt = org.extension?.find((e) => e.url === ORG_LOGO_EXTENSION_URL);
    const logoUrl = (logoExt as any)?.valueUrl ?? (logoExt as any)?.valueString ?? undefined;
    const parentOrganizationId = getIdFromReference(org.partOf?.reference);

    return {
      id: org.id ?? "",
      name: org.name ?? "Unnamed clinic",
      subdomain,
      phone,
      address,
      logoUrl,
      parentOrganizationId,
      parentOrganizationName: parentOrganizationId
        ? orgNamesById.get(parentOrganizationId)
        : undefined,
    };
  });
}

export interface PractitionerSummary {
  id: string;
  name: string;
  email?: string;
  organizations?: Array<{ id: string; name: string }>;
}

export interface InvitePractitionerInput {
  firstName: string;
  lastName: string;
  email: string;
  clinicId: string;
  sendEmail?: boolean;
  password?: string;
  medplum?: MedplumClient;
}

export async function deleteOrganizationFromMedplum(
  organizationId: string,
  medplumArg?: MedplumClient
): Promise<void> {
  const medplum = medplumArg ?? (await getMedplumClient());
  const [childOrganizations, practitionerRoles] = await Promise.all([
    medplum.searchResources("Organization", {
      partof: `Organization/${organizationId}`,
      _count: "5",
    }),
    medplum.searchResources("PractitionerRole", {
      organization: `Organization/${organizationId}`,
      _count: "5",
    }),
  ]);

  if ((childOrganizations?.length ?? 0) > 0) {
    throw new Error("Cannot delete an organization that still has branches.");
  }

  if ((practitionerRoles?.length ?? 0) > 0) {
    throw new Error("Cannot delete an organization that still has assigned users.");
  }

  await medplum.deleteResource("Organization", organizationId);
}

export async function deletePractitionerFromMedplum(
  practitionerId: string,
  medplumArg?: MedplumClient
): Promise<void> {
  const medplum = medplumArg ?? (await getMedplumClient());
  const [roles, memberships] = await Promise.all([
    medplum.searchResources("PractitionerRole", {
      practitioner: `Practitioner/${practitionerId}`,
      _count: "100",
    }),
    medplum.searchResources("ProjectMembership", { _count: "200" }),
  ]);

  const matchingMemberships = (memberships ?? []).filter(
    (membership) => membership.profile?.reference === `Practitioner/${practitionerId}`
  );

  for (const role of roles ?? []) {
    if (role.id) {
      await medplum.deleteResource("PractitionerRole", role.id);
    }
  }

  for (const membership of matchingMemberships) {
    if (membership.id) {
      await medplum.deleteResource("ProjectMembership", membership.id);
    }
  }

  await medplum.deleteResource("Practitioner", practitionerId);
}

export async function getPractitionersFromMedplum(): Promise<PractitionerSummary[]> {
  const medplum = await getMedplumClient();
  const [practitioners, roles, organizations] = await Promise.all([
    medplum.searchResources("Practitioner", { _count: "200" }),
    medplum.searchResources("PractitionerRole", { _count: "500" }),
    medplum.searchResources("Organization", { _count: "200" }),
  ]);

  const orgById = new Map<string, { id: string; name: string }>();
  for (const org of organizations ?? []) {
    if (!org.id) continue;
    orgById.set(org.id, { id: org.id, name: org.name ?? "Unnamed clinic" });
  }

  const orgIdsByPractitioner = new Map<string, Set<string>>();
  for (const role of roles ?? []) {
    const practitionerId = getIdFromReference(role.practitioner?.reference);
    const orgId = getIdFromReference(role.organization?.reference);
    if (!practitionerId || !orgId) continue;
    const set = orgIdsByPractitioner.get(practitionerId) ?? new Set<string>();
    set.add(orgId);
    orgIdsByPractitioner.set(practitionerId, set);
  }

  return (practitioners ?? []).map((p) => {
    const name =
      p.name?.[0]?.text ??
      [p.name?.[0]?.given?.join(" "), p.name?.[0]?.family].filter(Boolean).join(" ") ??
      "Unknown";
    const email = p.telecom?.find((t) => t.system === "email")?.value;
    const orgIds = p.id ? Array.from(orgIdsByPractitioner.get(p.id) ?? []) : [];
    const practitionerOrgs = orgIds
      .map((id) => orgById.get(id))
      .filter((value): value is { id: string; name: string } => Boolean(value));
    return { id: p.id ?? "", name, email, organizations: practitionerOrgs };
  });
}

export async function invitePractitionerToMedplum(input: InvitePractitionerInput): Promise<void> {
  const medplum = input.medplum ?? (await getMedplumClient());
  const projectId =
    process.env.MEDPLUM_PROJECT_ID ||
    process.env.NEXT_PUBLIC_MEDPLUM_PROJECT_ID ||
    medplum.getProject()?.id;

  if (!projectId) {
    throw new Error("Medplum project ID not configured");
  }

  const existingPractitioner = await medplum.searchOne("Practitioner", {
    telecom: input.email,
    _count: "10",
  });

  if (existingPractitioner?.id) {
    throw new Error(
      "A user with this email already exists in Medplum. Reuse is blocked to avoid broken login state. Use a different email or recover the existing account."
    );
  }

  const response = await fetch(`${medplum.getBaseUrl()}/admin/projects/${projectId}/invite`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${medplum.getAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      resourceType: "Practitioner",
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      sendEmail: input.sendEmail ?? true,
      ...(input.password ? { password: input.password } : undefined),
      upsert: false,
    }),
  });

  const outcome = await response.json();

  if (!response.ok || (outcome as any)?.resourceType === "OperationOutcome") {
    const issue = (outcome as any)?.issue?.[0];
    const details =
      issue?.details?.text ||
      issue?.diagnostics ||
      (typeof (outcome as any)?.error === "string" ? (outcome as any).error : undefined) ||
      "Invite failed";
    throw new Error(
      /exist|duplicate|email/i.test(details)
        ? "This email is already registered in Medplum. Reusing deleted or existing emails is blocked because it can produce invalid login state."
        : details
    );
  }

  let practitionerId: string | undefined;
  const profileRef = (outcome as any)?.profile?.reference as string | undefined;
  if (profileRef?.startsWith("Practitioner/")) {
    practitionerId = getIdFromReference(profileRef);
  }

  if (!practitionerId) {
    const matches = await medplum.searchResources("Practitioner", {
      telecom: input.email,
      _count: "10",
    });
    const matched = (matches ?? []).find((p) =>
      p.telecom?.some(
        (t) => t.system === "email" && t.value?.toLowerCase() === input.email.toLowerCase()
      )
    );
    practitionerId = matched?.id;
  }

  if (!practitionerId) {
    throw new Error("User created, but practitioner record was not found for clinic assignment.");
  }

  const practitionerRef = `Practitioner/${practitionerId}`;
  const clinicRef = `Organization/${input.clinicId}`;
  const membershipUserRef =
    typeof (outcome as any)?.user?.reference === "string"
      ? String((outcome as any).user.reference)
      : undefined;
  const existingMembershipId =
    (outcome as any)?.resourceType === "ProjectMembership" && typeof (outcome as any)?.id === "string"
      ? String((outcome as any).id)
      : undefined;

  if (!existingMembershipId && membershipUserRef) {
    await medplum.createResource({
      resourceType: "ProjectMembership",
      project: {
        reference: `Project/${projectId}`,
      },
      user: {
        reference: membershipUserRef,
      },
      profile: {
        reference: practitionerRef,
      },
    });
  }

  const existingRole = await medplum.searchOne("PractitionerRole", {
    practitioner: practitionerRef,
    organization: clinicRef,
  });

  if (!existingRole) {
    await medplum.createResource({
      resourceType: "PractitionerRole",
      active: true,
      practitioner: { reference: practitionerRef },
      organization: { reference: clinicRef },
    });
  }
}
