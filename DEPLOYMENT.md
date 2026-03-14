# UCC VPS deployment

This repository can run on a VPS with Medplum inside Docker.

## What runs in Docker

- `ucc-app`: this Next.js app
- `medplum-server`: self-hosted Medplum API
- `postgres`: Medplum database
- `redis`: Medplum cache / jobs

## Files added

- `Dockerfile`
- `.dockerignore`
- `docker-compose.vps.yml`
- `.env.docker.example`

## First-time setup

1. Copy `.env.docker.example` to `.env`.
2. Fill in the Medplum and Firebase credentials.
3. Start the stack:

```bash
docker compose --env-file .env -f docker-compose.vps.yml up -d --build
```

4. Check status:

```bash
docker compose --env-file .env -f docker-compose.vps.yml ps
docker compose --env-file .env -f docker-compose.vps.yml logs -f medplum-server
docker compose --env-file .env -f docker-compose.vps.yml logs -f ucc-app
```

## Important notes

- This app still requires Firebase credentials. Dockerizing Medplum does not remove the Firebase dependency in this codebase.
- `NEXT_PUBLIC_MEDPLUM_BASE_URL` should point to the public Medplum URL the browser can reach.
- `MEDPLUM_BASE_URL` inside `ucc-app` is set to the internal Docker service URL so server-side code can talk to Medplum directly.
- For a real VPS deployment, put Nginx or Caddy in front and terminate HTTPS there.
- You still need to create a Medplum client app and set `MEDPLUM_CLIENT_ID` / `MEDPLUM_CLIENT_SECRET`.
