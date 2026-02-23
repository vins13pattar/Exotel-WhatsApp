# Exotel WhatsApp Dockerized App

Open-source, dockerized reference implementation to manage Exotel WhatsApp Business APIs with a REST backend and admin UI.

## Features
- REST API for auth, credential management, messaging, templates, onboarding links, and webhooks.
- React admin UI for day-to-day operations (send tests, manage templates, view webhooks).
- Queue-based sending with BullMQ + Redis; Prometheus metrics and health endpoints.
- Docker-first: dev and prod compose files, multi-stage Dockerfiles for API and UI.

## Stack
- API: Node.js + TypeScript (Express), Prisma + PostgreSQL, Redis + BullMQ for queues
- UI: React + Vite single-page app
- Infra: Docker / docker-compose, optional Caddy reverse proxy

## Prerequisites
- Node.js 20+
- npm
- Docker and Docker Compose
- Access to Exotel WhatsApp Business API credentials (api_key, api_token, subdomain, sid)

## Quickstart (dev)
```bash
npm install
npm -w apps/api run prisma:generate
npm -w apps/api run prisma:migrate -- --name init
npm -w apps/api run prisma:seed
docker compose -f docker-compose.dev.yml up --build
```

Access:
- API at http://localhost:4000
- UI at http://localhost:5173
- Seed login: admin@example.com / changeme

## Configure environment
Copy `/Users/vinod/Projects/Open Source/Exotel-WhatsApp/apps/api/.env.example` to `.env` in the same folder and set:
- `DATABASE_URL` (e.g., `postgresql://postgres:postgres@db:5432/exotel_whatsapp`)
- `REDIS_URL`
- `JWT_SECRET`
- `EXOTEL_REGION` (e.g., `api.exotel.com` or `api.in.exotel.com`)

## Provision Exotel credentials
Use the UI (Credentials page) or call `POST /api/v1/credentials` with `label`, `apiKey`, `apiToken`, `subdomain`, `sid`, `region`. All messaging/template/onboarding calls use these credentials.

## Production (compose)
```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```
- API exposed on port 4000
- UI exposed on port 8080 via reverse proxy (Caddy)

## API Surface (v1)
- `POST /api/v1/auth/login` – email/password login
- `POST /api/v1/auth/refresh`
- `GET/POST /api/v1/credentials`
- `GET /api/v1/messages`, `GET /api/v1/messages/:id`, `POST /api/v1/messages` (single or bulk), `POST /api/v1/messages/:id/cancel`
- `GET /api/v1/templates` (local cache) or `GET /api/v1/templates?remote=true&status=&category=&language=&limit=&before=&after&credentialId=` for live Exotel list; `POST /api/v1/templates`; `PUT /api/v1/templates/:id`; `POST /api/v1/templates/upload-sample`
- `GET /api/v1/onboarding-links`, `POST /api/v1/onboarding-links`, `GET /api/v1/onboarding-links/validate?token=...`
- `POST /api/v1/webhooks/exotel`, `GET /api/v1/webhooks/logs`
- Health: `/healthz`, `/readyz`, metrics at `/metrics`
- OpenAPI: `/docs/openapi.yaml` (file at `/Users/vinod/Projects/Open Source/Exotel-WhatsApp/apps/api/openapi.yml`)

## Coverage vs Exotel docs
- Messaging API ([developer.exotel.com/api/whatsapp](https://developer.exotel.com/api/whatsapp)): supports text/media/template payloads, `custom_data`, `status_callback`, and bulk sends; status available via stored message record and webhook ingestion.
- Template Management API ([developer.exotel.com/api/whatsapp-template-management-apis](https://developer.exotel.com/api/whatsapp-template-management-apis)): supports list with filters, create, update, and sample media upload (`/api/v1/templates/upload-sample`).
- Onboarding API ([developer.exotel.com/api/whatsapp-onboarding-apis](https://developer.exotel.com/api/whatsapp-onboarding-apis)): supports link generation and token validation (`/api/v1/onboarding-links/validate`).

## Background Worker
- Queue `send-messages` (BullMQ) sends outbound messages via Exotel.
- Run with `node dist/worker.js` (already wired in compose).

## Directory layout
- `/Users/vinod/Projects/Open Source/Exotel-WhatsApp/apps/api` – Express API, Prisma schema, queue worker, Dockerfile
- `/Users/vinod/Projects/Open Source/Exotel-WhatsApp/apps/ui` – React + Vite admin UI, Dockerfile
- `/Users/vinod/Projects/Open Source/Exotel-WhatsApp/docker-compose.dev.yml` – dev stack
- `/Users/vinod/Projects/Open Source/Exotel-WhatsApp/docker-compose.prod.yml` – prod stack + Caddy
- `/Users/vinod/Projects/Open Source/Exotel-WhatsApp/deploy/Caddyfile` – reverse proxy config

## Testing
- Placeholder vitest setup. Add unit tests for Exotel client, auth, queue handlers, and integration tests with Testcontainers.

## Notes
- Template creation and onboarding link generation call Exotel; in local/dev they will fall back to dummy data if the API call fails.
- Redis is recommended; without it, queue/rate-limit features will not work.

## Contributing
- Fork and clone, then create a feature branch (`git checkout -b feature/xyz`).
- Keep changes lint-clean: `npm run lint`; add tests where possible (`npm run test`).
- Ensure Prisma schema changes include migrations and regenerate client.
- Submit PRs with a brief summary, testing notes, and screenshots for UI changes.
- Respect the seed credentials; avoid committing real Exotel secrets.

## License
MIT (see `package.json`).
