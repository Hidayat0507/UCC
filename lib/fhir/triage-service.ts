import { TriageData, VitalSigns, QueueStatus } from '../types';
import { MedplumClient } from '@medplum/core';
import { getAdminMedplum } from '@/lib/server/medplum-admin';
import { getPatientFromMedplum, SavedPatient } from './patient-service';
import { validateFhirResource, logValidation } from './validation';

const CLINIC_IDENTIFIER_SYSTEM = 'clinic';

/** Build the identifiers + serviceProvider fields that tag a triage Encounter to a clinic. */
function clinicEncounterScope(clinicId?: string): Record<string, any> {
  if (!clinicId) return {};
  return {
    identifier: [{ system: CLINIC_IDENTIFIER_SYSTEM, value: clinicId }],
    serviceProvider: { reference: `Organization/${clinicId}` },
  };
}

/** Verify an Encounter belongs to the given clinic. Throws if it does not. */
function assertEncounterBelongsToClinic(encounter: any, clinicId?: string): void {
  if (!clinicId) return; // no scope → no assertion (backward-compat with admin callers)
  const identifierMatch = encounter.identifier?.some(
    (id: any) => id.system === CLINIC_IDENTIFIER_SYSTEM && id.value === clinicId
  );
  const serviceProviderMatch =
    encounter.serviceProvider?.reference === `Organization/${clinicId}`;
  if (!identifierMatch && !serviceProviderMatch) {
    throw new Error(`Access denied: encounter does not belong to clinic '${clinicId}'`);
  }
}

const TRIAGE_ENCOUNTER_EXTENSION_URL = 'https://ucc.emr/triage-encounter';

type Extension = { url: string; [key: string]: any };

interface TriageSummary {
  triage?: TriageData;
  queueStatus?: QueueStatus | null;
  queueAddedAt?: string | null;
  visitIntent?: string;
  payerType?: string;
  paymentMethod?: string;
  billingPerson?: string;
  dependentName?: string;
  dependentRelationship?: string;
  dependentPhone?: string;
  assignedClinician?: string;
  registrationSource?: string;
  registrationAt?: string;
  performedBy?: string;
  encounterId?: string;
}

const VITAL_CODES: Record<
  keyof VitalSigns,
  { code: string; system: string; display: string; unit?: string; quantityCode?: string }
> = {
  bloodPressureSystolic: {
    code: '8480-6',
    system: 'http://loinc.org',
    display: 'Systolic blood pressure',
    unit: 'mmHg',
    quantityCode: 'mm[Hg]',
  },
  bloodPressureDiastolic: {
    code: '8462-4',
    system: 'http://loinc.org',
    display: 'Diastolic blood pressure',
    unit: 'mmHg',
    quantityCode: 'mm[Hg]',
  },
  heartRate: {
    code: '8867-4',
    system: 'http://loinc.org',
    display: 'Heart rate',
    unit: 'beats/minute',
    quantityCode: '/min',
  },
  respiratoryRate: {
    code: '9279-1',
    system: 'http://loinc.org',
    display: 'Respiratory rate',
    unit: 'breaths/minute',
    quantityCode: '/min',
  },
  temperature: {
    code: '8310-5',
    system: 'http://loinc.org',
    display: 'Body temperature',
    unit: 'C',
    quantityCode: 'Cel',
  },
  oxygenSaturation: {
    code: '59408-5',
    system: 'http://loinc.org',
    display: 'Oxygen saturation',
    unit: '%',
    quantityCode: '%',
  },
  painScore: { code: '72514-3', system: 'http://loinc.org', display: 'Pain severity - 0-10 verbal numeric rating' },
  weight: {
    code: '29463-7',
    system: 'http://loinc.org',
    display: 'Body weight',
    unit: 'kg',
    quantityCode: 'kg',
  },
  height: {
    code: '8302-2',
    system: 'http://loinc.org',
    display: 'Body height',
    unit: 'cm',
    quantityCode: 'cm',
  },
};

function queueStatusFromEncounter(encounterStatus?: string): QueueStatus {
  switch (encounterStatus) {
    case 'arrived':
      return 'arrived';
    case 'triaged':
      return 'waiting';
    case 'in-progress':
      return 'in_consultation';
    case 'finished':
      return 'completed';
    default:
      return null;
  }
}

