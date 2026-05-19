# Medplum Registration Roadmap

Goal: introduce Medplum-native workflows in parallel with the current UCC workflows, validate them safely, and only replace existing flows after the new flow proves stable.

This document is the working source of truth for future Medplum registration work in this repo.

For the broader non-intake Medplum tracks, see [MEDPLUM_WORKSTREAMS_ROADMAP.md](/Users/hidayat/Documents/Projects/UCC/docs/MEDPLUM_WORKSTREAMS_ROADMAP.md).

## Operating rule

- Do not break or replace the current production workflow first.
- Build new Medplum-native flows beside the current flow.
- Keep rollout reversible with a feature flag, hidden route, or both.
- Only cut over after the new flow has passed functional, workflow, and data checks.

## Decision already made

We are not doing a direct replacement.

We will use this sequence:

1. Build a new flow in parallel.
2. Test it on a narrow surface.
3. Compare it with the current workflow.
4. Switch selected traffic only after it is stable.
5. Remove the old path only after a deliberate cutover.

## First flow

Target: new patient registration with `Questionnaire` and `QuestionnaireResponse`.

Why this is first:

- isolated workflow
- low operational blast radius
- easy to test without disturbing consultation, checkout, billing, or queue flows
- high Medplum value because forms and responses become versioned and structured

Initial shape:

- keep current route `/patients/new` unchanged
- add a dedicated route `/patients/new-v1`
- reuse the current patient creation path so patient registration still lands in the same patient records
- add Medplum-native form capture around that flow

## Guardrails

- `/patients/new` must continue working as-is until cutover is explicitly approved.
- New flow work must not block patient registration if the Medplum questionnaire layer fails.
- Any submission must produce clear logs or structured output for comparison.
- Any new behavior must be disabled by default unless explicitly enabled.
- If a change cannot be turned off quickly, it is too invasive for this phase.

## Non-goals for the first flow

- no replacement of checkout or billing flow
- no referral workflow cutover
- no scheduling redesign
- no broad auth rewrite
- no global patient intake replacement on day one

## Current status

Status: planning complete, implementation not started.

Confirmed findings:

- current patient registration UI lives at `app/(routes)/patients/new/new-patient-form.tsx`
- current patient save path goes through `lib/fhir/patient-client.ts` to `app/api/patients/route.ts`
- current flow already writes `Patient` successfully to Medplum
- runtime code does not yet use `Questionnaire`, `QuestionnaireResponse`, `Bot`, or `Subscription`

## Phase plan

### Phase 0: Preparation

Objective: make the new flow safe to add without touching the current route.

Tasks:

- add a new roadmap-backed intake route
- add feature flags for Medplum intake flows
- define the questionnaire schema for registration
- define what data is authoritative during the new flow

Definition of done:

- route agreed
- flag names agreed
- questionnaire field map agreed

### Phase 1: Parallel implementation

Objective: create a hidden or low-risk registration flow.

Tasks:

- create `/patients/new-v1`
- keep the visual workflow close to the current registration flow unless a strong reason exists to differ
- add server-side creation or upsert of a registration `Questionnaire`
- submit a `QuestionnaireResponse`
- continue creating the `Patient` record through the existing patient creation path

Definition of done:

- a user can complete `/patients/new-v1`
- the route creates a `Patient`
- the route also stores a `QuestionnaireResponse`
- `/patients/new` remains unchanged

### Phase 2: Validation and comparison

Objective: compare the new flow against the current workflow before any rollout.

Tasks:

- define comparison data points:
  - name
  - NRIC
  - date of birth
  - gender
  - phone
  - email
  - address
  - postal code
  - emergency contact
  - allergies
- log or surface mismatches between new-flow structured data and current patient payload
- test failure handling
- confirm no user-facing regression in navigation or post-submit behavior

Definition of done:

- new-flow data can be reviewed reliably
- mismatches are visible
- no silent data loss

### Phase 3: Narrow rollout

