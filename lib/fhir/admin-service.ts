/**
 * Admin Service - Server-side helpers for admin portal
 * Uses Medplum client credentials to access all organisations.
 */
import type { MedplumClient } from "@medplum/core";
import type { Organization, Practitioner } from "@medplum/fhirtypes";
import { getAdminMedplum } from "@/lib/server/medplum-admin";

function getIdFromReference(reference?: string): string | undefined {
  if (!reference) return undefined;
  const [resourceType, id] = reference.split("/");
  if (!resourceType || !id) return undefined;
  return id;
}

export interface ClinicSummary {
  id: string;
  name: string;
  subdomain: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  parentId?: string;
  parentName?: string;
}

export interface ParentOrganizationSummary {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

const CLINIC_IDENTIFIER_SYSTEM = "clinic";
const ORG_LOGO_EXTENSION_URL = "https://ucc.emr/organization-logo-url";

function mapOrganizationToSummary(org: Organization, parentName?: string): ClinicSummary {
  const subdomain =
    org.identifier?.find((id) => id.system === CLINIC_IDENTIFIER_SYSTEM)
      ?.value ?? org.id ?? "";
  const phone = org.telecom?.find((t) => t.system === "phone")?.value;
  const address = org.address?.[0]?.text;
  const logoExt = org.extension?.find((e) => e.url === ORG_LOGO_EXTENSION_URL);
  const logoUrl =
    (logoExt as any)?.valueUrl ?? (logoExt as any)?.valueString ?? undefined;
  const parentId = getIdFromReference(org.partOf?.reference);

  return {
    id: org.id ?? "",
    name: org.name ?? "Unnamed clinic",
    subdomain,
    phone,
    address,
    logoUrl,
    parentId,
    parentName,
  };
}

function mapOrganizationToParentSummary(org: Organization): ParentOrganizationSummary {
  const phone = org.telecom?.find((t) => t.system === "phone")?.value;
  const address = org.address?.[0]?.text;
  const logoExt = org.extension?.find((e) => e.url === ORG_LOGO_EXTENSION_URL);
  const logoUrl =
    (logoExt as any)?.valueUrl ?? (logoExt as any)?.valueString ?? undefined;
  return { id: org.id ?? "", name: org.name ?? "Unnamed organisation", phone, address, logoUrl };
}

export async function getOrganizationsFromMedplum(): Promise<ClinicSummary[]> {
  const medplum = await getAdminMedplum();
  const all = await medplum.searchResources("Organization", { _count: "200" });

  const hasExplicitParent = (all ?? []).some(
    (org) =>
      !org.partOf &&
      !org.identifier?.some((id) => id.system === CLINIC_IDENTIFIER_SYSTEM)
  );

  // When there is no explicit parent org, the single standalone clinic (no partOf)
  // auto-acts as the parent and must be excluded from the branches list.
  const autoParentId = !hasExplicitParent
    ? (all ?? []).find(
        (org) =>
          !org.partOf &&
          org.identifier?.some((id) => id.system === CLINIC_IDENTIFIER_SYSTEM)
      )?.id
    : undefined;

  const nameById = new Map<string, string>();
  for (const org of all ?? []) {
    if (org.id) nameById.set(org.id, org.name ?? "Unnamed organisation");
  }

  return (all ?? [])
    .filter(
      (org) =>
        org.identifier?.some((id) => id.system === CLINIC_IDENTIFIER_SYSTEM) &&
        org.id !== autoParentId
    )
    .map((org) => {
      const parentId = getIdFromReference(org.partOf?.reference);
      const parentName = parentId ? nameById.get(parentId) : undefined;
      return mapOrganizationToSummary(org, parentName);
    });
}

export async function getParentOrganizationFromMedplum(): Promise<ParentOrganizationSummary | null> {
  const medplum = await getAdminMedplum();
  const all = await medplum.searchResources("Organization", { _count: "200" });

  // Prefer an explicit parent (no clinic identifier, no partOf).
  const explicitParent = (all ?? []).find(
    (org) =>
      !org.partOf &&
      !org.identifier?.some((id) => id.system === CLINIC_IDENTIFIER_SYSTEM)
  );
  if (explicitParent) return mapOrganizationToParentSummary(explicitParent);

  // Fall back: standalone clinic (has identifier, no partOf) acts as auto-parent.
  const autoParent = (all ?? []).find(
    (org) =>
      !org.partOf &&
      org.identifier?.some((id) => id.system === CLINIC_IDENTIFIER_SYSTEM)
  );
  return autoParent ? mapOrganizationToParentSummary(autoParent) : null;
}

export async function saveParentOrganizationToMedplum(
  input: Omit<OrganizationInput, "parentId">
): Promise<ParentOrganizationSummary> {
  const existing = await getParentOrganizationFromMedplum();
  if (existing) throw new Error("A parent organisation already exists.");

  const medplum = await getAdminMedplum();
  const org: Organization = {
    resourceType: "Organization",
    name: input.name,
    ...(input.phone && { telecom: [{ system: "phone" as const, value: input.phone }] }),
    ...(input.address && { address: [{ text: input.address }] }),
    ...(input.logoUrl && { extension: [{ url: ORG_LOGO_EXTENSION_URL, valueUrl: input.logoUrl }] }),
  };
  const saved = await medplum.createResource(org);
  return mapOrganizationToParentSummary(saved);
}

export async function updateParentOrganizationInMedplum(
  id: string,
  input: Omit<OrganizationInput, "parentId">
): Promise<ParentOrganizationSummary> {
  const medplum = await getAdminMedplum();
  const existing = await medplum.readResource("Organization", id);
  const otherExtensions =
    existing.extension?.filter((e) => e.url !== ORG_LOGO_EXTENSION_URL) ?? [];

  const updated: Organization = {
    ...existing,
    resourceType: "Organization",
    name: input.name,
    telecom: input.phone ? [{ system: "phone" as const, value: input.phone }] : undefined,
    address: input.address ? [{ text: input.address }] : undefined,
    extension: input.logoUrl
      ? [...otherExtensions, { url: ORG_LOGO_EXTENSION_URL, valueUrl: input.logoUrl }]
      : otherExtensions.length > 0 ? otherExtensions : undefined,
  };
  const saved = await medplum.updateResource(updated);
  return mapOrganizationToParentSummary(saved);
}

export async function getOrganizationFromMedplum(
  id: string
): Promise<ClinicSummary | null> {
  const medplum = await getAdminMedplum();
  try {
    const org = await medplum.readResource("Organization", id);
    return mapOrganizationToSummary(org);
  } catch {
    return null;
  }
}

export async function updateOrganizationDetailsInMedplum(
  id: string,
  input: OrganizationInput
): Promise<ClinicSummary> {
  const medplum = await getAdminMedplum();
  const existing = await medplum.readResource("Organization", id);

  const identifiers =
    existing.identifier?.filter(
      (ident) => ident.system === CLINIC_IDENTIFIER_SYSTEM
    ) ?? [];
  const otherExtensions =
    existing.extension?.filter((e) => e.url !== ORG_LOGO_EXTENSION_URL) ?? [];

  const updated: Organization = {
    ...existing,
    resourceType: "Organization",
    name: input.name,
    identifier: identifiers.length > 0 ? identifiers : existing.identifier,
    telecom: input.phone
      ? [{ system: "phone" as const, value: input.phone }]
      : undefined,
    address: input.address ? [{ text: input.address }] : undefined,
    extension: input.logoUrl
      ? [
          ...otherExtensions,
          { url: ORG_LOGO_EXTENSION_URL, valueUrl: input.logoUrl },
        ]
      : otherExtensions.length > 0
        ? otherExtensions
        : undefined,
  };

  const saved = await medplum.updateResource(updated);
  return mapOrganizationToSummary(saved);
}

/**
 * Delete an Organization. Refuses if the clinic still has assigned users
 * (PractitionerRole) or child organisations, to avoid orphaning data.
 */
export async function deleteOrganizationFromMedplum(
  organizationId: string
): Promise<void> {
  const medplum = await getAdminMedplum();

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
    throw new Error("Cannot delete a clinic that still has branches.");
  }

