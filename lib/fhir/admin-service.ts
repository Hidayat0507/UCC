/**
 * Admin Service - Server-side helpers for admin portal
 * Uses Medplum client credentials to access all organisations.
 */
import type { Organization } from "@medplum/fhirtypes";
import { getAdminMedplum } from "@/lib/server/medplum-admin";

export interface ClinicSummary {
  id: string;
  name: string;
  subdomain: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

const CLINIC_IDENTIFIER_SYSTEM = "clinic";
const ORG_LOGO_EXTENSION_URL = "https://ucc.emr/organization-logo-url";

export async function getOrganizationsFromMedplum(): Promise<ClinicSummary[]> {
  const medplum = await getAdminMedplum();
  const bundle = await medplum.searchResources("Organization", { _count: "100" });

  return (bundle ?? []).map((org) => {
    const subdomain =
      org.identifier?.find((id) => id.system === CLINIC_IDENTIFIER_SYSTEM)
        ?.value ?? org.id ?? "";
    const phone = org.telecom?.find((t) => t.system === "phone")?.value;
    const address = org.address?.[0]?.text;
    const logoExt = org.extension?.find((e) => e.url === ORG_LOGO_EXTENSION_URL);
    const logoUrl =
      (logoExt as any)?.valueUrl ?? (logoExt as any)?.valueString ?? undefined;

    return {
      id: org.id ?? "",
      name: org.name ?? "Unnamed clinic",
      subdomain,
      phone,
      address,
      logoUrl,
    };
  });
}

export interface PractitionerSummary {
  id: string;
  name: string;
  email?: string;
}

export interface OrganizationInput {
  name: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
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

export async function getPractitionersFromMedplum(): Promise<PractitionerSummary[]> {
  const medplum = await getAdminMedplum();
  const practitioners = await medplum.searchResources("Practitioner", {
    _count: "200",
  });

  return (practitioners ?? []).map((p) => {
    const name =
      p.name?.[0]?.text ??
      [p.name?.[0]?.given?.join(" "), p.name?.[0]?.family]
        .filter(Boolean)
        .join(" ") ??
      "Unknown";
    const email = p.telecom?.find((t) => t.system === "email")?.value;
    return { id: p.id ?? "", name, email };
  });
}
