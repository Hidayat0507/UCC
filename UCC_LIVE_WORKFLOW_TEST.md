# UCC Live Workflow Test

Date tested: 2026-04-14
Environment tested: `https://klinikputeri.iatrum.com`
Source of access details: `MEDPLUM_SELF_HOSTED_DETAILS.md` and `DEPLOYMENT.md`
Comparison target: `YEZZA_DEMO_ACCOUNT_REPORT.md`

## Scope

This report is written in the same broad order as the Yezza walkthrough so the two systems can be compared more directly.

Modules exercised live on production:

- clinic login
- registration / patient creation
- appointment booking
- triage
- dashboard / queue
- consultation
- orders / billing handoff

## Test account and host

Clinic host used:

- `https://klinikputeri.iatrum.com`

Credential source used:

- verified clinic credential documented in `MEDPLUM_SELF_HOSTED_DETAILS.md`

## Test patient used

Fresh patient created during this run:

- Name:
  - `[E2E] Compare 20260414-122850`
- NRIC:
  - `900414-10-2850`
- Contact:
  - `0123452850`
- Email:
  - `e2e.compare.20260414@example.com`
- Gender:
  - `Male`

Source patient profile created by registration:

- `/patients/50a2d5e0-331d-4bd0-8e71-d765062a4edd`

## End-to-end result

The live clinic workflow is still only partially successful end to end.

What worked:

- clinic login
- patient registration
- triage submission
- queue insertion
- consultation persistence to FHIR
- orders page ingestion of the completed consultation

What failed or behaved incorrectly:

- appointment booking saved to FHIR but did not appear back in the appointments UI
- patient profile did not show the booked appointment
- consultation submit showed failure even though the consultation was actually saved
- post-consultation queue/admin transition failed
- orders page linked the completed consultation row to a different patient record than the one created in registration

## Global layout

Primary sidebar navigation visible after login:

- Dashboard
- Check-in
- Patients
- Orders
- Triage System
- POCT (Point of Care Testing)
- PACS (Medical Imaging)
- Inventory Management
- Appointments
- Analytics & Reports

Header/account controls observed:

- brand link `MediFlow`
- sidebar collapse button
- `Settings`
- `Logout`

Layout difference vs Yezza:

- UCC uses a clinic-operations sidebar shell
- Yezza uses a top-navigation clinic shell
- UCC separates `Patients`, `Triage System`, `Orders`, and `Appointments` into distinct left-nav modules
- Yezza groups the front-desk flow more tightly around `Registration`, `Appointment`, and `Consultation`

## Workflow tested

### 1. Login

Route:

- `https://klinikputeri.iatrum.com/login`

Observed result:

- login succeeded
- post-login landing page was `https://klinikputeri.iatrum.com/dashboard`

### 2. Registration

Route used:

- `https://klinikputeri.iatrum.com/patients/new`

Visible registration structure:

- Personal Information
- Contact Information
- Emergency Contact
- Medical History

Fields exercised:

- Full Name
- NRIC
- Gender
- Email
- Contact Number
- Address
- Postal Code
- Emergency contact name
- Emergency relationship
- Emergency contact number
- Allergies

Observed behavior:

- entering NRIC auto-filled date of birth
- registration is a single-page patient form
- there is no Yezza-style branching step for:
  - existing patient search inside the same modal
  - visit purpose
  - doctor assignment
  - billing payer selection
  - OTC vs consultation routing

Observed result:

- success toast:
  - `Patient registered successfully in FHIR`
- browser log reported:
  - `Patient saved to Medplum FHIR`
- redirect succeeded to:
  - `/patients/50a2d5e0-331d-4bd0-8e71-d765062a4edd`

Result:

- registration succeeded

Comparison note vs Yezza:

- Yezza registration behaves like a front-desk orchestration workflow
- UCC registration currently behaves like patient-master creation only
- visit classification and billing routing happen later, not during registration

### 3. Appointment

Routes used:

- `https://klinikputeri.iatrum.com/appointments`
- `https://klinikputeri.iatrum.com/appointments/new`