Objective: expose the new flow to a limited audience.

Tasks:

- enable for selected users, selected clinics, or selected route entry points
- preserve fallback to the current route
- collect workflow feedback from real usage

Definition of done:

- the new flow can be enabled and disabled quickly
- rollout group is clearly defined
- issues can be traced to new-flow traffic

### Phase 4: Read-path transition

Objective: start trusting Medplum-native intake artifacts more directly.

Tasks:

- review whether `QuestionnaireResponse` becomes primary for intake history
- decide whether patient registration audit screens should show questionnaire answers
- keep fallback reads available while the new flow remains active

Definition of done:

- new-flow artifacts are usable operationally
- old read path is still available as fallback

### Phase 5: Cutover decision

Objective: decide whether to replace the current workflow.

Cutover criteria:

- no blocking workflow regressions
- no material data mismatches
- no increase in failed registrations
- no staff friction that slows intake materially
- rollback path still available

Possible decisions:

- continue the new flow
- expand the new flow
- cut over to Medplum-native route
- abandon the new flow and keep current flow

## Work queue

### Queue A: First implementation slice

Priority: highest

- add `/patients/new-v1`
- add server route or server helper to store questionnaire artifacts
- keep existing patient create flow as the stable write path

### Queue B: Questionnaire design

Priority: high

- define canonical questionnaire name and URL
- define item ids that map cleanly to existing patient fields
- keep the first version small and close to the current form

Suggested first questionnaire sections:

- personal information
- contact information
- emergency contact
- allergy summary

### Queue C: Comparison tooling

Priority: high

- capture enough metadata to compare submission and patient resource payload
- add safe logs or an admin-visible review surface

### Queue D: Rollout controls

Priority: medium

- query param entry
- feature flag entry
- staff-only discovery link if needed

## Recommended file targets

Likely files for the first implementation:

- `docs/MEDPLUM_PILOT_ROADMAP.md`
- `lib/features.ts`
- `app/(routes)/patients/new-v1/page.tsx`
- `app/(routes)/patients/new-v1/...`
- `lib/fhir/patient-client.ts`
- `app/api/patients/route.ts`
- new Medplum questionnaire helper under `lib/fhir/`
- optional new API route under `app/api/`

## Things to preserve exactly

- successful patient registration must still end with the same patient record outcome
- current `/patients/new` navigation behavior must remain unchanged
- existing staff workflow must not be forced onto the new route

## Testing expectations

Every agent working on this roadmap should verify at minimum:

1. the current `/patients/new` flow still works
2. the new `/patients/new-v1` flow works independently
3. patient creation still succeeds
4. questionnaire response creation succeeds
5. new-flow failure does not corrupt the stable patient registration path
6. browser console has no new errors
7. build and lint remain green when feasible

## Change management rules for future agents

When working on this roadmap:

1. Update this document after each meaningful milestone.
2. Change `Current status` if implementation status changes.
3. Mark completed tasks in the relevant phase.
4. Add newly discovered blockers under `Open questions / blockers`.
5. Do not mark cutover work as in scope unless explicitly approved by the user.

## Open questions / blockers

- Should the new flow store only `QuestionnaireResponse`, or also create and manage a formal `Questionnaire` resource in Medplum automatically?
- Should mismatch review live only in logs first, or should we add an admin review screen?
- Should `/patients/new-v1` be fully standalone, or should `/patients/new` support an opt-in switch later?

## Deferred Medplum flows after intake

These are valid next flows, but not in the first implementation slice:

1. `Schedule` and `Slot` for appointment availability
2. `Task` for operational queues and follow-up work
3. `Bot` for server-side workflow automation
4. `Subscription` for real-time updates
5. `Coverage` and eligibility workflows for panel billing

## Summary

Current decision:

- build a Medplum-native intake flow in parallel
- keep the existing registration workflow intact
- validate with a dedicated `new-v1` route
- decide on replacement only after measured success
