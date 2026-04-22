import type { MedplumClient } from '@medplum/core';
import type { ChargeItemDefinition, Money } from '@medplum/fhirtypes';

export interface ProcedureItem {
  id: string;
  name: string;
  codingSystem?: string;
  codingCode?: string;
  codingDisplay?: string;
  category?: string;
  defaultPrice: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const CLINIC_IDENTIFIER_SYSTEM = 'clinic';
const PROCEDURE_CATEGORY_EXTENSION_URL = 'https://ucc.emr/procedure-category';
const PRICE_CURRENCY = 'MYR';

function getCategory(definition: ChargeItemDefinition): string | undefined {
  const categoryExt = definition.extension?.find((ext) => ext.url === PROCEDURE_CATEGORY_EXTENSION_URL);
  return (categoryExt as { valueString?: string } | undefined)?.valueString || undefined;
}

function getDefaultPrice(definition: ChargeItemDefinition): number {
  const priceComponent = definition.propertyGroup?.[0]?.priceComponent?.[0];
  const amount = priceComponent?.amount as Money | undefined;
  return typeof amount?.value === 'number' ? amount.value : 0;
}

function mapDefinitionToProcedure(definition: ChargeItemDefinition): ProcedureItem {
  const coding = definition.code?.coding?.[0];
  const name = definition.title || definition.code?.text || coding?.display || 'Unnamed Procedure';
  const lastUpdated = definition.meta?.lastUpdated ? new Date(definition.meta.lastUpdated) : undefined;

  return {
    id: definition.id || '',
    name,
    codingSystem: coding?.system,
    codingCode: coding?.code,
    codingDisplay: coding?.display,
    category: getCategory(definition),
    defaultPrice: getDefaultPrice(definition),
    notes: definition.description || undefined,
    createdAt: lastUpdated,
    updatedAt: lastUpdated,
  };
}

function buildCodeableConcept(data: ProcedureItem): ChargeItemDefinition['code'] {
  const hasCoding = Boolean(data.codingSystem || data.codingCode || data.codingDisplay);
  if (!hasCoding && !data.name) {
    return undefined;
  }

  return {
    text: data.name,
    coding: hasCoding
      ? [
          {
            system: data.codingSystem,
            code: data.codingCode,
            display: data.codingDisplay,
          },
        ]
      : undefined,
  };
}

function buildPriceComponent(defaultPrice: number): ChargeItemDefinition['propertyGroup'] {
  if (!Number.isFinite(defaultPrice)) {
    return undefined;
  }

  return [
    {
      priceComponent: [
        {
          type: 'base',
          amount: {
            value: defaultPrice,
            currency: PRICE_CURRENCY,
          },
        },
      ],
    },
  ];
}

function upsertCategoryExtension(
  extensions: ChargeItemDefinition['extension'] | undefined,
  category?: string
): ChargeItemDefinition['extension'] | undefined {
  const other = (extensions ?? []).filter((ext) => ext.url !== PROCEDURE_CATEGORY_EXTENSION_URL);
  const nextCategory = category?.trim();
  if (!nextCategory) {
    return other.length ? other : undefined;
  }
  return [...other, { url: PROCEDURE_CATEGORY_EXTENSION_URL, valueString: nextCategory }];
}

function buildDefinitionUrl(name: string, clinicId: string): string {
  const slug = encodeURIComponent(name.trim() || 'procedure');
  return `https://ucc.emr/charge-item-definition/${clinicId}/${slug}`;
}

async function getDefinitionById(
  medplum: MedplumClient,
  id: string
): Promise<ChargeItemDefinition | null> {
  try {
    return await medplum.readResource('ChargeItemDefinition', id);
  } catch {
    return null;
  }
}

export async function getProcedureByIdFromMedplum(
  medplum: MedplumClient,
  id: string
): Promise<ProcedureItem | null> {
  const definition = await getDefinitionById(medplum, id);
  return definition ? mapDefinitionToProcedure(definition) : null;
}

export async function getProceduresFromMedplum(
  medplum: MedplumClient,
  clinicId: string
): Promise<ProcedureItem[]> {
  const definitions = await medplum.searchResources('ChargeItemDefinition', {
    identifier: `${CLINIC_IDENTIFIER_SYSTEM}|${clinicId}`,
  });
  return definitions.map(mapDefinitionToProcedure);
}

export async function createProcedureInMedplum(
  medplum: MedplumClient,
  data: Omit<ProcedureItem, 'id' | 'createdAt' | 'updatedAt'>,
  clinicId: string
): Promise<string> {
  const name = data.name.trim();
  const definition: ChargeItemDefinition = {
    resourceType: 'ChargeItemDefinition',
    status: 'active',
    url: buildDefinitionUrl(name, clinicId),
    title: name,
    description: data.notes?.trim() || undefined,
    code: buildCodeableConcept({ ...data, id: '', name }),
    identifier: [{ system: CLINIC_IDENTIFIER_SYSTEM, value: clinicId }],
    propertyGroup: buildPriceComponent(data.defaultPrice),
    extension: upsertCategoryExtension(undefined, data.category),
  };

  const created = await medplum.createResource(definition);
  if (!created.id) {
    throw new Error('Failed to create procedure (missing id)');
  }
  return created.id;
}

export async function updateProcedureInMedplum(
  medplum: MedplumClient,
  id: string,
  updates: Partial<ProcedureItem>,
  clinicId: string
): Promise<void> {
  const existing = await getDefinitionById(medplum, id);
  if (!existing) {
    throw new Error('Procedure not found');
  }

  const nextName = updates.name?.trim() || existing.title || existing.code?.text || 'Procedure';
  const nextDescription = updates.notes !== undefined ? updates.notes?.trim() || undefined : existing.description;
  const nextCategory = updates.category !== undefined ? updates.category : getCategory(existing);
  const defaultPrice =
    typeof updates.defaultPrice === 'number' ? updates.defaultPrice : getDefaultPrice(existing);

  const codingData: ProcedureItem = {
    id,
    name: nextName,
    codingSystem: updates.codingSystem ?? existing.code?.coding?.[0]?.system,
    codingCode: updates.codingCode ?? existing.code?.coding?.[0]?.code,
    codingDisplay: updates.codingDisplay ?? existing.code?.coding?.[0]?.display,
    category: nextCategory,
    defaultPrice,
    notes: nextDescription,
  };

  const updated: ChargeItemDefinition = {
    ...existing,
    title: nextName,
    description: nextDescription,
    code: buildCodeableConcept(codingData),
    propertyGroup: buildPriceComponent(defaultPrice),
    identifier: existing.identifier?.length
      ? existing.identifier
      : [{ system: CLINIC_IDENTIFIER_SYSTEM, value: clinicId }],
    extension: upsertCategoryExtension(existing.extension, nextCategory),
  };

  await medplum.updateResource(updated);
}

export async function deleteProcedureInMedplum(
  medplum: MedplumClient,
  id: string
): Promise<void> {
  await medplum.deleteResource('ChargeItemDefinition', id);
}
