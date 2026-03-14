import type { Extension, Medication as FHIRMedication } from '@medplum/fhirtypes';
import { getMedplumClient } from './patient-service';
import { INVENTORY_EXTENSION_URL } from './structure-definitions';

export interface InventoryMedicationData {
  name: string;
  category: string;
  dosageForm: string;
  strengths: string[];
  stock: number;
  minimumStock: number;
  unit: string;
  unitPrice: number;
  expiryDate: string;
}

export interface SavedInventoryMedication extends InventoryMedicationData {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const INVENTORY_IDENTIFIER_SYSTEM = 'https://ucc.emr/inventory/medication';
const INVENTORY_IDENTIFIER_VALUE = 'catalog-item';
const CLINIC_IDENTIFIER_SYSTEM = 'clinic';

type InventoryField = 'category' | 'stock' | 'minimumStock' | 'unit' | 'unitPrice' | 'strength';

function getInventoryRootExtension(extensions?: Extension[]): Extension | undefined {
  return extensions?.find((ext) => ext.url === INVENTORY_EXTENSION_URL);
}

function getInventoryValues(root: Extension | undefined, key: InventoryField): string[] {
  return (
    root?.extension
      ?.filter((ext) => ext.url === key)
      .map((ext) => {
        if (typeof ext.valueString === 'string') return ext.valueString;
        if (typeof ext.valueInteger === 'number') return String(ext.valueInteger);
        if (typeof ext.valueDecimal === 'number') return String(ext.valueDecimal);
        return '';
      })
      .filter(Boolean) ?? []
  );
}

function getSingleInventoryValue(root: Extension | undefined, key: InventoryField): string | undefined {
  return getInventoryValues(root, key)[0];
}

function toInventoryExtension(data: InventoryMedicationData): Extension {
  return {
    url: INVENTORY_EXTENSION_URL,
    extension: [
      { url: 'category', valueString: data.category },
      { url: 'stock', valueInteger: data.stock },
      { url: 'minimumStock', valueInteger: data.minimumStock },
      { url: 'unit', valueString: data.unit },
      { url: 'unitPrice', valueDecimal: data.unitPrice },
      ...data.strengths.map((strength) => ({ url: 'strength', valueString: strength })),
    ],
  };
}

function toFhirMedication(data: InventoryMedicationData, clinicId?: string): FHIRMedication {
  return {
    resourceType: 'Medication',
    identifier: [
      {
        system: INVENTORY_IDENTIFIER_SYSTEM,
        value: INVENTORY_IDENTIFIER_VALUE,
      },
      ...(clinicId ? [{ system: CLINIC_IDENTIFIER_SYSTEM, value: clinicId }] : []),
    ],
    code: {
      text: data.name,
      ...(data.category
        ? {
            coding: [
              {
                system: 'https://ucc.emr/CodeSystem/medication-category',
                code: data.category,
                display: data.category,
              },
            ],
          }
        : {}),
    },
    form: data.dosageForm ? { text: data.dosageForm } : undefined,
    batch: data.expiryDate ? { expirationDate: data.expiryDate } : undefined,
    extension: [toInventoryExtension(data)],
  };
}

function mapFhirMedication(resource: FHIRMedication): SavedInventoryMedication {
  const inventory = getInventoryRootExtension(resource.extension);
  const createdAt = resource.meta?.lastUpdated ? new Date(resource.meta.lastUpdated) : new Date();
  const updatedAt = resource.meta?.lastUpdated ? new Date(resource.meta.lastUpdated) : undefined;

  return {
    id: resource.id || '',
    name: resource.code?.text || 'Unnamed medication',
    category: getSingleInventoryValue(inventory, 'category') || resource.code?.coding?.[0]?.code || '',
    dosageForm: resource.form?.text || '',
    strengths: getInventoryValues(inventory, 'strength'),
    stock: Number(getSingleInventoryValue(inventory, 'stock') || 0),
    minimumStock: Number(getSingleInventoryValue(inventory, 'minimumStock') || 0),
    unit: getSingleInventoryValue(inventory, 'unit') || 'units',
    unitPrice: Number(getSingleInventoryValue(inventory, 'unitPrice') || 0),
    expiryDate: resource.batch?.expirationDate || '',
    createdAt,
    updatedAt,
  };
}

function isInventoryMedication(resource: FHIRMedication, clinicId?: string): boolean {
  const hasInventoryMarker = resource.identifier?.some(
    (identifier) =>
      identifier.system === INVENTORY_IDENTIFIER_SYSTEM &&
      identifier.value === INVENTORY_IDENTIFIER_VALUE
  );
  if (!hasInventoryMarker) {
    return false;
  }
  if (!clinicId) {
    return true;
  }
  return Boolean(
    resource.identifier?.some(
      (identifier) => identifier.system === CLINIC_IDENTIFIER_SYSTEM && identifier.value === clinicId
    )
  );
}

export async function getInventoryMedicationsFromMedplum(clinicId?: string): Promise<SavedInventoryMedication[]> {
  const medplum = await getMedplumClient();
  const medications = await medplum.searchResources('Medication', {
    _count: '500',
    _sort: '-_lastUpdated',
  });

  const mapped = medications
    .filter((resource) => isInventoryMedication(resource as FHIRMedication, clinicId))
    .map((resource) => mapFhirMedication(resource as FHIRMedication));

  return mapped;
}

export async function getInventoryMedicationByIdFromMedplum(id: string, clinicId?: string): Promise<SavedInventoryMedication | null> {
  const medplum = await getMedplumClient();
  const resource = await medplum.readResource('Medication', id);
  if (!isInventoryMedication(resource as FHIRMedication, clinicId)) {
    return null;
  }
  return mapFhirMedication(resource as FHIRMedication);
}

export async function createInventoryMedicationInMedplum(data: InventoryMedicationData, clinicId?: string): Promise<string> {
  const medplum = await getMedplumClient();
  const created = await medplum.createResource(toFhirMedication(data, clinicId));
  if (!created.id) {
    throw new Error('Failed to create inventory medication');
  }
  return created.id;
}

export async function updateInventoryMedicationInMedplum(
  id: string,
  data: Partial<InventoryMedicationData>,
  clinicId?: string
): Promise<void> {
  const medplum = await getMedplumClient();
  const existing = await medplum.readResource('Medication', id);
  if (!isInventoryMedication(existing as FHIRMedication, clinicId)) {
    throw new Error('Medication not found for this clinic');
  }

  const current = mapFhirMedication(existing as FHIRMedication);
  const merged: InventoryMedicationData = {
    name: data.name ?? current.name,
    category: data.category ?? current.category,
    dosageForm: data.dosageForm ?? current.dosageForm,
    strengths: data.strengths ?? current.strengths,
    stock: data.stock ?? current.stock,
    minimumStock: data.minimumStock ?? current.minimumStock,
    unit: data.unit ?? current.unit,
    unitPrice: data.unitPrice ?? current.unitPrice,
    expiryDate: data.expiryDate ?? current.expiryDate,
  };

  await medplum.updateResource({
    ...existing,
    ...toFhirMedication(merged, clinicId),
    id,
  } as FHIRMedication);
}

export async function deleteInventoryMedicationInMedplum(id: string, clinicId?: string): Promise<void> {
  const medplum = await getMedplumClient();
  const resource = await medplum.readResource('Medication', id);
  if (!isInventoryMedication(resource as FHIRMedication, clinicId)) {
    throw new Error('Medication not found for this clinic');
  }
  await medplum.deleteResource('Medication', id);
}
