import type { MedplumClient } from '@medplum/core';
import type { Organization } from '@medplum/fhirtypes';
import { DEFAULT_MC_TEMPLATE, DEFAULT_REFERRAL_TEMPLATE } from '@/lib/document-templates';

const TEMPLATE_EXTENSION_BASE_URL = 'https://ucc.emr/document-template';

export function getDefaultTemplate(type: 'mc' | 'referral'): string {
  return type === 'mc' ? DEFAULT_MC_TEMPLATE : DEFAULT_REFERRAL_TEMPLATE;
}

async function findClinicOrganization(clinicId: string, medplum: MedplumClient): Promise<Organization | null> {
  const results = await medplum.searchResources('Organization', {
    identifier: `clinic|${clinicId}`,
    _count: '1',
  });
  return results[0] ?? null;
}

export async function getTemplate(type: 'mc' | 'referral', clinicId: string, medplum: MedplumClient): Promise<string> {
  const extensionUrl = `${TEMPLATE_EXTENSION_BASE_URL}/${type}`;
  try {
    const org = await findClinicOrganization(clinicId, medplum);
    if (!org) return getDefaultTemplate(type);
    const ext = org.extension?.find((e) => e.url === extensionUrl);
    const html = (ext as any)?.valueString;
    return html || getDefaultTemplate(type);
  } catch {
    return getDefaultTemplate(type);
  }
}

export async function saveTemplate(type: 'mc' | 'referral', html: string, clinicId: string, medplum: MedplumClient): Promise<void> {
  const extensionUrl = `${TEMPLATE_EXTENSION_BASE_URL}/${type}`;
  const org = await findClinicOrganization(clinicId, medplum);
  if (!org) {
    throw new Error(`Organization not found for clinic: ${clinicId}`);
  }
  const otherExtensions = (org.extension ?? []).filter((e) => e.url !== extensionUrl);
  await medplum.updateResource({
    ...org,
    extension: [...otherExtensions, { url: extensionUrl, valueString: html }],
  });
}
