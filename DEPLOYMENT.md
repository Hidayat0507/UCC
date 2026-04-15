# Deployment Runbook

This file is the operational source of truth for deploying and verifying UCC EMR.

Related audit:

- [`PRODUCTION_READINESS.md`](/Users/hidayat/Documents/Projects/UCC/PRODUCTION_READINESS.md)

## Current Release Status

- `bun run lint`: passes
- `bun run build`: passes
- Trust-boundary issue around middleware-set admin/clinic UI context cookies has been resolved in the repo
- The main remaining release gap is documented end-to-end verification on staging
- 2026-03-30 progress: clinic Playwright verification was partially invalid because clinic auth setup wrote `tests/e2e/.auth/klinikputeri.json` while the main clinic project/specs loaded `tests/e2e/.auth/clinic.json`; repo has been corrected and must be rerun before release sign-off
- 2026-03-30 progress: default clinic verification target was also misaligned with the authenticated fixture (`apex-group.drhidayat.com` vs `klinikputeri.drhidayat.com`); repo defaults now point at `klinikputeri.drhidayat.com` for clinic E2E runs
- 2026-03-30 progress: fresh `bun run test:e2e:clinic` rerun after spec cleanup finished at `20 passed, 12 failed`
- 2026-03-30 progress: remaining live blockers are concentrated in patient follow-on routes and workflow consistency, not broad session failure:
  `/patients/{id}/triage` and `/patients/{id}/consultation` returned `404` in the deployed clinic target for fresh patients, and `/check-in` search did not surface a newly created patient