  if ((practitionerRoles?.length ?? 0) > 0) {
    throw new Error(
      "Cannot delete a clinic that still has assigned users. Remove user assignments first."
    );
  }

  await medplum.deleteResource("Organization", organizationId);
}

export interface PractitionerSummary {
  id: string;
  name: string;
  email?: string;
  organizations?: { id: string; name: string }[];
}

export interface PractitionerDetail extends PractitionerSummary {
  firstName?: string;
  lastName?: string;
  organizationIds: string[];
}

export interface UpdatePractitionerInput {
  firstName: string;
  lastName: string;
  organizationIds: string[];
}

export interface OrganizationInput {
  name: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  parentId?: string;
}

function scrubDeletedPractitionerTelecom(
  telecom: Practitioner["telecom"] | undefined,
  practitionerId: string
): Practitioner["telecom"] | undefined {
  if (!telecom?.length) {
    return telecom;
  }

  return telecom.map((entry) => {
    if (entry.system !== "email") {
      return entry;
    }

    return {
      ...entry,
      value: `deleted+${practitionerId}@invalid.local`,
    };
  });
}

export async function saveOrganizationDetailsToMedplum(
  input: OrganizationInput,
  subdomain: string
): Promise<void> {
  const medplum = await getAdminMedplum();

  const org: Organization = {
    resourceType: "Organization",
    name: input.name,
    identifier: [{ system: CLINIC_IDENTIFIER_SYSTEM, value: subdomain }],
    ...(input.parentId && {
      partOf: { reference: `Organization/${input.parentId}` },
    }),
    ...(input.phone && {
      telecom: [{ system: "phone" as const, value: input.phone }],
    }),
    ...(input.address && {
      address: [{ text: input.address }],
    }),
    ...(input.logoUrl && {
      extension: [{ url: ORG_LOGO_EXTENSION_URL, valueUrl: input.logoUrl }],
    }),
  };

  await medplum.createResource(org);
}