Visible appointment layout:

- page summary cards:
  - Total appointments
  - Upcoming today
  - Active bookings
  - Completed this week
- primary actions:
  - `New appointment`
  - `View patients`
- booking form fields:
  - Patient
  - Date
  - Time
  - Clinician
  - Visit type
  - Reason for visit
  - Status
  - Notes for clinical team

Appointment created:

- patient:
  - `[E2E] Compare 20260414-122850`
- clinician:
  - `Dr. Sarah Wong`
- visit type:
  - `Consultation`
- date:
  - `2026-04-14`
- time:
  - `12:29`
- reason:
  - `Yezza comparison live E2E appointment booking`

Observed immediate result:

- success toast:
  - `Appointment scheduled`
- success message:
  - `[E2E] Compare 20260414-122850 booked with Dr. Sarah Wong on 14/04/2026, 12:29:00 (FHIR)`
- browser log reported:
  - `Appointment saved to Medplum FHIR`

Observed failure after save:

- after redirect back to `/appointments`, the page still showed:
  - `Showing 0 upcoming`
  - `No upcoming appointments yet. Schedule one to see it listed here.`
- refreshing the appointments page did not surface the newly created booking
- the patient profile card still showed:
  - `Upcoming Appointment`
  - `None`

Result:

- appointment persistence appears successful at the FHIR layer
- appointment list and patient-profile projection are not reflecting the saved booking

Comparison note vs Yezza:

- Yezza appointment flow returned the new booking into the appointment views and patient profile cleanly
- UCC appointment creation currently has a write-success / read-visibility mismatch

### 4. Triage

Route used:

- `https://klinikputeri.iatrum.com/patients/50a2d5e0-331d-4bd0-8e71-d765062a4edd/triage`

Visible triage structure:

- Patient Information
- Triage Level
- Chief Complaint
- Vital Signs
- Red Flags / Warning Signs
- Triage Notes

Submitted triage data:

- Triage level:
  - `4`
- Chief complaint:
  - `Fever, cough, and body aches for 2 days`
- Blood pressure:
  - `118/76`
- Heart rate:
  - `82`
- Respiratory rate:
  - `18`
- Temperature:
  - `37.9`
- SpO2:
  - `98`
- Pain:
  - `3`
- Weight:
  - `68`
- Height:
  - `171`
- Notes:
  - `Live comparison test against Yezza workflow on production clinic.`

Observed result:

- success toast:
  - `Triage Complete`
- message:
  - `[E2E] Compare 20260414-122850 has been triaged and added to the queue.`
- redirect landed on:
  - `/dashboard`

Result:

- triage succeeded

Comparison note vs Yezza:

- Yezza captures vitals from registration-side visit tools and then hands into consultation queues
- UCC makes triage an explicit separate route after patient registration

### 5. Queue / dashboard verification

Route used:

- `https://klinikputeri.iatrum.com/dashboard`

Verified dashboard queue row after triage:

- Queue number:
  - `001`
- Patient:
  - `[E2E] Compare 20260414-122850`
- NRIC:
  - `900414-10-2850`
- Phone:
  - `0123452850`
- Triage level:
  - `4`
- Chief complaint:
  - `Fever, cough, and body aches for 2 days`
- Added at:
  - `04:31:31`
- Status:
  - `Waiting`

Result:

- queue insertion succeeded

Comparison note vs Yezza:

- Yezza registration queue contains visit-payment-doctor context earlier in the process
- UCC dashboard queue is narrower and centered on triage/consultation readiness

### 6. Consultation

Route used:

- `https://klinikputeri.iatrum.com/patients/50a2d5e0-331d-4bd0-8e71-d765062a4edd/consultation`

Observed carry-through from triage:

- latest vitals section was correctly prefilled from triage

Visible consultation structure:

- patient summary card
- latest vitals from triage
- Clinical notes
- Condition (diagnosis)
- Progress note
- Additional notes
- manual order entry area
- Lab Orders section
- Imaging Orders section
- `Sign Order`

Consultation submitted:

- Clinical notes:
  - `Live E2E comparison with Yezza: fever, cough, and body aches for 2 days. Vitals reviewed from triage.`
- Diagnosis:
  - `Acute viral upper respiratory tract infection`
- Progress note:
  - `Stable for outpatient treatment. Supportive care advised.`
- Additional notes:
  - `Consultation performed during production workflow verification.`

Observed UI result:

- error toast:
  - `Failed to save consultation. Please try again.`

Observed console result:

- success log:
  - `Consultation saved in Medplum FHIR`
- subsequent failures:
  - failed to get patient from Medplum
  - error updating queue status
  - error saving consultation caused by admin/queue transition failure

Result:

- consultation persistence succeeded
- workflow transition failed
- user-facing state is incorrect because the UI reports total failure

### 7. Patient profile verification after consultation

Route used:

- `https://klinikputeri.iatrum.com/patients/50a2d5e0-331d-4bd0-8e71-d765062a4edd`

Verified persisted state:

- consultation history contained a new row dated `April 14, 2026`
- complaint matched the submitted value
- diagnosis matched the submitted value
- consultation links shown:
  - `/consultations/8830b303-94e1-44b1-9fd3-57b8d072fabd`
  - `/consultations/8830b303-94e1-44b1-9fd3-57b8d072fabd/edit`

Additional profile observations:

- triage vitals were correctly visible on the profile
- `Upcoming Appointment` still showed `None` despite the earlier appointment booking success toast

Result:

- consultation persistence succeeded
- appointment projection did not

### 8. Orders / billing handoff

Route used:

- `https://klinikputeri.iatrum.com/orders`

Observed result:

- the completed consultation appeared immediately in the billing/orders table
- row status showed:
  - `Completed`
- actions shown:
  - `Bill`
  - `MC`
  - `Referral`

Critical inconsistency observed:

- the row for `[E2E] Compare 20260414-122850` linked to:
  - `/patients/3b1295c0-457d-4a93-aa7f-8a8ebc27eb52`
- this is not the patient ID created in registration:
  - `/patients/50a2d5e0-331d-4bd0-8e71-d765062a4edd`

Verified follow-up:

- opening the orders row link loaded a different patient profile
- that linked profile had:
  - same name
  - same NRIC
  - same diagnosis alert
  - no consultation history
  - no triage vitals
  - no email value
  - no upcoming appointment

Result:

- orders ingestion happened
- patient linkage is incorrect or duplicated

Comparison note vs Yezza:

- Yezza registration-to-checkout handoff keeps the patient context intact
- UCC orders handoff currently breaks patient identity resolution

## Findings

### 1. Consultation save is partially broken in production

Severity:

- High

Observed behavior:

- user sees consultation save failure
- consultation record is actually created
- queue/admin transition then fails

Impact:

- clinicians get a false failure signal
- duplicate retries are likely
- downstream workflow state becomes inconsistent

Evidence:

- UI toast:
  - `Failed to save consultation. Please try again.`
- patient profile still shows saved consultation entry
- this same defect was also reproduced in the earlier 2026-04-06 live run

### 2. Orders page links completed consultation to the wrong patient record

Severity:

- High

Observed behavior:

- orders row for the tested patient points to a different patient ID than the source patient

Impact:

- billing, MC, and referral actions may be executed against the wrong patient record
- severe data integrity risk

Evidence:

- source patient:
  - `50a2d5e0-331d-4bd0-8e71-d765062a4edd`
- orders row target:
  - `3b1295c0-457d-4a93-aa7f-8a8ebc27eb52`
- this same defect pattern was also reproduced in the 2026-04-06 live run for another patient

### 3. Appointment booking is not reflected back into operational UI

Severity:

- High

Observed behavior:

- appointment creation shows success and logs FHIR persistence
- appointments list still shows zero upcoming appointments
- patient profile still shows no upcoming appointment

Impact:

- front desk cannot trust appointment creation outcome from the UI
- duplicate appointment creation is likely
- appointment workflow is weaker than Yezza’s booking visibility model

Evidence:

- UI toast:
  - `Appointment scheduled`
- appointments page still showed:
  - `Showing 0 upcoming`
- patient profile still showed:
  - `Upcoming Appointment`
  - `None`

### 4. Current UCC workflow is less front-desk integrated than Yezza

Severity:

- Medium

Observed behavior:

- registration, appointment, triage, consultation, and billing are more fragmented across separate modules
- UCC does not yet provide a single front-desk registration flow with built-in visit-purpose, payment-routing, and OTC branching

Impact:

- comparison against Yezza will show a workflow gap, not just UI differences
- operators need more route changes and more module switching in UCC

## UCC vs Yezza summary

### Registration

Yezza:

- front-desk workflow
- new vs existing patient branch
- visit purpose
- doctor assignment
- self/dependent billing
- payment routing
- OTC direct checkout branch

UCC:

- patient master creation only
- no integrated visit-purpose or payment-routing step
- triage and consultation happen later in separate routes

### Appointment

Yezza:

- booking persisted and remained visible in module and patient profile during testing

UCC:

- booking save appears to persist
- booking does not project back into appointment list or patient profile reliably

### Queue / triage

Yezza:

- registration hands into queue directly

UCC:

- triage is the explicit handoff into queue
- this part currently works better than the later consultation transition

### Consultation

Yezza:

- consultation completion moved patients across queue states successfully during demo testing

UCC:

- consultation record saves
- queue/admin progression still fails
- UI reports false failure

### Billing / orders handoff

Yezza:

- downstream patient context stayed coherent

UCC:

- completed consultation reaches orders
- patient identity link breaks on the orders row

## Overall assessment

The live UCC workflow is not yet reliable enough to match the Yezza operator flow end to end.

Current production status by stage:

- Login:
  - Working
- Registration:
  - Working
- Appointment save:
  - Working at persistence layer
- Appointment visibility:
  - Broken
- Triage:
  - Working
- Queue insertion:
  - Working
- Consultation persistence:
  - Working
- Consultation completion / queue transition:
  - Broken
- Orders handoff:
  - Partially working
- Orders patient linkage:
  - Broken

## Recommended next focus

1. Fix appointment read/projection so successful bookings appear in the appointments list and patient profile.
2. Fix consultation post-save workflow so UI success/failure matches the actual saved state.
3. Fix the patient identity/linkage used by the orders page for completed consultations.
4. Re-test queue transition and bill / MC / referral generation after those defects are fixed.

## Post-Deploy Verification

Date retested after production deploy: 2026-04-14
Production deployment status: `READY`

Fresh verification patient:

- Name:
  - `[E2E] PostDeploy 20260414-131532`
- Source patient ID:
  - `6bf8a54c-68e2-4581-8cde-2b4b348b143f`

### Post-deploy result

The three targeted workflow defects were successfully resolved on the live production host for a fresh patient path.

Verified working after deploy:

- appointment booking now appears immediately in the appointments module
- patient profile now shows the upcoming appointment after booking
- consultation no longer shows a false failure toast on successful save
- consultation save redirected cleanly back to the patient profile
- orders row now links to the correct patient record for the fresh completed consultation

Verified post-deploy booking:

- appointment ID:
  - `8e7d4a46-00b9-4233-b75a-62ae775ef04d`
- clinician:
  - `Dr. Sarah Wong`
- patient profile upcoming appointment:
  - `April 14, 2026`

Verified post-deploy consultation:

- consultation ID:
  - `ae4cfe8d-6278-4247-83d1-e829f38a51e0`
- diagnosis:
  - `Acute upper respiratory tract infection`
- orders row patient link:
  - `/patients/6bf8a54c-68e2-4581-8cde-2b4b348b143f`

### Remaining note

Historical bad data created before the fix is still visible in the live system.

Example:

- older queue/orders rows for `[E2E] Compare 20260414-122850` still point to the previously duplicated patient context created before the deployment

Operational interpretation:

- the code path for new post-deploy consultations is fixed
- old duplicate records already written in production will remain unless cleaned up separately
