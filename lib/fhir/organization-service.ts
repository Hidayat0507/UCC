/**
 * Organization Service - Medplum FHIR as Source of Truth
 */

import type { Organization } from "@medplum/fhirtypes";
import { applyMyCoreProfile } from "./mycore";
import { getMedplumClient } from "./patient-service";

export interface OrganizationDetails {
  logoUrl?: string | null;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  parentOrganizationId?: string | null;
}

const CLINIC_IDENTIFIER_SYSTEM = "clinic";
const ORG_LOGO_EXTENSION_URL = "https://ucc.emr/organization-logo-url";

function getLogoUrl(org: Organization): string | null {
  const logoExt = org.extension?.find((ext) => ext.url === ORG_LOGO_EXTENSION_URL);
  const url =
    (logoExt as { valueUrl?: string; valueString?: string } | undefined)?.valueUrl ??
    (logoExt as { valueUrl?: string; valueString?: string } | undefined)?.valueString;
  return typeof url === "string" ? url : null;
}

function upsertLogoExtension(
  extensions: Organization["extension"] | undefined,
  logoUrl?: string | null
): Organization["extension"] | undefined {
  const other = (extensions ?? []).filter((ext) => ext.url !== ORG_LOGO_EXTENSION_URL);
  const nextUrl = logoUrl && logoUrl.trim() ? logoUrl.trim() : null;
  if (!nextUrl) {
    return other.length ? other : undefined;
  }
  return [...other, { url: ORG_LOGO_EXTENSION_URL, valueUrl: nextUrl }];
}

function addClinicIdentifier(
  identifiers: Organization["identifier"] | undefined,
  clinicId: string
): Organization["identifier"] {
  const nextIdentifiers = [...(identifiers || [])];
  const hasClinicId = nextIdentifiers.some(
    (id) => id.system === CLINIC_IDENTIFIER_SYSTEM && id.value === clinicId
  );
  if (!hasClinicId) {
    nextIdentifiers.push({ system: CLINIC_IDENTIFIER_SYSTEM, value: clinicId });
  }
  return nextIdentifiers;
}

function mapOrganizationToDetails(org: Organization): OrganizationDetails {
  const phone = org.telecom?.find((t) => t.system === "phone")?.value;
  const address = org.address?.[0]?.text;
  return {
    logoUrl: getLogoUrl(org),
    name: org.name ?? null,
    address: address ?? null,
    phone: phone ?? null,
    parentOrganizationId: org.partOf?.reference?.replace("Organization/", "") ?? null,
  };
}

async function findOrganizationByClinicId(clinicId: string): Promise<Organization | null> {
  const medplum = await getMedplumClient();
  const found = await medplum.searchOne("Organization", {
    identifier: `${CLINIC_IDENTIFIER_SYSTEM}|${clinicId}`,
  });
  if (found) {
    return found;
  }

  try {
    return await medplum.readResource("Organization", clinicId);
  } catch (error) {
    return null;
  }
}

export async function resolveClinicId(clinicId: string): Promise<string | null> {
  const org = await findOrganizationByClinicId(clinicId);
  return org?.id ?? null;
}

export async function getOrganizationDetailsFromMedplum(
  clinicId: string
): Promise<OrganizationDetails | null> {
  try {
    const org = await findOrganizationByClinicId(clinicId);
    if (!org) return null;
    return mapOrganizationToDetails(org);
  } catch (error) {
    console.error("Failed to get organization from Medplum:", error);
    return null;
  }
}

export async function saveOrganizationDetailsToMedplum(
  details: OrganizationDetails,
  clinicId: string
): Promise<Organization> {
  const medplum = await getMedplumClient();
  const existing = await findOrganizationByClinicId(clinicId);

  const name = details.name === undefined ? existing?.name : details.name?.trim() || undefined;
  const address =
    details.address === undefined
      ? existing?.address?.[0]?.text
      : details.address?.trim() || undefined;
  const phone =
    details.phone === undefined
      ? existing?.telecom?.find((tel) => tel.system === "phone")?.value
      : details.phone?.trim() || undefined;
  const logoUrl =
    details.logoUrl === undefined ? (existing ? getLogoUrl(existing) : undefined) : details.logoUrl;
  const parentOrganizationId =
    details.parentOrganizationId === undefined
      ? existing?.partOf?.reference?.replace("Organization/", "") ?? undefined
      : details.parentOrganizationId?.trim() || undefined;

  const otherTelecom = (existing?.telecom ?? []).filter((tel) => tel.system !== "phone");
  const telecom = phone
    ? [...otherTelecom, { system: "phone", value: phone }]
    : otherTelecom.length
      ? otherTelecom
      : undefined;

  const nextOrg: Organization = applyMyCoreProfile({
    ...(existing ?? { resourceType: "Organization", active: true }),
    ...(existing?.id ? { id: existing.id } : undefined),
    identifier: addClinicIdentifier(existing?.identifier, clinicId),
    name,
    telecom,
    address: address ? [{ text: address }] : undefined,
    extension: upsertLogoExtension(existing?.extension, logoUrl),
    partOf: parentOrganizationId
      ? { reference: `Organization/${parentOrganizationId}` }
      : undefined,
  });

  if (existing?.id) {
    return medplum.updateResource(nextOrg);
  }

  return medplum.createResource(nextOrg);
}
