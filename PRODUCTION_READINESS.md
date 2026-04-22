# Production Readiness

Last updated: 2026-04-15

## Status

- `bun run lint`: passes
- `bun run build`: passes
- Major admin auth regressions previously found were fixed
- Login response no longer returns the Medplum bearer token
- Session durability was improved on 2026-04-15 by introducing server-side refresh-token rotation when short-lived access tokens expire
- Clinic Playwright auth state mismatch was identified on 2026-03-30:
  setup wrote `tests/e2e/.auth/klinikputeri.json` while the clinic project/specs read `tests/e2e/.auth/clinic.json`

Current assessment:

- Build-ready
- Not yet fully production-ready for a healthcare deployment
- All clinical E2E spec files now exist locally, including a dedicated referrals workflow spec added on 2026-03-31; stable hosted verification still depends on the clinic login fixture and live workflow behavior — see Verification Progress below

## Launch Blockers

### 1. Full clinical workflow E2E is still pending

Files:

- `playwright.config.ts`
- `tests/e2e/**` (clinical workflow coverage now includes referrals alongside admin, check-in, clinic-login, consultation, emr-auth, orders, patients, queue, triage)
- `tests/e2e/support/env.ts`

Problem:

- The credential-check E2E (`tests/e2e/credential-check.spec.ts`) **passed in CI on 2026-03-30** (GitHub Actions "Site & Credential Check" run #12, 48s), confirming that production endpoints, login pages, and Medplum credentials are all reachable and valid
- The 11 clinical workflow specs exist in the repo but have **not yet been run in CI** — they are the remaining verification step before full production readiness
- Previously identified live issues remain unresolved: `/patients/{id}/triage` and `/patients/{id}/consultation` returned `404` for fresh patients, and `/check-in` search did not surface a newly created patient immediately after creation

Why it matters:

- Credential validity and endpoint reachability are now proven in CI
- Full session persistence, admin flows, and clinical workflows are not yet proven end-to-end

## Resolved in this repo (trust boundary)

- Admin vs clinic **UI shell** and clinic subdomain validation use **Host** (and `x-forwarded-host`) plus path/cookie fallbacks for localhost — not `medplum-is-admin` / middleware-mirrored `medplum-clinic` cookies.
- `proxy.ts` (Next.js 16 proxy layer) no longer sets those context cookies; `medplum-is-admin` was removed from login.
- `medplum-clinic` may still be set by **login** and **`/api/auth/medplum-session`** (`httpOnly: false`) for localhost and optional client sync; APIs prefer host-derived clinic when on a clinic subdomain.

## Non-Blocking Risks

### AI route logging should be kept metadata-only

Files:

- `app/(routes)/api/smart-text/summary/route.ts`
- `app/(routes)/api/soap-rewrite/route.ts`

Note:

- Logging is better than before, but clinical text handling in logs should stay under review

### Test defaults still point at hosted domains

Files:

- `playwright.config.ts`
- `tests/e2e/support/env.ts`

Note:

- Prefer a dedicated staging environment instead of production-like default hosts

### Build warning: outdated browser mapping data

Note:

- `baseline-browser-mapping` emits a warning during build
- Not a release blocker

## Verified In This Repo

- Admin vs clinic portal UI derives from request host (and path/cookie fallbacks), not `medplum-is-admin`
  - `lib/server/subdomain-host.ts`, `proxy.ts` (Next.js 16 network proxy), `app/layout.tsx`
- Admin clinic creation requires platform-admin auth
  - `app/api/admin/clinics/route.ts`
- Admin Medplum client creation requires platform-admin auth
  - `app/(routes)/api/admin/create-medplum-client/route.ts`
- Login response no longer includes `accessToken`
  - `app/api/auth/login/route.ts`
- POCT order flow now calls the real API
  - `app/(routes)/poct/new/page.tsx`
- PACS order flow now calls the real API
  - `app/(routes)/pacs/new/page.tsx`
- Lint uses a dedicated TypeScript config
  - `package.json`
  - `tsconfig.lint.json`

## Last Verified Checks

- `bun run lint` — passed 2026-03-31
- `bun run build` — passed 2026-03-31
- `credential-check.spec.ts` E2E — passed 2026-03-30 in GitHub Actions (run #12, 48s)
  - `iatrum.com` landing page loads (status < 400, title matches UCC EMR)
  - EMR staff login page accessible (`https://apex-group.iatrum.com/login`, email/password fields visible)
  - Medplum self-hosted UI loads at `https://app.31-97-70-30.sslip.io/signin`
  - Medplum admin login succeeds with production credentials
  - Medplum clinic user logins succeed for all seeded users

## Verification Progress

- 2026-04-15: Fixed short session/auto-logout behavior by adding refresh-token session support in the server auth path. Login now requests `offline_access`, stores a secure refresh cookie, and `getMedplumForRequest()` attempts token refresh before returning `Session expired`.
- 2026-04-15: Session-cookie handling was aligned across auth routes:
  - login route now sets long-lived auth cookies using `AUTH_SESSION_MAX_AGE_SECONDS` (default 30 days)
  - `/api/auth/medplum-session` logout now clears both access and refresh cookies
- 2026-04-15: Verification rerun in repo:
  - `bun run lint` passed
  - `bun run build` passed
- 2026-04-15: Production deployment completed for the session fix (`https://iatrum.com` alias updated).
- 2026-04-15: Live auth verification on `https://klinikputeri.iatrum.com`:
  - login response now sets `medplum-session`, `medplum-refresh`, and `medplum-clinic` with `Max-Age=2592000` and `Domain=.iatrum.com`
  - forced-expired access-token simulation with a valid refresh cookie still returned authenticated `200` from `/api/auth/me`, confirming server-side refresh flow works
- 2026-03-30: Initial staging-targeted `bun run test:e2e` run exposed widespread clinic-flow failures.
- 2026-03-30: First pass separated stale selectors from runtime issues and updated the clinic/admin Playwright specs to match the current UI.
- 2026-03-30: Root cause found for a large portion of clinic failures: clinic auth setup persisted `tests/e2e/.auth/klinikputeri.json`, but the main Playwright config and several specs loaded `tests/e2e/.auth/clinic.json`, which was empty.
- 2026-03-30: Repo updated to use `tests/e2e/.auth/klinikputeri.json` consistently for clinic tests. Fresh E2E rerun pending.
- 2026-03-30: Additional staging verification mismatch found: clinic auth setup used `klinikputeri.iatrum.com`, but the default clinic E2E target in `playwright.config.ts` and `package.json` was `apex-group.iatrum.com`. Repo updated so default clinic verification now targets `klinikputeri.iatrum.com`, matching the authenticated clinic fixture.
- 2026-03-30: Fresh `bun run test:e2e:clinic` rerun after auth-fixture and spec cleanup finished at `20 passed, 12 failed`.
- 2026-03-30: False negatives removed from clinic workflow specs: authenticated `/api/check-in`, `/api/triage`, and `/api/queue` auth assertions were dropped from the clinic project because auth coverage already exists in `tests/e2e/emr-auth.spec.ts`.
- 2026-03-30: Confirmed live runtime issues remain on `klinikputeri.iatrum.com`: `/patients/{id}/triage` and `/patients/{id}/consultation` returned `404` in Playwright snapshots for freshly created patients.
- 2026-03-30: Confirmed live workflow issue remains in reception flow: `/check-in` search still showed `No patients yet. Start typing to search.` immediately after creating a fresh patient, so patient creation/search consistency is not yet proven.
- 2026-03-30: `/patients/new` is deployed and rendering, but the title is not exposed as a semantic heading in the live DOM; remaining patient-form title assertions are test-contract cleanup, not evidence that the page is missing.
- 2026-03-30: Targeted rerun of `tests/e2e/patients.spec.ts` finished at `6 passed, 1 failed`. The remaining patient failure exposed a stale test assumption: the old URL check incorrectly treated `/patients/new` as a successful patient-profile redirect. Fresh-patient create/profile landing is therefore still unproven and must remain a release blocker until verified against a real patient ID.
- 2026-03-30: `credential-check.spec.ts` passed in GitHub Actions (Site & Credential Check run #12, 48s). Verified: landing page reachable, EMR staff login page accessible, Medplum self-hosted UI loads, Medplum admin login succeeds, all seeded clinic user logins succeed. Old "E2E verification missing entirely" blocker is now partially resolved — credential check is done, full clinical workflow E2E remains.
- 2026-03-31: Fixed the shared clinic E2E helper bug where multiple specs accepted `/patients/new` as if it were a real saved patient profile route. This was generating fake patient IDs such as `new` and cascading into false 404s on follow-on pages.
- 2026-03-31: Full `bun run test:e2e:clinic` rerun after helper fixes finished at `24 passed, 8 failed`.
- 2026-03-31: Previously reported route-level 404 blockers are no longer reproduced in the suite. `consultation page renders correctly`, `consultation happy-path`, `triage page is reachable`, and `triage form loads with vitals fields` now pass.
- 2026-03-31: One transient clinic auth setup timeout occurred during rerun, but an immediate focused rerun of `tests/e2e/setup/clinic-auth.setup.ts` passed in `6.3s`, so this is not currently treated as a persistent blocker.
- 2026-03-31: Remaining failures are now concentrated in workflow behavior and assertion cleanup:
  - `/check-in` still does not find a freshly created patient by NRIC
  - triage submit does not complete the queue workflow in a way the tests can observe
  - queue workflow tests still time out waiting for patients to appear in queue / progress to consultation
  - two remaining failures are strict-mode assertion issues in `consultation.spec.ts` and `patients.spec.ts`, not route-availability failures
- 2026-03-31: Additional repo fixes landed:
  - clinic-scoped patient search now falls back to deterministic local filtering by `fullName` / `nric` / `phone` in `lib/fhir/patient-service.ts`
  - queue/triage specs were aligned to patient-specific triage links and less brittle post-submit state checks
  - queue-status read path now includes `finished` encounters in `lib/fhir/triage-service.ts`, so `meds_and_bills` / completed states can still be read back from the latest encounter
- 2026-03-31: Best full clinic rerun after those fixes reached `28 passed, 4 failed`.
- 2026-03-31: Follow-up reruns remained unstable on the hosted target and regressed back to fresh-patient creation/search timeouts (`24 passed, 6 failed` in one later rerun). This suggests the remaining issue is not just test drift but live-environment instability around freshly-created patients.
- 2026-03-31: Repo verification commands rerun locally after the latest fixes:
  - `bun run lint` passed
  - `bun run build` passed
- 2026-03-31: Added `tests/e2e/referrals.spec.ts` and wired it into the clinic Playwright project. The new spec covers referral-tab rendering, validation feedback, and a happy-path save with the `/api/referral-letter` step stubbed in-browser so the actual referral save can still exercise the deployed backend.
- 2026-03-31: Targeted referral-spec runs against `klinikputeri.iatrum.com` remain blocked by intermittent clinic login instability. On successful bootstrap attempts the deployed patient profile does show the `Referral / MC` tab, `Referral Letters`, and `No referrals yet.` state, but repeated runs still get stuck on `/login`, so referral workflow verification is not yet clean enough to count toward release sign-off.
- 2026-03-31: Root cause identified for the login instability on the hosted clinic target. A direct browser reproduction showed successful `/api/auth/login` responses followed by browser-side `https://fhir.iatrum.com/auth/me` requests being blocked by CORS from `https://klinikputeri.iatrum.com`. The client auth provider was still depending on direct Medplum browser calls (`getProfileAsync()` / `auth/me`) to establish auth state after login.
- 2026-03-31: Repo mitigation landed: `lib/auth-medplum.tsx` now restores and verifies auth state through same-origin `/api/auth/medplum-session` and `/api/auth/me` instead of direct browser Medplum profile calls, and `app/api/auth/me` now returns the raw profile plus admin status for the client. This removes the browser CORS dependency from the auth bootstrap path in the repo; hosted verification still requires deploy and rerun.
- 2026-03-31: Post-push hosted retest confirms the live clinic deployment has not yet picked up the auth mitigation. Browser reproduction still shows `/api/auth/login` returning an `accessToken` in the JSON body and the client still calling `https://fhir.iatrum.com/auth/me` directly from the browser, which fails CORS. Focused rerun of `tests/e2e/setup/clinic-auth.setup.ts` still times out waiting to leave `/login`.
- 2026-03-31: The auth mitigation was promoted to production and the hosted clinic login was retested successfully. Direct browser reproduction on `https://klinikputeri.iatrum.com/login` now shows the new same-origin flow:
  `/api/auth/login` returns the new repo response shape, then `/api/auth/medplum-session` and `/api/auth/me` both return `200`, session cookies are set on `.iatrum.com`, and the browser lands on `/dashboard` with no Medplum CORS errors.
- 2026-03-31: Focused rerun of `tests/e2e/setup/clinic-auth.setup.ts` passed again in `5.1s` after the production promotion, confirming that clinic auth bootstrap is healthy on the live deployment.
- 2026-03-31: Full referral workflow verification now passes on the live clinic target. `bunx playwright test tests/e2e/referrals.spec.ts --project=clinic` finished at `4 passed` after the production auth fix. Verified coverage:
  referral tab renders, empty state shows, validation feedback appears on empty submit, and the happy-path referral save completes successfully.
- 2026-04-05: Clinic workflow specs were hardened to use the real clinic host explicitly (`https://klinikputeri.iatrum.com`) and to stop relying on ambiguous `Triage` link text, sidebar collisions, or stale `/patients/new` assumptions. Check-in, consultation, queue, and triage specs now target patient-specific routes and API-backed waits.
- 2026-04-05: Focused rerun of `check-in + triage + consultation + queue` reached `13 passed, 2 failed`.
- 2026-04-05: Confirmed green in the focused clinic batch:
  - check-in page load/search/check-in flow
  - consultation form render/validation/happy path
  - queue page render
  - queue triage-to-consultation navigation
  - triage page reachability and form render
- 2026-04-05: Remaining red cases are both submit/progression behaviors on the live hosted clinic target:
  - `tests/e2e/triage.spec.ts` happy-path triage submit intermittently receives a non-OK `/api/triage` response in browser-driven verification, even though direct authenticated API reproduction can succeed
  - `tests/e2e/queue.spec.ts` post-consultation queue progression is still not proving the expected terminal queue state reliably in Playwright
- 2026-04-05: An isolated serialized rerun (`--workers=1`) hit another intermittent timeout in `tests/e2e/setup/clinic-auth.setup.ts`, so auth bootstrap was improved but still not fully deterministic under the old browser-form setup.
- 2026-04-05: Further isolation work moved `triage` and `queue` setup off the patient-registration UI and onto direct authenticated API setup so those suites only exercise the workflow they actually own.
- 2026-04-05: Vercel runtime logs confirmed the then-current production deployment emitted `POST /api/triage -> 500` during the failing focused reruns.
- 2026-04-05: Local app fix landed in `lib/fhir/triage-service.ts` to send full UCUM unit metadata for vitals observations (heart rate, respiratory rate, SpO2, weight, height, blood pressure, temperature).
- 2026-04-05: That triage-service fix has now been deployed to production (`https://ucc-k56f04mdx-hidayat0507s-projects.vercel.app`, aliased to `https://iatrum.com`).
- 2026-04-05: Clinic auth setup was also hardened in `tests/e2e/setup/clinic-auth.setup.ts` to create the session through same-origin `/api/auth/login` via Playwright `page.request` instead of relying on a flaky browser-form submit. Focused rerun of `triage + queue` now starts cleanly with clinic auth setup passing in `6.0s`.
- 2026-04-05: Post-deploy focused rerun of `tests/e2e/triage.spec.ts` + `tests/e2e/queue.spec.ts` finished at `6 passed, 2 failed`.
- 2026-04-05: The deploy removed the prior gross blocker: queue can now observe a triaged patient, so the old production `POST /api/triage -> 500` failure is no longer the dominant failure mode in focused verification.
- 2026-04-05: Two production workflow issues still remain:
  - browser-driven triage submit still receives a non-OK `/api/triage` response in `tests/e2e/triage.spec.ts`, even though direct authenticated API reproduction returns `200`
  - post-consultation queue progression still remains at `waiting` instead of advancing to `meds_and_bills` / `completed` in `tests/e2e/queue.spec.ts`

## Individual Spec Results (2026-03-30)

| Spec | Result | Passed | Failed | Notes |
|------|--------|--------|--------|-------|
| admin.spec.ts | partial | 5 | 1 | "clinic list" test: `getByRole("link", { name: "Manage" })` returns 0 and fallback `getByText(/no clinics found/i)` also absent — selector mismatch vs live UI |
| check-in.spec.ts | partial | 3 | 2 | (1) Search doesn't surface fresh test patient — known live issue; (2) `button[type="submit"]` strict-mode violation (2 "Register Patient" buttons on page) — ambiguous selector |
| clinic-login.spec.ts | pass | 7 | 0 | All login, error toast, redirect, dashboard, check-in page, and session-reload tests pass |
| consultation.spec.ts | fail | 0 | 3 | All tests fail: `/patients/{id}/consultation` returns 404 for fresh patients (known live issue); heading "new consultation" never found |
| credential-check.spec.ts | partial | 2 | 0 (5 skipped) | Landing page + login page pass; 5 Medplum tests skipped — `MEDPLUM_UI_URL`/`ADMIN_EMAIL`/`ADMIN_PASSWORD` not set locally (env guards, not failures; all 7 passed in CI run #12) |
| emr-auth.spec.ts | pass | 7 | 0 | All auth/access-control tests pass: unauthenticated redirects, login page, API auth enforcement, export secret enforcement |
| orders.spec.ts | pass | 6 | 0 | Billing & Documents page, search, Bill/MC modals, orders API auth all pass |
| patients.spec.ts | partial | 6 | 1 | List, nav, form validation, NRIC validation all pass; "happy path creates patient" fails — no redirect to `/patients/{id}` after form submit (known live issue) |
| queue.spec.ts | partial | 1 | 3 | Queue page renders pass; 3 workflow tests fail — cascade from live issues: triage 404 means patient never enters queue, consultation form never reachable |
| triage.spec.ts | partial | 1 | 2 | Triage link on patient profile exists (pass); triage form itself 404s for fresh patients — heading "triage assessment" and vitals fields never load (known live issue) |
| auth.setup.ts | n/a | — | — | Not a standalone runnable spec — no `testMatch` entry in `playwright.config.ts`; used only as a setup fixture via `tests/e2e/setup/` |

**Summary (2026-03-30 local run against klinikputeri.iatrum.com):**
- 3 specs fully pass: `clinic-login`, `emr-auth`, `orders` (20 tests, 0 failures)
- 4 specs partially pass: `admin`, `check-in`, `patients`, `queue`, `triage` (17 passed, 9 failed)
- 1 spec fully fails: `consultation` (0/3 — live 404 root cause)
- 1 spec env-skipped: `credential-check` (2/7 locally, 7/7 in CI with secrets)
- **Root cause of most failures:** `/patients/{id}/triage` and `/patients/{id}/consultation` return 404 for freshly-created patients on the live `klinikputeri.iatrum.com` deployment

**Summary (2026-03-31 local rerun against klinikputeri.iatrum.com):**
- `24 passed, 8 failed`
- major improvement from the 2026-03-30 rerun (`20 passed, 12 failed`)
- triage and consultation route availability is now proven in the E2E suite
- remaining blockers are patient discoverability in `/check-in`, queue progression after triage submit, and two strict-mode test assertions

**Best subsequent result (2026-03-31 after more fixes):**
- `28 passed, 4 failed`
- strict-mode failures were removed
- queue navigation improved and consultation/triage path coverage held
- persistent live blocker remained: fresh-patient discoverability in `/check-in`
- later reruns still showed hosted-environment instability on fresh patient creation/search, so production readiness is still not proven

**Latest focused result (2026-04-05 against klinikputeri.iatrum.com):**
- `13 passed, 2 failed` for `check-in + triage + consultation + queue`
- check-in discoverability is now proven in the focused suite
- consultation render, validation, and happy path are now proven in the focused suite
- remaining blockers are narrowed to:
  - live browser-driven triage submit instability
  - live queue-state progression after consultation completion

**Latest post-deploy verification (2026-04-05 against klinikputeri.iatrum.com):**
- production deploy succeeded for the triage-service fix
- `6 passed, 2 failed` for focused `triage + queue`
- clinic auth setup now passes through the API bootstrap path
- queue can now observe a triaged patient
- remaining blockers are:
  - browser-form triage submit still gets a non-OK `/api/triage` response
  - consultation completion still leaves queue state at `waiting`

## Next Actions

1. **[Blocker]** Debug the remaining browser-path `/api/triage` mismatch. Direct authenticated API calls now return `200`, but browser-driven triage submit still fails.
2. **[Blocker]** Fix consultation queue transition so completion advances status out of `waiting` to `meds_and_bills` / `completed`.
3. Rerun the broader clinic suite after the triage browser-path and queue-transition issues are fixed.
4. Fix admin "clinic list" selector: `getByRole("link", { name: "Manage" })` doesn't match live UI; also check if "no clinics found" fallback text is correct.
5. Keep AI-route logging limited to metadata.
6. Move test defaults away from production-like domains.