function encounterStatusFromQueue(status: QueueStatus | null): string | undefined {
  switch (status) {
    case 'arrived':
      return 'arrived';
    case 'waiting':
      return 'triaged';
    case 'in_consultation':
      return 'in-progress';
    case 'completed':
    case 'meds_and_bills':
      return 'finished';
    default:
      return undefined;
  }
}

function buildTriageExtension(triageData: Omit<TriageData, 'triageAt' | 'isTriaged'>, triageAtIso: string, queueStatus: QueueStatus) {
  const redFlagExtensions =
    triageData.redFlags?.map((flag) => ({
      url: 'flag',
      valueString: flag,
    })) ?? [];

  const vitalExtensions: Extension[] = [];
  const pushVital = (url: string, value: number | undefined, key: 'valueInteger' | 'valueDecimal' = 'valueInteger') => {
    if (typeof value === 'number') {
      vitalExtensions.push({ url, [key]: value });
    }
  };

  pushVital('bloodPressureSystolic', triageData.vitalSigns?.bloodPressureSystolic);
  pushVital('bloodPressureDiastolic', triageData.vitalSigns?.bloodPressureDiastolic);
  pushVital('heartRate', triageData.vitalSigns?.heartRate);
  pushVital('respiratoryRate', triageData.vitalSigns?.respiratoryRate);
  pushVital('temperature', triageData.vitalSigns?.temperature, 'valueDecimal');
  pushVital('oxygenSaturation', triageData.vitalSigns?.oxygenSaturation);
  pushVital('painScore', triageData.vitalSigns?.painScore);
  pushVital('weight', triageData.vitalSigns?.weight, 'valueDecimal');
  pushVital('height', triageData.vitalSigns?.height, 'valueDecimal');

  return {
    url: TRIAGE_ENCOUNTER_EXTENSION_URL,
    extension: [
      { url: 'triageLevel', valueInteger: triageData.triageLevel },
      { url: 'chiefComplaint', valueString: triageData.chiefComplaint },
      ...(triageData.triageNotes ? [{ url: 'triageNotes', valueString: triageData.triageNotes }] : []),
      ...(triageData.triageBy ? [{ url: 'triageBy', valueString: triageData.triageBy }] : []),
      { url: 'triageAt', valueDateTime: triageAtIso },
      { url: 'isTriaged', valueBoolean: true },
      { url: 'queueStatus', valueString: queueStatus },
      { url: 'queueAddedAt', valueDateTime: triageAtIso },
      ...buildCheckInMetadataExtension(
        triageData.visitIntent,
        triageData.payerType,
        triageData.paymentMethod,
        triageData.assignedClinician,
        triageData.billingPerson,
        triageData.dependentName,
        triageData.dependentRelationship,
        triageData.dependentPhone,
        triageData.registrationSource,
        triageData.registrationAt,
        triageData.performedBy
      ),
      { url: 'vitalSigns', extension: vitalExtensions },
      ...(redFlagExtensions.length
        ? [
            {
              url: 'redFlags',
              extension: redFlagExtensions,
            },
          ]
        : []),
    ],
  };
}

function buildQueueOnlyExtension(queueStatus: QueueStatus, queueAddedAtIso: string) {
  return {
    url: TRIAGE_ENCOUNTER_EXTENSION_URL,
    extension: [
      { url: 'queueStatus', valueString: queueStatus },
      { url: 'queueAddedAt', valueDateTime: queueAddedAtIso },
      { url: 'isTriaged', valueBoolean: false },
    ],
  };
}