function practitionerDisplayName(p: Practitioner): string {
  return (
    p.name?.[0]?.text ||
    [p.name?.[0]?.given?.join(" "), p.name?.[0]?.family]
      .filter(Boolean)
      .join(" ") ||
    "Unknown"
  );
}

export async function getPractitionersFromMedplum(): Promise<PractitionerSummary[]> {
  const medplum = await getAdminMedplum();
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

  return (practitioners ?? []).filter((p) => p.active !== false).map((p) => {
    const email = p.telecom?.find((t) => t.system === "email")?.value;
    const orgIds = p.id ? Array.from(orgIdsByPractitioner.get(p.id) ?? []) : [];
    const orgs = orgIds
      .map((id) => orgById.get(id))
      .filter((v): v is { id: string; name: string } => Boolean(v));
    return {
      id: p.id ?? "",
      name: practitionerDisplayName(p),
      email,
      organizations: orgs,
    };
  });
}

export async function getPractitionerFromMedplum(
  id: string
): Promise<PractitionerDetail | null> {
  const medplum = await getAdminMedplum();
  let practitioner: Practitioner;
  try {
    practitioner = await medplum.readResource("Practitioner", id);
  } catch {
    return null;
  }

  const roles = await medplum.searchResources("PractitionerRole", {
    practitioner: `Practitioner/${id}`,
    _count: "100",
  });

  const organizationIds = Array.from(
    new Set(
      (roles ?? [])
        .map((role) => getIdFromReference(role.organization?.reference))
        .filter((v): v is string => Boolean(v))
    )
  );

  const organizations: { id: string; name: string }[] = [];
  for (const orgId of organizationIds) {
    try {
      const org = await medplum.readResource("Organization", orgId);
      organizations.push({ id: orgId, name: org.name ?? "Unnamed clinic" });
    } catch {
      // ignore missing orgs
    }
  }

  const email = practitioner.telecom?.find((t) => t.system === "email")?.value;
  const firstName = practitioner.name?.[0]?.given?.join(" ");
  const lastName = practitioner.name?.[0]?.family;

  return {
    id: practitioner.id ?? "",
    name: practitionerDisplayName(practitioner),
    firstName,
    lastName,
    email,
    organizations,
    organizationIds,
  };
}

export async function updatePractitionerInMedplum(
  id: string,
  input: UpdatePractitionerInput
): Promise<PractitionerDetail> {
  const medplum = await getAdminMedplum();
  const existing = await medplum.readResource("Practitioner", id);

  const updated: Practitioner = {
    ...existing,
    resourceType: "Practitioner",
    name: [
      {
        given: input.firstName ? [input.firstName] : existing.name?.[0]?.given,
        family: input.lastName || existing.name?.[0]?.family,
      },
    ],
  };

  await medplum.updateResource(updated);

  // Sync PractitionerRole assignments to match input.organizationIds.
  const currentRoles = await medplum.searchResources("PractitionerRole", {
    practitioner: `Practitioner/${id}`,
    _count: "100",
  });

  const currentOrgIds = new Set<string>();
  const rolesByOrgId = new Map<string, string>();
  for (const role of currentRoles ?? []) {
    const orgId = getIdFromReference(role.organization?.reference);
    if (orgId && role.id) {
      currentOrgIds.add(orgId);
      rolesByOrgId.set(orgId, role.id);
    }
  }

  const targetOrgIds = new Set(input.organizationIds);

  for (const orgId of Array.from(currentOrgIds)) {
    if (!targetOrgIds.has(orgId)) {
      const roleId = rolesByOrgId.get(orgId);
      if (roleId) {
        await medplum.deleteResource("PractitionerRole", roleId);
      }
    }
  }

  for (const orgId of Array.from(targetOrgIds)) {
    if (!currentOrgIds.has(orgId)) {
      await medplum.createResource({
        resourceType: "PractitionerRole",
        active: true,
        practitioner: { reference: `Practitioner/${id}` },
        organization: { reference: `Organization/${orgId}` },
      });
    }
  }

  const detail = await getPractitionerFromMedplum(id);
  if (!detail) {
    throw new Error("Practitioner not found after update");
  }
  return detail;
}

/**
 * Delete a Practitioner and clean up their PractitionerRoles and
 * ProjectMembership entries so the Medplum project doesn't keep dangling refs.
 */
