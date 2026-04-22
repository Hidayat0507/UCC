# Authentication — Reference & Rules

**Purpose of this file:** keep authentication in UCC simple, secure, and aligned with Medplum + Next.js 16 best practice. **If you are an AI or contributor touching auth, read this first.** Do not "improve" the design without checking these rules.

---

## Mental model (30 seconds)

- **Medplum** (`fhir.drhidayat.com`) is the real security guard — it stores users, passwords, roles.
- **Next.js server** is the middleman. It runs OAuth2 PKCE with Medplum, then hands the browser a cookie.
- **Browser cookie** (`medplum-session`) is the wristband. Browser flashes it on every request; server checks it.

Rule of thumb: **the cookie is the source of truth. Never put auth state anywhere else.**

---

## The seven essential pieces (do not remove)

1. **Login form** — `app/(routes)/login/page.tsx`
2. **Login API** — `app/api/auth/login/route.ts` (OAuth2 PKCE → sets cookies)
3. **Per-API-route auth helpers** — `lib/server/medplum-auth.ts` (`requireAuth`, `requireClinicAuth`, `requirePlatformAdmin`)
4. **Page-level redirect for logged-out users** — `app/layout.tsx`
5. **Admin portal role guard** — `app/(routes)/admin/layout.tsx` calls `requirePlatformAdminPage`
6. **Logout** — `app/(routes)/logout/page.tsx` + `DELETE /api/auth/medplum-session`
7. **Refresh-token rotation** — inside `getMedplumForRequest()` in `lib/server/medplum-auth.ts`

Remove any one of these and the app is either broken or unsafe.

---

## File inventory

### Server-side (the real security)

| File | Role |
|---|---|
| `app/api/auth/login/route.ts` | OAuth2 PKCE login, sets the 3 cookies |
| `app/api/auth/me/route.ts` | Returns current profile or 401 |
| `app/api/auth/medplum-session/route.ts` | Session read/write/delete |
| `lib/server/medplum-auth.ts` | **Brain.** Auth helpers + token refresh |
| `lib/server/route-helpers.ts` | `AuthError` / `ForbiddenError` → 401/403 mapper |
| `lib/server/cookie-constants.ts` | Cookie name constants |
| `lib/server/subdomain-host.ts` | Parse admin/clinic/apex from host |
| `lib/server/clinic-validation.ts` | Check that a clinic subdomain exists |

### Client-side (UX only, not security)

| File | Role |
|---|---|
| `lib/auth-medplum.tsx` | React context: `signIn`, `signOut`, `profile`, `isAdmin`, `clinicId` |
| `app/(routes)/login/page.tsx` | Login form |
| `app/(routes)/logout/page.tsx` | Logout trigger |

### Doorman

| File | Role |
|---|---|
| `app/layout.tsx` | Server Component that redirects to `/login` if session cookie missing on a protected path |
| `app/(routes)/admin/layout.tsx` | Server Component that calls `requirePlatformAdminPage` — redirects non-admins before any admin page renders |

### Config

| File | Role |
|---|---|
| `proxy.ts` | **Routing only, NOT security.** Rewrites subdomains, forwards `x-pathname` |
| `.env.local` / Vercel | `MEDPLUM_*`, `NEXT_PUBLIC_BASE_DOMAIN`, `COOKIE_DOMAIN` |
| `scripts/validate-env.ts` | Build fails if an auth env var is missing |

---

## The three cookies

| Cookie | Purpose | httpOnly? | Lifetime |
|---|---|---|---|
| `medplum-session` | Access-token wristband | Yes | 30 days |
| `medplum-refresh` | Refresh-token (renew the wristband) | Yes | 30 days |
| `medplum-clinic` | Active clinic id for subdomain UI | No (JS can read) | 30 days |

All three have `Secure`, `SameSite=Lax`, `Domain=.iatrum.com` (production).

---

## Non-negotiable rules

1. **Tokens live in httpOnly cookies.** Never in `localStorage`, `sessionStorage`, or a JS-readable cookie. XSS → instant token theft otherwise.
2. **Every protected API route checks auth server-side** via `requireAuth` / `requireClinicAuth` / `requirePlatformAdmin`. Layout redirects are UX only — the server route is the security boundary.
3. **Never use `proxy.ts` / `middleware.ts` as a security boundary.** Per Vercel post-CVE-2025-29927 guidance, middleware is for routing only. Auth checks belong in route handlers and Server Components.
4. **PKCE stays.** The login route runs OAuth2 authorization-code + PKCE. Do not "simplify" by skipping the code-challenge step.
5. **Refresh-token rotation is server-side only.** `getMedplumForRequest()` detects expired JWTs and refreshes transparently. The browser `MedplumClient` does not refresh tokens — do not hand it a refresh token.
6. **Cookies are the source of truth, not `MedplumClient.localStorage`.** Any change that "syncs" the browser token back to the server cookie is redundant — the server set it in the first place.
7. **The admin portal layout must call `requirePlatformAdminPage`.** `app/(routes)/admin/page.tsx` and its siblings fetch data with a Medplum **service account** (`getAdminMedplum`) — that client ignores the visitor's session, so admin pages render for anyone unless the layout blocks them. The session-cookie check in `app/layout.tsx` only stops logged-out visitors; a logged-in clinic user would otherwise see the admin portal. Keep the role check in the admin layout, and keep `export const dynamic = "force-dynamic"` on that layout so nothing can statically optimise around the guard.