function buildCheckInMetadataExtension(
  visitIntent?: string,
  payerType?: string,
  paymentMethod?: string,
  assignedClinician?: string,
  billingPerson?: string,
  dependentName?: string,
  dependentRelationship?: string,
  dependentPhone?: string,
  registrationSource?: string,
  registrationAt?: string,
  performedBy?: string
): Extension[] {
  const entries: Extension[] = [];
  if (visitIntent) entries.push({ url: 'visitIntent', valueString: visitIntent });
  if (payerType) entries.push({ url: 'payerType', valueString: payerType });
  if (paymentMethod) entries.push({ url: 'paymentMethod', valueString: paymentMethod });
  if (assignedClinician) entries.push({ url: 'assignedClinician', valueString: assignedClinician });
  if (billingPerson) entries.push({ url: 'billingPerson', valueString: billingPerson });
  if (dependentName) entries.push({ url: 'dependentName', valueString: dependentName });
  if (dependentRelationship) entries.push({ url: 'dependentRelationship', valueString: dependentRelationship });
  if (dependentPhone) entries.push({ url: 'dependentPhone', valueString: dependentPhone });
  if (registrationSource) entries.push({ url: 'registrationSource', valueString: registrationSource });
  if (registrationAt) entries.push({ url: 'registrationAt', valueDateTime: registrationAt });
  if (performedBy) entries.push({ url: 'performedBy', valueString: performedBy });
  return entries;
}

function validateAndCreate<T extends { resourceType: string }>(medplum: any, resource: T) {
  const validation = validateFhirResource(resource);
  logValidation(resource.resourceType, validation);
  if (!validation.valid) {
    throw new Error(`Invalid ${resource.resourceType}: ${validation.errors.join(', ')}`);
  }
  return medplum.createResource(resource);
}

function parseTriageExtension(extensions?: Extension[]): TriageSummary {
  if (!extensions?.length) return {};
  const triageExt = extensions.find((ext) => ext.url === TRIAGE_ENCOUNTER_EXTENSION_URL);
  if (!triageExt?.extension) return {};

  const getSub = (key: string) => triageExt.extension?.find((e: any) => e.url === key);
  const vitalExt = getSub('vitalSigns');
  const vitals: VitalSigns = {
    bloodPressureSystolic: vitalExt?.extension?.find((e: any) => e.url === 'bloodPressureSystolic')?.valueInteger,
    bloodPressureDiastolic: vitalExt?.extension?.find((e: any) => e.url === 'bloodPressureDiastolic')?.valueInteger,
    heartRate: vitalExt?.extension?.find((e: any) => e.url === 'heartRate')?.valueInteger,
    respiratoryRate: vitalExt?.extension?.find((e: any) => e.url === 'respiratoryRate')?.valueInteger,
    temperature: vitalExt?.extension?.find((e: any) => e.url === 'temperature')?.valueDecimal,
    oxygenSaturation: vitalExt?.extension?.find((e: any) => e.url === 'oxygenSaturation')?.valueInteger,
    painScore: vitalExt?.extension?.find((e: any) => e.url === 'painScore')?.valueInteger,
    weight: vitalExt?.extension?.find((e: any) => e.url === 'weight')?.valueDecimal,
    height: vitalExt?.extension?.find((e: any) => e.url === 'height')?.valueDecimal,
  };

  const redFlagsExt = getSub('redFlags');
  const redFlags =
    redFlagsExt?.extension
      ?.map((e: any) => e.valueString)
      ?.filter((val: string | undefined): val is string => Boolean(val)) ?? [];

  const triageLevel = getSub('triageLevel')?.valueInteger;
  const chiefComplaint = getSub('chiefComplaint')?.valueString;
  const queueStatus = (getSub('queueStatus')?.valueString as QueueStatus) ?? null;
  const queueAddedAt = getSub('queueAddedAt')?.valueDateTime ?? null;

  const triage =
    typeof triageLevel === 'number' && chiefComplaint
      ? ({
          triageLevel,
          chiefComplaint,
          triageNotes: getSub('triageNotes')?.valueString,
          triageBy: getSub('triageBy')?.valueString,
          triageAt: getSub('triageAt')?.valueDateTime,
          isTriaged: Boolean(getSub('isTriaged')?.valueBoolean),
          vitalSigns: vitals,
          redFlags,
        } as TriageData)
      : undefined;

  return {
    triage,
    queueStatus,
    queueAddedAt,
    visitIntent: getSub('visitIntent')?.valueString,
    payerType: getSub('payerType')?.valueString,
    paymentMethod: getSub('paymentMethod')?.valueString,
    billingPerson: getSub('billingPerson')?.valueString,
    dependentName: getSub('dependentName')?.valueString,
    dependentRelationship: getSub('dependentRelationship')?.valueString,
    dependentPhone: getSub('dependentPhone')?.valueString,
    assignedClinician: getSub('assignedClinician')?.valueString,
    registrationSource: getSub('registrationSource')?.valueString,
    registrationAt: getSub('registrationAt')?.valueDateTime,
    performedBy: getSub('performedBy')?.valueString,
  };
}