- 2026-03-30 progress: targeted patient-spec rerun finished at `6 passed, 1 failed`; the remaining failure showed the old happy-path assertion was falsely accepting `/patients/new` as if it were a saved patient profile route
- 2026-03-30 progress: `credential-check.spec.ts` **passed in GitHub Actions** (Site & Credential Check run #12, 48s) — production endpoints, login pages, and all Medplum credentials confirmed reachable and valid in CI; 11 clinical workflow specs exist but have not yet run in CI
- 2026-03-31 progress: clinic helper bug fixed across workflow specs; several tests had been incorrectly accepting `/patients/new` as a successful saved-patient route, which cascaded into false patient IDs and false 404s on triage/consultation pages
- 2026-03-31 progress: fresh `bun run test:e2e:clinic` rerun after helper fixes finished at `24 passed, 8 failed`
- 2026-03-31 progress: triage and consultation route availability is now proven by the suite; the remaining blockers are narrower:
  `/check-in` search still does not surface fresh patients, triage submit is not progressing the queue flow as expected, and two failures are now strict-mode test assertions
- 2026-03-31 progress: one transient clinic-auth setup timeout occurred during rerun, but an immediate focused rerun of `tests/e2e/setup/clinic-auth.setup.ts` passed in `6.3s`
- 2026-03-31 progress: repo-side fixes were applied for clinic patient search and queue-status reads (`finished` encounters are now included when reading latest triage state)
- 2026-03-31 progress: best clinic rerun after those fixes reached `28 passed, 4 failed`
- 2026-03-31 progress: later hosted reruns remained unstable and regressed on fresh-patient creation/search (`24 passed, 6 failed` in one rerun), so release sign-off still cannot rely on build success alone
- 2026-03-31 progress: local verification commands were rerun after the latest changes and both passed:
  `bun run lint`, `bun run build`
- 2026-03-31 progress: referral workflow coverage was added in `tests/e2e/referrals.spec.ts` and included in the clinic Playwright project
- 2026-03-31 progress: targeted referral-spec verification against `klinikputeri.drhidayat.com` is currently blocked by intermittent clinic login/setup instability; when login succeeds, the deployed patient profile does expose the `Referral / MC` tab and empty referral state, but the run is not yet stable enough for release sign-off
- 2026-03-31 progress: live root cause for the clinic login instability was identified. Browser reproduction showed `/api/auth/login` succeeding, but the client auth bootstrap still triggered direct browser requests to `https://fhir.drhidayat.com/auth/me`, and those were blocked by CORS from the clinic origin. Repo mitigation is now in place: client auth restore/sign-in has been shifted to same-origin `/api/auth/me` and `/api/auth/medplum-session` instead of browser-side Medplum profile fetches. This needs deploy + rerun before sign-off.
- 2026-03-31 progress: immediate hosted retest after push still shows the old auth behavior on `klinikputeri.drhidayat.com` (`/api/auth/login` returns `accessToken` in-body, browser still calls `https://fhir.drhidayat.com/auth/me` directly, CORS still fails). Focused rerun of `tests/e2e/setup/clinic-auth.setup.ts` still times out on `/login`, so the hosted environment should be treated as not yet updated with the auth fix.
- 2026-03-31 progress: the auth mitigation was promoted to production successfully. Retest on `https://klinikputeri.drhidayat.com/login` now shows the same-origin auth bootstrap path working as intended: `/api/auth/login` -> `/api/auth/medplum-session` -> `/api/auth/me`, with no direct browser `fhir.drhidayat.com/auth/me` call and no CORS failure.
- 2026-03-31 progress: focused rerun of `tests/e2e/setup/clinic-auth.setup.ts` passed in `5.1s` after production promotion, so clinic auth setup is currently healthy on the live deployment.
- 2026-03-31 progress: `bunx playwright test tests/e2e/referrals.spec.ts --project=clinic` now passes cleanly on the live clinic target (`4 passed`). Referral workflow coverage is now verified end-to-end after the auth fix reached production.
- 2026-04-05 progress: clinic workflow specs were normalized to the real clinic host (`https://klinikputeri.drhidayat.com`) and stripped of the remaining broad/ambiguous route assumptions that were still sending some tests to the wrong clinic or to the sidebar `Triage System` link.
- 2026-04-05 progress: focused rerun of `check-in + triage + consultation + queue` reached `13 passed, 2 failed`.
- 2026-04-05 progress: check-in, consultation, referral workflow, queue-page render, and queue-to-consultation navigation are now verified on the live clinic target.
- 2026-04-05 progress: release-signoff blockers are now narrower:
  - triage happy-path submit is still not consistently clean in browser-driven E2E on the hosted clinic target
  - post-consultation queue progression is still not proving the expected terminal state reliably in Playwright
- 2026-04-05 progress: after isolating the `triage` and `queue` suites away from patient-registration UI setup, Vercel runtime logs confirmed the then-current production deployment returned `POST /api/triage -> 500` during the focused reruns.
- 2026-04-05 progress: repo-side mitigation for that failure was implemented in `lib/fhir/triage-service.ts` by sending fully-specified UCUM quantity metadata for vitals observations.
- 2026-04-05 progress: that mitigation has now been deployed to production (`https://ucc-k56f04mdx-hidayat0507s-projects.vercel.app`, aliased to `https://drhidayat.com`).
- 2026-04-05 progress: clinic auth setup was also hardened in `tests/e2e/setup/clinic-auth.setup.ts` to create the session via same-origin `/api/auth/login` with Playwright `page.request`, removing the flaky browser-form dependency from setup.
- 2026-04-05 progress: post-deploy focused rerun of `tests/e2e/triage.spec.ts` + `tests/e2e/queue.spec.ts` finished at `6 passed, 2 failed`. Clinic auth setup passed in `6.0s`, and queue verification can now observe a triaged patient.
- 2026-04-05 progress: the remaining live blockers are now:
  - browser-driven triage form submit still receives a non-OK `/api/triage` response even though direct authenticated API reproduction returns `200`
  - consultation completion still leaves queue status at `waiting` instead of progressing to `meds_and_bills` / `completed`

Before calling the system production-ready, check:

- [`PRODUCTION_READINESS.md`](/Users/hidayat/Documents/Projects/UCC/PRODUCTION_READINESS.md)

## Topology

- Frontend: Next.js app
- Hosting: Vercel
- FHIR backend: self-hosted Medplum
- Admin portal: `admin.<base-domain>`
- Clinic portals: `<clinic-subdomain>.<base-domain>`
- Browser auth: Medplum login from the frontend
- Server auth bridge: `medplum-session` cookie

### Vercel production branch

Production deployments are expected to track **`claude/condescending-kirch`** (not `main`), so pushes to that branch update the live site and domain aliases.

In Vercel: **Project → Settings → Git** (or **Production Branch**), set the production branch to **`claude/condescending-kirch`** and save. See [Using a custom production branch](https://vercel.com/docs/deployments/git#production-branch).

## Required Environment Variables

Validate the environment before building or promoting:

```bash
npm run validate-env
```

Required:

- `MEDPLUM_BASE_URL`
- `NEXT_PUBLIC_MEDPLUM_BASE_URL`
- `NEXT_PUBLIC_MEDPLUM_PROJECT_ID`
- `MEDPLUM_CLIENT_ID`
- `NEXT_PUBLIC_MEDPLUM_CLIENT_ID`
- `MEDPLUM_CLIENT_SECRET`
- `NEXT_PUBLIC_BASE_DOMAIN`

Important optional variables:

- `COOKIE_DOMAIN`
- `MEDPLUM_BULK_EXPORT_SECRET`
- `OPENROUTER_API_KEY`

## Production References

Production/self-hosted Medplum details live in:

- [`MEDPLUM_SELF_HOSTED_DETAILS.md`](/Users/hidayat/Documents/Projects/UCC/MEDPLUM_SELF_HOSTED_DETAILS.md)

Keep that file updated whenever:

- Medplum host changes
- Medplum OAuth client changes
- project ID changes
- documented admin or clinic credentials change

## Domain Contract

Expected routing model:

- landing page: `https://drhidayat.com`
- admin: `https://admin.drhidayat.com`
- clinics: `https://<clinic>.drhidayat.com`

Recommended env values:

```env
NEXT_PUBLIC_BASE_DOMAIN=drhidayat.com
COOKIE_DOMAIN=.drhidayat.com
```

Why this matters:

- `NEXT_PUBLIC_BASE_DOMAIN` is used by subdomain routing and login redirects
- `COOKIE_DOMAIN` allows auth cookies to work across admin and clinic subdomains

## Browser Auth And CORS

This app performs browser login directly against Medplum.
That means Medplum must allow the frontend origin.

Origins that must be allowed in Medplum:

- production frontend origin(s)
- admin subdomain
- clinic subdomains in use
- local dev origin such as `http://localhost:3000` if local browser login is expected

If CORS is wrong, valid credentials will still fail in the browser.

Typical symptom:

- browser console shows blocked request to `https://<medplum-host>/auth/login`
- UI shows generic sign-in failure

## Pre-Deployment Checklist

1. Run `npm run validate-env`
2. Run `npm run test:e2e`
   - Credential check (`credential-check.spec.ts`): **passed in CI 2026-03-30** (GitHub Actions run #12)
   - Clinical workflow specs local reruns on 2026-03-31:
     - improved rerun reached `28 passed, 4 failed`
     - later rerun regressed to `24 passed, 6 failed` due hosted fresh-patient instability
   - 2026-04-05 focused rerun of `check-in + triage + consultation + queue` improved to `13 passed, 2 failed`
   - 2026-04-05 production deploy succeeded for the triage-service fix
   - Post-deploy rerun of focused `triage + queue` reached `6 passed, 2 failed`
   - Referral workflow verification is complete on production (`4 passed`)
   - Do not sign off release until the remaining browser-path triage submit failure and consultation queue-transition failure are fixed
3. Confirm `MEDPLUM_BASE_URL` and `NEXT_PUBLIC_MEDPLUM_BASE_URL` point to the same intended Medplum instance
4. Confirm `NEXT_PUBLIC_BASE_DOMAIN` matches real DNS
5. Confirm `COOKIE_DOMAIN` matches the deployment strategy
6. Confirm Medplum CORS allows the frontend origin(s)
7. Confirm one admin credential works
8. Confirm one clinic credential works
9. Confirm `/api/health` returns `200`
10. Confirm `/api/health/deep` returns `200`

## Post-Deployment Verification

1. Open `https://drhidayat.com`
2. Open `https://admin.drhidayat.com/login`
3. Open one clinic login page such as `https://klinikputeri.drhidayat.com/login`
4. Verify admin login succeeds
5. Verify one clinic login succeeds
6. Verify `/api/health`
7. Verify `/api/health/deep`

## Operational Rules

When deployment assumptions change, update both:

- [`DEPLOYMENT.md`](/Users/hidayat/Documents/Projects/UCC/DEPLOYMENT.md)
- [`MEDPLUM_SELF_HOSTED_DETAILS.md`](/Users/hidayat/Documents/Projects/UCC/MEDPLUM_SELF_HOSTED_DETAILS.md)

That keeps the code, infra assumptions, and operator workflow aligned.
