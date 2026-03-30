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
   - Clinical workflow specs (11 files): not yet run in CI; do not sign off release until these pass
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