async function createChiefComplaintObservation(
  medplum: MedplumClient,
  encounterId: string,
  patientRef: string,
  chiefComplaint: string
) {
  await validateAndCreate(medplum, {
    resourceType: 'Observation',
    status: 'final',
    subject: { reference: patientRef },
    encounter: { reference: `Encounter/${encounterId}` },
    code: {
      coding: [{ system: 'http://loinc.org', code: '8661-1', display: 'Chief complaint Narrative' }],
      text: 'Chief Complaint',
    },
    valueString: chiefComplaint,
  });
}

async function createVitalsObservations(
  medplum: MedplumClient,
  encounterId: string,
  patientRef: string,
  vitals: VitalSigns
) {
  const promises: Promise<any>[] = [];

  (Object.keys(vitals) as (keyof VitalSigns)[]).forEach((key) => {
    const value = vitals[key];
    if (typeof value !== 'number') return;
    const codeInfo = VITAL_CODES[key];
    const valueQuantity = codeInfo.quantityCode
      ? {
          value,
          unit: codeInfo.unit,
          system: 'http://unitsofmeasure.org',
          code: codeInfo.quantityCode,
        }
      : { value };

    promises.push(
      validateAndCreate(medplum, {
        resourceType: 'Observation',
        status: 'final',
        subject: { reference: patientRef },
        encounter: { reference: `Encounter/${encounterId}` },
        code: {
          coding: [{ system: codeInfo.system, code: codeInfo.code, display: codeInfo.display }],
          text: codeInfo.display,
        },
        ...(key === 'painScore'
          ? { valueInteger: value }
          : { valueQuantity }),
      })
    );
  });

  await Promise.all(promises);
}

export async function saveTriageEncounter(
  patientId: string,
  triageData: Omit<TriageData, 'triageAt' | 'isTriaged'>,
  medplum: MedplumClient,
  clinicId?: string
): Promise<void> {
  const client = medplum;
  const existing = await getActiveTriageEncounter(patientId, client, clinicId);
  const queueStatus: QueueStatus = 'waiting';
  const triageAtIso =
    existing?.triage?.triageAt?.toString() ||
    existing?.queueAddedAt?.toString() ||
    new Date().toISOString();

  const triagePayload = {
    ...triageData,
    visitIntent: triageData.visitIntent ?? existing?.visitIntent,
    payerType: triageData.payerType ?? existing?.payerType,
    paymentMethod: triageData.paymentMethod ?? existing?.paymentMethod,
    billingPerson: triageData.billingPerson ?? existing?.billingPerson,
    dependentName: triageData.dependentName ?? existing?.dependentName,
    dependentRelationship: triageData.dependentRelationship ?? existing?.dependentRelationship,
    dependentPhone: triageData.dependentPhone ?? existing?.dependentPhone,
    assignedClinician: triageData.assignedClinician ?? existing?.assignedClinician,
    registrationSource: triageData.registrationSource ?? existing?.registrationSource,
    registrationAt: triageData.registrationAt ?? existing?.registrationAt,
    performedBy: triageData.performedBy ?? existing?.performedBy,
  };

  let encounterId: string;

  if (existing?.id) {
    const encounter = await client.readResource('Encounter', existing.id) as any;
    assertEncounterBelongsToClinic(encounter, clinicId);
    const otherExtensions =
      (encounter.extension || []).filter((ext: any) => ext.url !== TRIAGE_ENCOUNTER_EXTENSION_URL);

    const updatedEncounter = await client.updateResource({
      ...encounter,
      status: 'triaged',
      period: {
        ...(encounter.period || {}),
        start: encounter.period?.start || triageAtIso,
      },
      priority: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
            code: String(triagePayload.triageLevel),
            display: `Triage Level ${triagePayload.triageLevel}`,
          },
        ],
      },
      extension: [...otherExtensions, buildTriageExtension(triagePayload, triageAtIso, queueStatus)],
    });
    encounterId = updatedEncounter.id!;
  } else {
    const encounter = await validateAndCreate(client, {
      resourceType: 'Encounter',
      status: 'triaged',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory',
      },
      subject: { reference: `Patient/${patientId}` },
      period: { start: triageAtIso },
      priority: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
            code: String(triagePayload.triageLevel),
            display: `Triage Level ${triagePayload.triageLevel}`,
          },
        ],
      },
      extension: [buildTriageExtension(triagePayload, triageAtIso, queueStatus)],
      ...clinicEncounterScope(clinicId),
    });
    encounterId = encounter.id!;
  }

  await createChiefComplaintObservation(client, encounterId, `Patient/${patientId}`, triagePayload.chiefComplaint);
  await createVitalsObservations(client, encounterId, `Patient/${patientId}`, triagePayload.vitalSigns || {});
}

