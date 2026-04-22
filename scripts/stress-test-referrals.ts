#!/usr/bin/env bun
/**
 * Stress test for referral FHIR functions (ServiceRequest).
 * Run: bun run scripts/stress-test-referrals.ts
 *
 * Env options:
 *  - REFERRAL_STRESS_COUNT: number of referrals per run (default: 25)
 *  - REFERRAL_STRESS_CONCURRENCY: concurrent ops (default: 5)
 *  - REFERRAL_STRESS_RUNS: number of runs (default: 3)
 *  - REFERRAL_STRESS_CLEANUP: "false" to keep created referrals (default: true)
 *  - REFERRAL_STRESS_PATIENT_ID: use a specific patient id (default: latest patient)
 */

import { getAllPatientsFromMedplum, getMedplumClient } from "../lib/fhir/patient-service";
import {
  getPatientReferralsFromMedplum,
  getReferralFromMedplum,
  saveReferralToMedplum,
  updateReferralInMedplum,
} from "../lib/fhir/referral-service";

type StressResult = {
  created: number;
  updated: number;
  verified: number;
  errors: number;
  createdIds: string[];
};

const COUNT = Number(process.env.REFERRAL_STRESS_COUNT ?? "25");
const CONCURRENCY = Number(process.env.REFERRAL_STRESS_CONCURRENCY ?? "5");
const RUNS = Number(process.env.REFERRAL_STRESS_RUNS ?? "3");
const CLEANUP = process.env.REFERRAL_STRESS_CLEANUP !== "false";
const PATIENT_ID = process.env.REFERRAL_STRESS_PATIENT_ID;
const RETRIES = Number(process.env.REFERRAL_STRESS_RETRIES ?? "3");
const RETRY_DELAY_MS = Number(process.env.REFERRAL_STRESS_RETRY_DELAY_MS ?? "500");

const specialties = [
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "Neurology",
  "Orthopedics",
  "Psychiatry",
  "Ophthalmology",
];

const facilities = [
  "General Hospital",
  "Medical Center",
  "Specialist Clinic",
  "Community Hospital",
];

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;

  async function runner() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.max(1, limit) }, () => runner());
  await Promise.all(workers);
  return results;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>, retries = RETRIES): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const remaining = retries - attempt;
      if (remaining <= 0) break;
      console.warn(`⚠️ ${label} failed, retrying... (${remaining} left)`);
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

function buildReferralInput(patientId: string, runIndex: number, index: number) {
  const specialty = specialties[index % specialties.length];
  const facility = facilities[index % facilities.length];

  return {
    patientId,
    specialty,
    facility,
    department: `Dept ${index % 5}`,
    doctorName: `Dr. Stress ${runIndex + 1}-${index + 1}`,
    urgency: "routine" as const,
    reason: `Stress test reason ${runIndex + 1}-${index + 1}`,
    clinicalInfo: `Stress test clinical info ${runIndex + 1}-${index + 1}`,
    letterText: `Stress test letter ${runIndex + 1}-${index + 1}`,
    date: new Date(),
  };
}

async function getTargetPatientId(): Promise<string> {
  if (PATIENT_ID) return PATIENT_ID;
  const patients = await withRetry("Fetch patients", () => getAllPatientsFromMedplum(1));
  const first = patients[0];
  if (!first?.id) {
    throw new Error("No patients found in Medplum. Provide REFERRAL_STRESS_PATIENT_ID.");
  }
  return first.id;
}

