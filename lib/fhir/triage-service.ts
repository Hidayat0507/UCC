import { TriageData, VitalSigns, QueueStatus } from '../types';
import type { Encounter } from '@medplum/fhirtypes';
import { getMedplumClient, getPatientFromMedplum, SavedPatient } from './patient-service';
import { validateFhirResource, logValidation } from './validation';
import { applyMyCoreProfile, MY_CORE_IDENTIFIERS } from './mycore';

const TRIAGE_ENCOUNTER_EXTENSION_URL = 'https://ucc.emr/triage-encounter';

type Extension = { url: string; [key: string]: any };

interface TriageSummary {
  triage?: TriageData;
  queueStatus?: QueueStatus | null;
  queueAddedAt?: string | null;
  encounterId?: string;
}

const VITAL_CODES: Record<keyof VitalSigns, { code: string; system: string; display: string; unit?: string }> = {
  bloodPressureSystolic: { code: '8480-6', system: 'http://loinc.org', display: 'Systolic blood pressure' },
  bloodPressureDiastolic: { code: '8462-4', system: 'http://loinc.org', display: 'Diastolic blood pressure' },
  heartRate: { code: '8867-4', system: 'http://loinc.org', display: 'Heart rate' },
  respiratoryRate: { code: '9279-1', system: 'http://loinc.org', display: 'Respiratory rate' },
  temperature: { code: '8310-5', system: 'http://loinc.org', display: 'Body temperature', unit: 'Cel' },
  oxygenSaturation: { code: '59408-5', system: 'http://loinc.org', display: 'Oxygen saturation' },
  painScore: { code: '72514-3', system: 'http://loinc.org', display: 'Pain severity - 0-10 verbal numeric rating' },
  weight: { code: '29463-7', system: 'http://loinc.org', display: 'Body weight' },
  height: { code: '8302-2', system: 'http://loinc.org', display: 'Body height' },
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

function encounterStatusFromQueue(status: QueueStatus | null): Encounter['status'] | undefined {
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

function validateAndCreate<T extends { resourceType: string }>(medplum: any, resource: T) {
  const profiledResource = applyMyCoreProfile(resource as any) as T;
  const validation = validateFhirResource(profiledResource);
  logValidation(resource.resourceType, validation);
  if (!validation.valid) {
    throw new Error(`Invalid ${resource.resourceType}: ${validation.errors.join(', ')}`);
  }
  return medplum.createResource(profiledResource);
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
  };
}

async function createChiefComplaintObservation(encounterId: string, patientRef: string, chiefComplaint: string) {
  const medplum = await getMedplumClient();
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

async function createVitalsObservations(encounterId: string, patientRef: string, vitals: VitalSigns) {
  const medplum = await getMedplumClient();
  const promises: Promise<any>[] = [];

  (Object.keys(vitals) as (keyof VitalSigns)[]).forEach((key) => {
    const value = vitals[key];
    if (typeof value !== 'number') return;
    const codeInfo = VITAL_CODES[key];
    const valueQuantity =
      key === 'temperature' || key === 'weight' || key === 'height'
        ? { value, system: 'http://unitsofmeasure.org', code: codeInfo.unit || (key === 'temperature' ? 'Cel' : undefined) }
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

export async function saveTriageEncounter(patientId: string, triageData: Omit<TriageData, 'triageAt' | 'isTriaged'>): Promise<void> {
  const medplum = await getMedplumClient();
  const triageAtIso = new Date().toISOString();
  const queueStatus: QueueStatus = 'waiting';

  const encounter = await validateAndCreate(medplum, {
    resourceType: 'Encounter',
    status: 'triaged',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    identifier: [
      {
        system: MY_CORE_IDENTIFIERS.ENCOUNTER_ID,
        value: `${patientId}-triage-${Date.now()}`,
      },
    ],
    subject: { reference: `Patient/${patientId}` },
    period: { start: triageAtIso },
    priority: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
          code: String(triageData.triageLevel),
          display: `Triage Level ${triageData.triageLevel}`,
        },
      ],
    },
    extension: [buildTriageExtension(triageData, triageAtIso, queueStatus)],
  });

  await createChiefComplaintObservation(encounter.id!, `Patient/${patientId}`, triageData.chiefComplaint);
  await createVitalsObservations(encounter.id!, `Patient/${patientId}`, triageData.vitalSigns || {});
}

export async function checkInPatientInTriage(patientId: string, chiefComplaint?: string): Promise<string> {
  const medplum = await getMedplumClient();
  const existing = await getActiveTriageEncounter(patientId);
  if (existing) {
    await updateQueueStatusForPatient(patientId, 'arrived');
    return existing.id;
  }

  const queueAddedAtIso = new Date().toISOString();
  const encounter = await validateAndCreate(medplum, {
    resourceType: 'Encounter',
    status: 'arrived',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    subject: { reference: `Patient/${patientId}` },
    period: { start: queueAddedAtIso },
    extension: [buildQueueOnlyExtension('arrived', queueAddedAtIso)],
  });

  if (chiefComplaint) {
    await createChiefComplaintObservation(encounter.id!, `Patient/${patientId}`, chiefComplaint);
  }

  return encounter.id!;
}

export async function updateTriageEncounter(
  patientId: string,
  triageData: Partial<TriageData>
): Promise<void> {
  const medplum = await getMedplumClient();
  const existing = await getActiveTriageEncounter(patientId);

  if (!existing) {
    throw new Error('No active triage encounter found to update');
  }

  const encounter = await medplum.readResource('Encounter', existing.id);
  const triageExt = buildTriageExtension(
    {
      triageLevel: triageData.triageLevel ?? existing.triage?.triageLevel ?? 3,
      chiefComplaint: triageData.chiefComplaint ?? existing.triage?.chiefComplaint ?? '',
      vitalSigns: triageData.vitalSigns ?? existing.triage?.vitalSigns ?? {},
      triageNotes: triageData.triageNotes ?? existing.triage?.triageNotes,
      redFlags: triageData.redFlags ?? existing.triage?.redFlags,
      triageBy: triageData.triageBy ?? existing.triage?.triageBy,
    },
    existing.triage?.triageAt?.toString() || new Date().toISOString(),
    existing.queueStatus ?? 'waiting'
  );

  const otherExtensions = (encounter as any).extension?.filter((ext: any) => ext.url !== TRIAGE_ENCOUNTER_EXTENSION_URL) || [];

  await medplum.updateResource(
    applyMyCoreProfile({
      ...(encounter as any),
      extension: [...otherExtensions, triageExt],
    })
  );
}

export async function updateQueueStatusForPatient(patientId: string, status: QueueStatus | null): Promise<void> {
  const medplum = await getMedplumClient();
  const existing = await getActiveTriageEncounter(patientId);

  if (!existing) {
    if (status === 'arrived') {
      await checkInPatientInTriage(patientId);
      return;
    }
    throw new Error('No active triage encounter found');
  }

  const encounter = (await medplum.readResource('Encounter', existing.id)) as Encounter;
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

  await medplum.updateResource(
    applyMyCoreProfile({
      ...encounter,
      extension: newExtensions,
    })
  );
}

export async function getActiveTriageEncounter(
  patientId: string
): Promise<TriageSummary & { id: string } | null> {
  const medplum = await getMedplumClient();
  const encounters = await medplum.searchResources('Encounter', {
    subject: `Patient/${patientId}`,
    status: 'arrived,triaged,in-progress',
    _count: '1',
    _sort: '-_lastUpdated',
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

async function getLatestTriageEncounter(
  patientId: string
): Promise<TriageSummary & { id: string } | null> {
  const medplum = await getMedplumClient();
  const encounters = await medplum.searchResources('Encounter', {
    subject: `Patient/${patientId}`,
    status: 'arrived,triaged,in-progress,finished',
    _count: '20',
    _sort: '-_lastUpdated',
  });

  for (const encounter of encounters as Encounter[]) {
    const parsed = parseTriageExtension(encounter.extension);
    if (!parsed.triage && !parsed.queueStatus && !parsed.queueAddedAt) {
      continue;
    }

    return {
      ...parsed,
      encounterId: encounter.id,
      id: encounter.id!,
      queueStatus: parsed.queueStatus ?? queueStatusFromEncounter(encounter.status),
      queueAddedAt: parsed.queueAddedAt
        ? new Date(parsed.queueAddedAt).toISOString()
        : encounter.period?.start
        ? new Date(encounter.period.start).toISOString()
        : null,
    };
  }

  return null;
}

export async function getTriageForPatient(patientId: string): Promise<TriageSummary> {
  const existing = await getActiveTriageEncounter(patientId);
  if (existing) {
    return existing;
  }

  const latest = await getLatestTriageEncounter(patientId);
  if (latest) {
    return latest;
  }

  return {};
}

export async function getTriageQueueForToday(limit = 200): Promise<SavedPatient[]> {
  let medplum;
  try {
    medplum = await getMedplumClient();
  } catch (err) {
    console.error('[triage] Medplum not configured:', err);
    return [];
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const query = `status=arrived,triaged,in-progress,finished&date=ge${startIso}&date=lt${endIso}&_count=${limit}&_sort=date`;

  const encounters = (await medplum.searchResources('Encounter', query)) as Encounter[];

  // Use Map to deduplicate patients by ID, keeping the most recent encounter data
  const patientsMap = new Map<string, SavedPatient>();

  for (const encounter of encounters) {
    const subjectRef: string = encounter.subject?.reference || '';
    const patientId = subjectRef.replace('Patient/', '');
    if (!patientId) continue;

    const patient = await getPatientFromMedplum(patientId);
    if (!patient) continue;

    const parsed = parseTriageExtension(encounter.extension);
  const queueAddedAtSource = parsed.queueAddedAt ?? encounter.period?.start;
  const queueAddedAtIso = queueAddedAtSource
    ? new Date(queueAddedAtSource).toISOString()
    : null;
    
    const patientData: SavedPatient = {
      ...patient,
      triage: parsed.triage,
      queueStatus: parsed.queueStatus ?? queueStatusFromEncounter(encounter.status),
      queueAddedAt: queueAddedAtIso,
    };

    // If patient already exists, keep the one with the most recent queueAddedAt time
    const existing = patientsMap.get(patientId);
    if (!existing) {
      patientsMap.set(patientId, patientData);
    } else {
      const existingTime = existing.queueAddedAt ? new Date(existing.queueAddedAt).getTime() : 0;
      const newTime = queueAddedAtIso ? new Date(queueAddedAtIso).getTime() : 0;
      if (newTime > existingTime) {
        patientsMap.set(patientId, patientData);
      }
    }
  }

  const patients = Array.from(patientsMap.values());

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
