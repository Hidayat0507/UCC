import { MedplumClient } from "@medplum/core";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { applyMyCoreProfile } from "./mycore";

export type FhirResource = {
  resourceType: string;
  id?: string;
  meta?: { lastUpdated?: string } & Record<string, unknown>;
} & Record<string, unknown>;

let medplumClient: MedplumClient | undefined;
let medplumInitPromise: Promise<void> | undefined;

function hasMedplumConfig(): boolean {
  const accessToken = process.env.MEDPLUM_ACCESS_TOKEN;
  const clientId = process.env.MEDPLUM_CLIENT_ID;
  const clientSecret = process.env.MEDPLUM_CLIENT_SECRET;
  const email = process.env.MEDPLUM_EMAIL;
  const password = process.env.MEDPLUM_PASSWORD;
  return Boolean(accessToken || (clientId && clientSecret) || (email && password));
}

async function getMedplumClient(): Promise<MedplumClient> {
  if (!medplumClient) {
    const baseUrl = process.env.MEDPLUM_BASE_URL || "http://localhost:8103";
    const accessToken = process.env.MEDPLUM_ACCESS_TOKEN;
    const clientId = process.env.MEDPLUM_CLIENT_ID;
    const clientSecret = process.env.MEDPLUM_CLIENT_SECRET;
    const email = process.env.MEDPLUM_EMAIL;
    const password = process.env.MEDPLUM_PASSWORD;

    medplumClient = new MedplumClient({ baseUrl });

    if (accessToken) {
      medplumClient.setAccessToken(accessToken);
    } else if (clientId && clientSecret) {
      medplumClient.setBasicAuth(clientId, clientSecret);
    } else if (email && password) {
      // For self-hosted Medplum, use email/password login
      if (!medplumInitPromise) {
        medplumInitPromise = medplumClient
          .startLogin({ email, password })
          .then(async (result) => {
            if (!result.code) {
              throw new Error("Medplum email/password login failed - missing auth code");
            }
            await medplumClient!.processCode(result.code);
          });
      }
      await medplumInitPromise;
    } else {
      throw new Error("Medplum client requested without configuration");
    }
  }

  return medplumClient;
}

function collectionName(resourceType: string): string {
  // Keep a dedicated collection per resource type in Firestore
  // E.g., Patient -> fhir_Patient, Encounter -> fhir_Encounter
  return `fhir_${resourceType}`;
}

export async function saveFhirResource<T extends FhirResource>(
  resource: T,
  preferredId?: string
): Promise<string> {
  // MEDPLUM ONLY - No Firebase fallback
  const nowIso = new Date().toISOString();

  const toSave: FhirResource = applyMyCoreProfile({
    ...resource,
    id: preferredId ?? resource.id,
    meta: { ...(resource.meta || {}), lastUpdated: nowIso },
  } as any);

  // Save to Medplum as FHIR store
  const client = await getMedplumClient();
  const created = await client.createResource(toSave as any);
  
  if (!created.id) {
    throw new Error(`Failed to persist ${toSave.resourceType} to Medplum - missing id on response`);
  }
  
  return created.id;
}