async function runOnce(runIndex: number, patientId: string): Promise<StressResult> {
  const createdIds: string[] = [];
  let created = 0;
  let updated = 0;
  let verified = 0;
  let errors = 0;

  const inputs = Array.from({ length: COUNT }, (_, index) => buildReferralInput(patientId, runIndex, index));

  await runWithConcurrency(inputs, CONCURRENCY, async (input, index) => {
    try {
      const id = await withRetry("Create referral", () => saveReferralToMedplum(input));
      created++;
      createdIds[index] = id;
    } catch (error) {
      errors++;
      console.error("❌ Create failed", { run: runIndex + 1, index: index + 1, error });
    }
  });

  await runWithConcurrency(createdIds.filter(Boolean), CONCURRENCY, async (id, index) => {
    try {
      const referral = await withRetry("Read referral", async () => {
        const result = await getReferralFromMedplum(id);
        if (!result) {
          throw new Error("Referral verification failed");
        }
        return result;
      });
      if (!referral || referral.patientId !== patientId) {
        throw new Error("Referral verification failed");
      }
      verified++;
    } catch (error) {
      errors++;
      console.error("❌ Read failed", { run: runIndex + 1, index: index + 1, error });
    }
  });

  await runWithConcurrency(createdIds.filter(Boolean), CONCURRENCY, async (id, index) => {
    try {
      await withRetry("Update referral", () =>
        updateReferralInMedplum(id, {
          urgency: "urgent",
          clinicalInfo: `Updated clinical info ${runIndex + 1}-${index + 1}`,
          letterText: `Updated letter ${runIndex + 1}-${index + 1}`,
          status: "active",
        })
      );
      updated++;
    } catch (error) {
      errors++;
      console.error("❌ Update failed", { run: runIndex + 1, index: index + 1, error });
    }
  });

  await runWithConcurrency(createdIds.filter(Boolean), CONCURRENCY, async (id, index) => {
    try {
      const referral = await withRetry("Verify referral update", async () => {
        const result = await getReferralFromMedplum(id);
        if (!result) {
          throw new Error("Updated fields missing");
        }
        return result;
      });
      if (!referral?.letterText || !referral?.clinicalInfo) {
        throw new Error("Updated fields missing");
      }
      verified++;
    } catch (error) {
      errors++;
      console.error("❌ Verify update failed", { run: runIndex + 1, index: index + 1, error });
    }
  });

  const allForPatient = await withRetry("List referrals", async () => {
    const result = await getPatientReferralsFromMedplum(patientId);
    if (!result.length && createdIds.filter(Boolean).length) {
      throw new Error("Referral list returned empty");
    }
    return result;
  });
  console.log(`📋 Run ${runIndex + 1}: patient has ${allForPatient.length} referrals total.`);

  return { created, updated, verified, errors, createdIds: createdIds.filter(Boolean) };
}

async function cleanup(ids: string[]) {
  const medplum = await getMedplumClient();
  await runWithConcurrency(ids, CONCURRENCY, async (id) => {
    try {
      await medplum.deleteResource("ServiceRequest", id);
    } catch (error) {
      console.warn("⚠️ Cleanup failed", { id, error });
    }
  });
}

async function main() {
  console.log("🧪 Referral stress test starting...");
  console.log(`- Runs: ${RUNS}`);
  console.log(`- Count per run: ${COUNT}`);
  console.log(`- Concurrency: ${CONCURRENCY}`);
  console.log(`- Cleanup: ${CLEANUP ? "enabled" : "disabled"}`);

  await withRetry("Medplum auth", () => getMedplumClient());
  const patientId = await getTargetPatientId();
  console.log(`- Patient ID: ${patientId}`);

  const aggregate: StressResult = { created: 0, updated: 0, verified: 0, errors: 0, createdIds: [] };

  for (let runIndex = 0; runIndex < RUNS; runIndex++) {
    console.log(`\n🚀 Run ${runIndex + 1}/${RUNS}`);
    const result = await runOnce(runIndex, patientId);
    aggregate.created += result.created;
    aggregate.updated += result.updated;
    aggregate.verified += result.verified;
    aggregate.errors += result.errors;
    aggregate.createdIds.push(...result.createdIds);
    console.log(
      `✅ Run ${runIndex + 1} complete: created=${result.created}, updated=${result.updated}, verified=${result.verified}, errors=${result.errors}`
    );
  }

  if (CLEANUP && aggregate.createdIds.length > 0) {
    console.log("\n🧹 Cleaning up created referrals...");
    await cleanup(aggregate.createdIds);
    console.log("✅ Cleanup complete");
  }

  console.log("\n📊 Stress test summary:");
  console.log(`- Created: ${aggregate.created}`);
  console.log(`- Updated: ${aggregate.updated}`);
  console.log(`- Verified: ${aggregate.verified}`);
  console.log(`- Errors: ${aggregate.errors}`);

  if (aggregate.errors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Stress test failed:", error);
  process.exit(1);
});