export async function deletePractitionerFromMedplum(
  practitionerId: string
): Promise<void> {
  const medplum = await getAdminMedplum();
  let practitioner: Practitioner;

  try {
    practitioner = await medplum.readResource("Practitioner", practitionerId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load Practitioner before delete: ${message}`);
  }

  const [roles, memberships] = await Promise.all([
    medplum.searchResources("PractitionerRole", {
      practitioner: `Practitioner/${practitionerId}`,
      _count: "100",
    }),
    medplum.searchResources("ProjectMembership", { _count: "500" }),
  ]);

  const matchingMemberships = (memberships ?? []).filter(
    (membership) =>
      membership.profile?.reference === `Practitioner/${practitionerId}`
  );

  // Collect User refs so we can also drop the login identity. Without this
  // the User remains and causes "email already exists" on re-invite.
  const userRefs = new Set<string>();
  for (const m of matchingMemberships) {
    if (m.user?.reference) userRefs.add(m.user.reference);
  }

  for (const role of roles ?? []) {
    if (role.id) {
      try {
        await medplum.deleteResource("PractitionerRole", role.id);
      } catch (err) {
        console.warn("[deletePractitioner] failed to delete role", role.id, err);
      }
    }
  }

  for (const membership of matchingMemberships) {
    if (membership.id) {
      try {
        await medplum.deleteResource("ProjectMembership", membership.id);
      } catch (err) {
        console.warn(
          "[deletePractitioner] failed to delete membership",
          membership.id,
          err
        );
      }
    }
  }

  try {
    await medplum.deleteResource("Practitioner", practitionerId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      "[deletePractitioner] hard delete failed, archiving Practitioner instead",
      practitionerId,
      message
    );

    try {
      await medplum.updateResource<Practitioner>({
        ...practitioner,
        resourceType: "Practitioner",
        active: false,
        telecom: scrubDeletedPractitionerTelecom(
          practitioner.telecom,
          practitionerId
        ),
      });
    } catch (archiveErr) {
      const archiveMessage =
        archiveErr instanceof Error ? archiveErr.message : String(archiveErr);
      console.error(
        "[deletePractitioner] failed to archive Practitioner after delete rejection",
        practitionerId,
        archiveMessage
      );
      throw new Error(
        `Failed to delete Practitioner: ${message}. Archive fallback also failed: ${archiveMessage}`
      );
    }
  }

  // Best-effort User cleanup (ignore auth errors — User is a super-admin resource).
  for (const ref of Array.from(userRefs)) {
    const [resourceType, id] = ref.split("/");
    if (resourceType !== "User" || !id) continue;
    try {
      await medplum.deleteResource("User", id);
    } catch (err) {
      console.warn("[deletePractitioner] could not delete User", id, err);
    }
  }
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

/**
 * Invite a Practitioner to the Medplum project and assign them to a clinic
 * (via a PractitionerRole that links Practitioner → Organization).
 *
 * When `sendEmail` is false, a `password` must be supplied and the caller is
 * responsible for communicating credentials to the user out-of-band.
 */
export async function invitePractitionerToMedplum(
  input: InvitePractitionerInput
): Promise<void> {
  const medplum = input.medplum ?? (await getAdminMedplum());
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

  const response = await fetch(
    `${medplum.getBaseUrl()}/admin/projects/${projectId}/invite`,
    {
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
    }
  );

  const outcome = await response.json();

  if (!response.ok || (outcome as any)?.resourceType === "OperationOutcome") {
    const issue = (outcome as any)?.issue?.[0];
    const details =
      issue?.details?.text ||
      issue?.diagnostics ||
      (typeof (outcome as any)?.error === "string"
        ? (outcome as any).error
        : undefined) ||
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
        (t) =>
          t.system === "email" &&
          t.value?.toLowerCase() === input.email.toLowerCase()
      )
    );
    practitionerId = matched?.id;
  }

  if (!practitionerId) {
    throw new Error(
      "User created, but practitioner record was not found for clinic assignment."
    );
  }

  const practitionerRef = `Practitioner/${practitionerId}`;
  const clinicRef = `Organization/${input.clinicId}`;
  const membershipUserRef =
    typeof (outcome as any)?.user?.reference === "string"
      ? String((outcome as any).user.reference)
      : undefined;
  const existingMembershipId =
    (outcome as any)?.resourceType === "ProjectMembership" &&
    typeof (outcome as any)?.id === "string"
      ? String((outcome as any).id)
      : undefined;

  if (!existingMembershipId && membershipUserRef) {
    await medplum.createResource({
      resourceType: "ProjectMembership",
      project: { reference: `Project/${projectId}` },
      user: { reference: membershipUserRef },
      profile: { reference: practitionerRef },
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