export async function checkInPatientInTriage(
  patientId: string,
  chiefComplaint?: string,
  metadata?: {
    visitIntent?: string;
    payerType?: string;
    paymentMethod?: string;
    assignedClinician?: string;
    billingPerson?: string;
    dependentName?: string;
    dependentRelationship?: string;
    dependentPhone?: string;
    registrationSource?: string;
    registrationAt?: string;
    performedBy?: string;
  },
  medplum?: MedplumClient,
  clinicId?: string
): Promise<string> {
  const client = medplum ?? (await getAdminMedplum());
  const existing = await getActiveTriageEncounter(patientId, client, clinicId);
  if (existing) {
    await updateQueueStatusForPatient(patientId, 'arrived', client, clinicId);
    return existing.id;
  }

  const queueAddedAtIso = new Date().toISOString();
  const checkInMetadataExt = buildCheckInMetadataExtension(
    metadata?.visitIntent,
    metadata?.payerType,
    metadata?.paymentMethod,
    metadata?.assignedClinician,
    metadata?.billingPerson,
    metadata?.dependentName,
    metadata?.dependentRelationship,
    metadata?.dependentPhone,
    metadata?.registrationSource,
    metadata?.registrationAt,
    metadata?.performedBy
  );
  const encounter = await validateAndCreate(client, {
    resourceType: 'Encounter',
    status: 'arrived',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    subject: { reference: `Patient/${patientId}` },
    period: { start: queueAddedAtIso },
    extension: [buildQueueOnlyExtension('arrived', queueAddedAtIso), ...checkInMetadataExt],
    ...clinicEncounterScope(clinicId),
  });

  if (chiefComplaint) {
    await createChiefComplaintObservation(client, encounter.id!, `Patient/${patientId}`, chiefComplaint);
  }

  return encounter.id!;
}

export async function updateTriageEncounter(
  patientId: string,
  triageData: Partial<TriageData>,
  medplum: MedplumClient,
  clinicId?: string
): Promise<void> {
  const client = medplum;
  const existing = await getActiveTriageEncounter(patientId, client, clinicId);

  if (!existing) {
    throw new Error('No active triage encounter found to update');
  }

  const encounter = await client.readResource('Encounter', existing.id);
  assertEncounterBelongsToClinic(encounter, clinicId);
  const triageExt = buildTriageExtension(
    {
      triageLevel: triageData.triageLevel ?? existing.triage?.triageLevel ?? 3,
      chiefComplaint: triageData.chiefComplaint ?? existing.triage?.chiefComplaint ?? '',
      vitalSigns: triageData.vitalSigns ?? existing.triage?.vitalSigns ?? {},
      visitIntent: triageData.visitIntent ?? existing.visitIntent,
      payerType: triageData.payerType ?? existing.payerType,
      paymentMethod: triageData.paymentMethod ?? existing.paymentMethod,
      billingPerson: triageData.billingPerson ?? existing.billingPerson,
      dependentName: triageData.dependentName ?? existing.dependentName,
      dependentRelationship: triageData.dependentRelationship ?? existing.dependentRelationship,
      dependentPhone: triageData.dependentPhone ?? existing.dependentPhone,
      assignedClinician: triageData.assignedClinician ?? existing.assignedClinician,
      registrationSource: triageData.registrationSource ?? existing.registrationSource,
      registrationAt: triageData.registrationAt ?? existing.registrationAt,
      performedBy: triageData.performedBy ?? existing.performedBy,
      triageNotes: triageData.triageNotes ?? existing.triage?.triageNotes,
      redFlags: triageData.redFlags ?? existing.triage?.redFlags,
      triageBy: triageData.triageBy ?? existing.triage?.triageBy,
    },
    existing.triage?.triageAt?.toString() || new Date().toISOString(),
    existing.queueStatus ?? 'waiting'
  );

  const otherExtensions = (encounter as any).extension?.filter((ext: any) => ext.url !== TRIAGE_ENCOUNTER_EXTENSION_URL) || [];

  await client.updateResource({
    ...(encounter as any),
    extension: [...otherExtensions, triageExt],
  });
}

