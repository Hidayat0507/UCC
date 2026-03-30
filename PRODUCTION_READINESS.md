# Production Readiness

Last updated: 2026-03-30

## Status

- `bun run lint`: passes
- `bun run build`: passes
- Major admin auth regressions previously found were fixed
- Login response no longer returns the Medplum bearer token
- Clinic Playwright auth state mismatch was identified on 2026-03-30:
  setup wrote `tests/e2e/.auth/klinikputeri.json` while the clinic project/specs read `tests/e2e/.auth/clinic.json`

Current assessment:

- Build-ready
- Not yet fully production-ready for a healthcare deployment

## Launch Blockers

### 1. Full clinical workflow E2E is still pending

Files:

- `playwright.config.ts`
- `tests/e2e/**` (11 spec files: admin, check-in, clinic-login, consultation, emr-auth, orders, patients, queue, triage)
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

- `bun run lint` — passed 2026-03-30
- `bun run build` — passed 2026-03-30
- `credential-check.spec.ts` E2E — passed 2026-03-30 in GitHub Actions (run #12, 48s)
  - `drhidayat.com` landing page loads (status < 400, title matches UCC EMR)
  - EMR staff login page accessible (`https://apex-group.drhidayat.com/login`, email/password fields visible)
  - Medplum self-hosted UI loads at `https://app.31-97-70-30.sslip.io/signin`
  - Medplum admin login succeeds with production credentials
  - Medplum clinic user logins succeed for all seeded users

## Verification Progress

- 2026-03-30: Initial staging-targeted `bun run test:e2e` run exposed widespread clinic-flow failures.
- 2026-03-30: First pass separated stale selectors from runtime issues and updated the clinic/admin Playwright specs to match the current UI.
- 2026-03-30: Root cause found for a large portion of clinic failures: clinic auth setup persisted `tests/e2e/.auth/klinikputeri.json`, but the main Playwright config and several specs loaded `tests/e2e/.auth/clinic.json`, which was empty.
- 2026-03-30: Repo updated to use `tests/e2e/.auth/klinikputeri.json` consistently for clinic tests. Fresh E2E rerun pending.
- 2026-03-30: Additional staging verification mismatch found: clinic auth setup used `klinikputeri.drhidayat.com`, but the default clinic E2E target in `playwright.config.ts` and `package.json` was `apex-group.drhidayat.com`. Repo updated so default clinic verification now targets `klinikputeri.drhidayat.com`, matching the authenticated clinic fixture.
- 2026-03-30: Fresh `bun run test:e2e:clinic` rerun after auth-fixture and spec cleanup finished at `20 passed, 12 failed`.
- 2026-03-30: False negatives removed from clinic workflow specs: authenticated `/api/check-in`, `/api/triage`, and `/api/queue` auth assertions were dropped from the clinic project because auth coverage already exists in `tests/e2e/emr-auth.spec.ts`.
- 2026-03-30: Confirmed live runtime issues remain on `klinikputeri.drhidayat.com`: `/patients/{id}/triage` and `/patients/{id}/consultation` returned `404` in Playwright snapshots for freshly created patients.
- 2026-03-30: Confirmed live workflow issue remains in reception flow: `/check-in` search still showed `No patients yet. Start typing to search.` immediately after creating a fresh patient, so patient creation/search consistency is not yet proven.
- 2026-03-30: `/patients/new` is deployed and rendering, but the title is not exposed as a semantic heading in the live DOM; remaining patient-form title assertions are test-contract cleanup, not evidence that the page is missing.
- 2026-03-30: Targeted rerun of `tests/e2e/patients.spec.ts` finished at `6 passed, 1 failed`. The remaining patient failure exposed a stale test assumption: the old URL check incorrectly treated `/patients/new` as a successful patient-profile redirect. Fresh-patient create/profile landing is therefore still unproven and must remain a release blocker until verified against a real patient ID.
- 2026-03-30: `credential-check.spec.ts` passed in GitHub Actions (Site & Credential Check run #12, 48s). Verified: landing page reachable, EMR staff login page accessible, Medplum self-hosted UI loads, Medplum admin login succeeds, all seeded clinic user logins succeed. Old "E2E verification missing entirely" blocker is now partially resolved — credential check is done, full clinical workflow E2E remains.

## Next Actions

1. Run the 11 clinical workflow E2E specs in CI and resolve any failures
2. Fix the live `404` behavior on `/patients/{id}/triage` and `/patients/{id}/consultation`
3. Debug why newly created patients are not discoverable from `/check-in` search immediately after creation
4. Keep AI-route logging limited to metadata
5. Move test defaults away from production-like domains