---

## Things that LOOK simpler but are worse (do NOT do)

| Tempting "simplification" | Why it is worse |
|---|---|
| Move auth checks to `proxy.ts` | CVE-2025-29927 class of bugs; Vercel explicitly warns against this |
| Drop PKCE from the login flow | Opens OAuth2 code-interception attacks |
| Store token in `localStorage` | XSS steals it instantly; HIPAA risk |
| Add NextAuth.js / Auth.js / Clerk | You already have Medplum as IDP. Adding another auth lib = double auth to maintain |
| Rely only on the layout redirect, skip per-route auth | curl/fetch can hit `/api/patients` directly. Layout never runs for API routes |
| Merge `login/route.ts` and `medplum-session/route.ts` | They do genuinely different things (OAuth vs session state) |
| Skip refresh tokens | Users get logged out every hour — staff revolt |
| Add a client-side `<AuthGuard>` wrapper on every page | Server redirect already covers it; adds flash-of-content, more code |
| Put role checks in the React layer | Trivially bypassable via browser devtools. Roles must be enforced server-side |

---

## When to touch what

| Task | File to edit |
|---|---|
| Change login form UI | `app/(routes)/login/page.tsx` |
| Change login error messages | `classifyAuthError` in `lib/auth-medplum.tsx` |
| Add a new protected API route | Use `requireAuth` / `requireClinicAuth` on first line — do not roll your own |
| Add a new protected page | No change needed — layout gate covers it automatically |
| Add a new public page (e.g. marketing) | Add to `isPublicPath` list in `app/layout.tsx` |
| Rotate cookie name | `lib/server/cookie-constants.ts` only |
| Change session lifetime | `AUTH_SESSION_MAX_AGE_SECONDS` env var |
| Add a new role check | Extend helpers in `lib/server/medplum-auth.ts` — do not inline in routes |

---

## Auth flow diagrams

### Login

```
Browser                Next.js server                  Medplum
  |   POST /api/auth/login   |                           |
  | ------------------------>|                           |
  |                          |   POST /auth/login        |
  |                          | ------------------------->|
  |                          |   { code }                |
  |                          | <-------------------------|
  |                          |   POST /oauth2/token      |
  |                          | ------------------------->|
  |                          |   { access_token, refresh_token }
  |                          | <-------------------------|
  |   Set-Cookie x3          |                           |
  | <------------------------|                           |
  |   redirect /dashboard    |                           |
```

### Any subsequent request

```
Browser                 Next.js server                   Medplum
  |  GET /patients         |                               |
  |  (cookie attached)     |                               |
  | ---------------------> |                               |
  |                        |  requireClinicAuth()          |
  |                        |  validates cookie locally     |
  |                        |  (or refreshes if expired)    |
  |                        |                               |
  |                        |  FHIR call with token         |
  |                        | -----------------------------> |
  |                        | <----------------------------- |
  |  { data }              |                               |
  | <--------------------- |                               |
```

### Logged-out user hits a protected page

```
Browser                           Next.js server
  |  GET /dashboard                     |
  | ----------------------------------> |
  |                                     |  app/layout.tsx
  |                                     |  reads medplum-session cookie
  |                                     |  missing → redirect("/login")
  |  307 Location: /login               |
  | <---------------------------------- |
```

### Admin portal access control

```
Browser                         Next.js server                        Medplum
  |  GET admin.iatrum.com/           |                                     |
  |  (proxy rewrites → /admin)       |                                     |
  | -------------------------------> |                                     |
  |                                  |  app/layout.tsx                     |
  |                                  |  session cookie? no  → /login       |
  |                                  |  session cookie? yes → pass         |
  |                                  |                                     |
  |                                  |  app/(routes)/admin/layout.tsx      |
  |                                  |  requirePlatformAdminPage("/admin") |
  |                                  |   1. getMedplumForRequest()         |
  |                                  |      (throws if no cookie)          |
  |                                  |   2. GET /auth/me  ---------------> |
  |                                  |      membership.admin?              |
  |                                  |                       <-----------  |
  |                                  |   not admin → /login?error=admin_required
  |                                  |   admin     → render portal         |
```

---

## Sanity checklist before merging any auth change

- [ ] `bun run lint` passes
- [ ] `bun run build` passes
- [ ] Manual: log out → `/dashboard` redirects to `/login`
- [ ] Manual: log in → stays logged in across refreshes
- [ ] Manual: `iatrum.com/` (apex) → marketing page renders without login
- [ ] Manual: `admin.iatrum.com/` while logged out → redirects to `/login`
- [ ] Manual: `admin.iatrum.com/` while logged in as a non-admin clinic user → redirects to `/login?error=admin_required`
- [ ] Manual: `admin.iatrum.com/` while logged in as a platform admin → renders the admin portal
- [ ] Manual: clinic subdomain login still works
- [ ] No new files in `localStorage`/`sessionStorage` contain tokens (check browser devtools)
- [ ] No new `middleware.ts` or `proxy.ts` logic that gates auth

---

## Last reviewed

2026-04-22 — auth refactor that added the server-side page gate, the admin-portal role guard, and trimmed redundant client token sync (see `authentication` branch).

The design at that date is considered the minimum viable professional setup for a Medplum + Next.js 16 multi-clinic app. Resist the urge to refactor further unless a real requirement changes.