export async function updateQueueStatusForPatient(
  patientId: string,
  status: QueueStatus | null,
  medplum?: MedplumClient,
  clinicId?: string
): Promise<void> {
  const client = medplum ?? (await getAdminMedplum());
  const existing = await getActiveTriageEncounter(patientId, client, clinicId);

  if (!existing) {
    if (status === 'arrived') {
      await checkInPatientInTriage(patientId, undefined, undefined, client, clinicId);
      return;
    }
    throw new Error('No active triage encounter found');
  }

  const encounter = await client.readResource('Encounter', existing.id) as any;
  assertEncounterBelongsToClinic(encounter, clinicId);
  const newStatus = encounterStatusFromQueue(status);
  if (!newStatus) {
    // If clearing status, mark encounter finished and drop queue extension fields
    encounter.status = 'finished';
  } else {
    encounter.status = newStatus;
    if (newStatus === 'finished') {
      encounter.period = encounter.period || {};
      encounter.period.end = new Date().toISOString();
    }
  }

  const extensions = encounter.extension || [];
  const triageExtIndex = extensions.findIndex((ext: any) => ext.url === TRIAGE_ENCOUNTER_EXTENSION_URL);
  const triageExt: any =
    triageExtIndex >= 0
      ? { ...extensions[triageExtIndex], extension: [...(extensions[triageExtIndex].extension || [])] }
      : { url: TRIAGE_ENCOUNTER_EXTENSION_URL, extension: [] };

  const setSub = (url: string, entry: any | null) => {
    const idx = triageExt.extension.findIndex((e: any) => e.url === url);
    if (entry === null) {
      if (idx >= 0) triageExt.extension.splice(idx, 1);
      return;
    }
    if (idx >= 0) {
      triageExt.extension[idx] = entry;
    } else {
      triageExt.extension.push(entry);
    }
  };

  const nowIso = new Date().toISOString();

  if (status) {
    setSub('queueStatus', { url: 'queueStatus', valueString: status });
    setSub('queueAddedAt', { url: 'queueAddedAt', valueDateTime: existing.queueAddedAt || nowIso });
    if (status === 'arrived') {
      setSub('isTriaged', { url: 'isTriaged', valueBoolean: false });
    }
  } else {
    setSub('queueStatus', null);
    setSub('queueAddedAt', null);
  }

  const newExtensions = [...extensions];
  if (triageExtIndex >= 0) {
    newExtensions[triageExtIndex] = triageExt;
  } else {
    newExtensions.push(triageExt);
  }

  await client.updateResource({
    ...encounter,
    extension: newExtensions,
  });
}

export async function getActiveTriageEncounter(
  patientId: string,
  medplum: MedplumClient,
  clinicId?: string
): Promise<TriageSummary & { id: string } | null> {
  const client = medplum;
  const encounters = await client.searchResources('Encounter', {
    subject: `Patient/${patientId}`,
    status: 'arrived,triaged,in-progress,finished',
    _count: '1',
    _sort: '-_lastUpdated',
    ...(clinicId ? { 'service-provider': `Organization/${clinicId}` } : {}),
  });

  if (!encounters?.length) return null;
  const encounter: any = encounters[0];
  const parsed = parseTriageExtension(encounter.extension);

  return {
    ...parsed,
    encounterId: encounter.id,
    id: encounter.id,
    queueStatus: parsed.queueStatus ?? queueStatusFromEncounter(encounter.status),
    queueAddedAt: parsed.queueAddedAt
      ? new Date(parsed.queueAddedAt).toISOString()
      : encounter.period?.start
      ? new Date(encounter.period.start).toISOString()
      : null,
  };
}

export async function getTriageForPatient(
  patientId: string,
  medplum?: MedplumClient,
  clinicId?: string
): Promise<TriageSummary> {
  const client = medplum ?? (await getAdminMedplum());
  const existing = await getActiveTriageEncounter(patientId, client, clinicId);
  if (!existing) return {};
  return existing;
}

export async function getTriageQueueForToday(
  limit = 200,
  medplum: MedplumClient,
  clinicId?: string
): Promise<SavedPatient[]> {
  const client = medplum;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const startIso = start.toISOString();
  const endIso = end.toISOString();

  // Always scope by clinic. If clinicId is absent, return empty rather than
  // leaking all clinics' data — callers must supply a clinic scope.
  if (!clinicId) {
    console.warn('[getTriageQueueForToday] called without clinicId — returning empty to prevent cross-clinic leak');
    return [];
  }

  const query =
    `status=arrived,triaged,in-progress,finished` +
    `&date=ge${startIso}&date=lt${endIso}` +
    `&_count=${limit}&_sort=date` +
    `&service-provider=Organization/${clinicId}`;

  const encounters = (await client.searchResources('Encounter', query)) as any[];

  const patients: SavedPatient[] = [];

  for (const encounter of encounters) {
    // Double-check ownership at the application layer (defence-in-depth)
    try {
      assertEncounterBelongsToClinic(encounter, clinicId);
    } catch {
      continue; // skip encounters that don't belong to this clinic
    }

    const subjectRef: string = encounter.subject?.reference || '';
    const patientId = subjectRef.replace('Patient/', '');
    if (!patientId) continue;

    const patient = await getPatientFromMedplum(patientId, clinicId, client);
    if (!patient) continue;

    const parsed = parseTriageExtension(encounter.extension);
    const queueAddedAtIso = (parsed.queueAddedAt ?? encounter.period?.start ?? null)
      ? new Date(parsed.queueAddedAt ?? encounter.period?.start).toISOString()
      : null;
    patients.push({
      ...patient,
      triage: parsed.triage,
      queueStatus: parsed.queueStatus ?? queueStatusFromEncounter(encounter.status),
      queueAddedAt: queueAddedAtIso,
      visitIntent: parsed.visitIntent,
      payerType: parsed.payerType,
      paymentMethod: parsed.paymentMethod,
      billingPerson: parsed.billingPerson,
      dependentName: parsed.dependentName,
      dependentRelationship: parsed.dependentRelationship,
      dependentPhone: parsed.dependentPhone,
      assignedClinician: parsed.assignedClinician,
      registrationSource: parsed.registrationSource,
      registrationAt: parsed.registrationAt,
      performedBy: parsed.performedBy,
    });
  }

  return patients
    .filter((p) => p.queueStatus)
    .sort((a, b) => {
      const aTriaged = Boolean((a as any).triage?.isTriaged);
      const bTriaged = Boolean((b as any).triage?.isTriaged);

      // triaged patients first, arrivals next
      if (aTriaged !== bTriaged) {
        return aTriaged ? -1 : 1;
      }

      const aLevel = (a as any).triage?.triageLevel ?? 6; // arrivals without triage sink below triaged
      const bLevel = (b as any).triage?.triageLevel ?? 6;
      if (aLevel !== bLevel) return aLevel - bLevel;

      const aTime = (a as any).queueAddedAt ? new Date((a as any).queueAddedAt).getTime() : 0;
      const bTime = (b as any).queueAddedAt ? new Date((b as any).queueAddedAt).getTime() : 0;
      return aTime - bTime;
    });
}
