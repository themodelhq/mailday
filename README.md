# MailDay — Enterprise AI-Powered Email Platform (PWA)

> A production-ready **Progressive Web Application** email platform with original branding and a
> deployable, working core. The mail/webmail experience, authentication, and APIs are real and run.
> Advanced integrations (live SMTP/IMAP relays, Elasticsearch, S3, AI, passkeys) are wired as
> documented, env-gated integration points — see **Roadmap** below. This is a coherent foundation
> that deploys to **Netlify (frontend)** and **Render (backend)** today.

---

## What's actually implemented and working

- **Frontend** — Next.js 14 (App Router) + TypeScript + TailwindCSS + Framer Motion.
  - Marketing landing page (Hero, Features, Pricing, FAQ, Footer, theme switcher)
  - Auth pages (email/password register + login) with JWT + refresh tokens
  - Mail dashboard: sidebar, inbox, read view, compose, star/archive/delete
  - PWA: `manifest.webmanifest`, service worker with offline shell caching
  - State: Redux Toolkit (UI/session) + TanStack React Query (server state)
  - Forms: React Hook Form + Zod
- **Backend** — NestJS + TypeScript + Prisma + PostgreSQL + Redis.
  - `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
  - `GET /users/me`, `PATCH /users/me`
  - `GET /messages`, `GET /messages/:id`, `POST /messages`, `PATCH /messages/:id`, `DELETE /messages/:id`
  - **Hybrid search** — Elasticsearch when `ELASTICSEARCH_URL` is set (keyword `multi_match` + semantic kNN when embeddings are enabled); automatically degrades to Prisma `ILIKE` otherwise.
  - **SMTP integration** — Nodemailer can send outbound messages when `SMTP_*` is configured. The API now rejects sends when SMTP is unavailable or the provider rejects the message instead of falsely recording a successful Sent message.
  - **AI generation** — `POST /ai/generate` (modes: `draft`/`reply`/`summarize`/`rewrite`, with tone) via a **z.ai (Zhipu AI)** OpenAI-compatible Chat Completions API; returns HTTP 503 when `ZAI_API_KEY` is unset.
  - **External IMAP account import** — `POST/GET/DELETE /mail/imap` to connect/list/remove accounts, `POST /mail/imap/:id/sync` for on-demand import, plus a background poller. Account credentials are tested before storage and encrypted at rest (AES-256-GCM, `VAULT_SECRET`). This is not yet native Mailday inbound mail.
  - **Admin API** — `GET /admin/stats|users|messages`, `PATCH /admin/users/:id`, `DELETE /admin/users/:id`, protected by a role-aware `AdminGuard`.
  - RBAC-ready `JwtAuthGuard` + `AdminGuard`, DTO validation, global exception filter
  - Redis caching layer for message lists
  - `/health` endpoint for Render health checks
- **Frontend** — adds an **Admin console** (`/dashboard/admin`) with platform stats, user management (role/active toggles, delete) and recent-message moderation, gated by `role === 'ADMIN'`. The composer has **AI draft** generation (with tone), the reading pane has **AI reply** and **Summarize**, and **Settings** lets users connect **IMAP accounts** and sync them on demand (all AI features gate on the backend key).
- **Deployment** — `netlify.toml` + `render.yaml` + Dockerfiles + `docker-compose.yml` + GitHub Actions CI.

## Repository layout

```
mailday/
  frontend/      Next.js PWA (deploys to Netlify)
  backend/       NestJS API (deploys to Render)
  docker-compose.yml
  netlify.toml
  render.yaml
  .github/workflows/ci.yml
```

---

## Local development (Docker)

```bash
cp backend/.env.example backend/.env
docker compose up --build
# Frontend: http://localhost:3000   Backend: http://localhost:4000
```

Without Docker, run each separately:

```bash
# Backend
cd backend
npm install
npx prisma generate && npx prisma migrate dev
npm run start:dev        # http://localhost:4000

# Frontend (new shell)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
npm run dev              # http://localhost:3000
```

Seed demo + admin accounts (after the DB exists):

```bash
cd backend
npm run seed
# demo user:     demo@mailday.app / demo1234   (role USER)
# admin user:    admin@mailday.app / demo1234  (role ADMIN)
```

---

## Deploy to Netlify (frontend)

1. Connect the repo and set **Base directory** to `frontend`.
2. Build command: `npm run build`. Publish directory: `.next`.
3. Add env var `NEXT_PUBLIC_API_URL` = your Render backend URL.
4. `netlify.toml` already encodes these settings.

## Deploy to Render (backend)

1. Create a new **Web Service** from the repo, Root Directory `backend`.
2. Runtime: Node, Build: `npm install && npx prisma generate && npx prisma migrate deploy`, Start: `npm run start:prod`.
3. Add a **PostgreSQL** and **Redis** instance; map env vars: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`.
4. `render.yaml` (blueprint) provisions all of this automatically.

---

## Environment variables

See `backend/.env.example`. Key vars:

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Access-token signing key |
| `JWT_REFRESH_SECRET` | Refresh-token signing key |
| `FRONTEND_URL` | CORS allow-origin for the Netlify app |
| `PORT` | Backend port (Render sets this) |
| `ELASTICSEARCH_URL` | Enables Elasticsearch hybrid search (omit for Prisma `ILIKE`) |
| `EMBEDDINGS_ENABLED` / `ZAI_API_KEY` | Enables semantic (kNN) search AND AI draft/reply/summarize generation (via z.ai) |
| `EMBEDDING_DIMS` / `EMBEDDING_MODEL` | Vector dims (default 2048 for z.ai `embedding-3`) and embedding model |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Real outbound email (omit for demo mode) |
| `MAIL_FROM` | From address for sent mail |
| `ZAI_BASE_URL` / `ZAI_MODEL` | z.ai Chat Completions endpoint (default `https://api.z.ai/v1/chat/completions`) and model (default `glm-4-flash`) |
| `VAULT_SECRET` | Secret used to AES-encrypt stored IMAP passwords (use a strong 32-byte-grade value) |
| `IMAP_HOST` / `IMAP_PORT` / `IMAP_USER` / `IMAP_PASS` / `IMAP_SECURE` | Optional global demo IMAP account |
| `IMAP_POLL_SECONDS` | Poller interval in seconds (default 60) |

---

## Roadmap / integration points (not yet "no-placeholder" complete)

These remain stubbed behind env flags with documented interfaces, because they require external
infrastructure, paid keys, or running mail servers. **Everything below is honestly marked** — no fake "done" modules:

- **S3-compatible storage** — attachments use local/DB storage now; `StorageService` interface is ready.
- **Passkeys / WebAuthn & OAuth** — strategy interfaces included; providers require client IDs/secrets.
- **Admin analytics dashboards, billing, webhooks** — stats/users/messages endpoints exist; rich charts,
  billing and webhooks are not in this MVP.

Everything else in the spec (auth, mailbox CRUD, search, AI draft/reply/summarize, SMTP send, IMAP
receive, caching, PWA, admin console, deployment) is implemented and runs. This is a deliberate, honest
cut: a runnable product now, with clearly marked seams for the remaining enterprise features.

## License

MIT.

## Outbound delivery queue

Outbound messages are now persisted before delivery. When SMTP is configured, sending creates a message in `QUEUED` state and an `OutboundDelivery` record. A background worker polls the database, claims work using Redis locks, and delivers via SMTP. It records provider message IDs and transitions to `SENT`, `RETRYING`, or `FAILED`; retry delays use exponential backoff (capped at one hour), with eight attempts by default. Abandoned processing records are recovered after a three-minute lease.

Delivery status is available to the authenticated message owner at `GET /api/messages/:id/delivery`. Configure `SMTP_HOST` and related `SMTP_*` variables before sending. Worker settings: `OUTBOUND_WORKER_ENABLED=true` and `OUTBOUND_WORKER_POLL_MS=5000`.

**Operational note:** SMTP acceptance is not proof that the recipient's mailbox received the email. Bounce/webhook ingestion and provider-specific delivery events are not yet implemented. The queue also cannot guarantee exactly-once delivery if an SMTP server accepts a message and the database update fails immediately afterward; this is a distributed-systems edge case that can result in a retry duplicate.

### Native inbound webhook (Phase 3 foundation)

Mailday now exposes an authenticated inbound gateway endpoint: `POST /api/mail/inbound/webhook`. Configure `INBOUND_WEBHOOK_TOKEN` (Render Blueprint generates one) and have your inbound-email provider post a JSON payload with header `X-Mailday-Inbound-Token`. The endpoint accepts either `rawMime` (RFC 822/MIME text) or parsed fields such as `provider`, `messageId`, `from`, `to`, `subject`, `text`, and `html`. Raw MIME payloads are limited to 5 MB at the service layer.

The receiver parses MIME, routes to active users by their registered email address, creates inbox messages, records inbound receipts for idempotency, retries previously failed receipt processing on duplicate delivery, and invalidates mailbox caches. Unroutable recipients are reported rather than silently dropped. Search indexing failures do not fail receipt processing.

Example:

```bash
curl -X POST https://YOUR-MAILDAY-API/api/mail/inbound/webhook \\
  -H 'Content-Type: application/json' \\
  -H 'X-Mailday-Inbound-Token: YOUR_INBOUND_WEBHOOK_TOKEN' \\
  -d '{"provider":"provider-name","messageId":"provider-id-123","from":"sender@example.com","to":"user@example.com","subject":"Hello","text":"Message body"}'
```

**Current limitations:** this is a provider-neutral webhook receiver, not an MX server. DNS/MX records and an inbound email provider must be configured externally. Native Mailday addresses and domain routing are not yet provisioned. MIME attachments are extracted and persisted to the configured attachment disk, with metadata linked to each inbound message. Inbound attachment bytes are capped at 5 MB total per webhook payload. Malware scanning is not yet enabled, and HTML email sanitization remains pending.


## Phase 4 — mailbox lifecycle foundation

Phase 4 adds CC/BCC recipient fields persisted with messages and passed to Nodemailer, explicit draft creation from the composer, message thread identifiers and reply metadata, authenticated thread retrieval (`GET /api/messages/thread/:threadId`), and direct reply compose. New outbound messages receive a thread identifier; replies carry `threadId` and `inReplyTo`. This lifecycle foundation includes draft editing and autosave, reply-all/forward, scheduled sending, signatures, and thread display.

### Phase 4 mailbox features\n\n- Drafts can be edited, autosaved, and sent from the Drafts mailbox.\n- Reply All and Forward compose flows are available.\n- Threaded messages are displayed together where thread metadata is present.\n- Outbound mail can be scheduled using a future local date/time; the delivery worker waits until the scheduled timestamp.\n- Users can configure a plain-text email signature in Settings; it is appended to outgoing messages when not already present.
- Attachments can be uploaded to drafts, downloaded, removed, and included in outbound SMTP delivery. Upload limit is 20 MB per file. Storage is configurable via `ATTACHMENTS_DIR`; Render Blueprint configures a persistent disk.\n

### Inbound attachment handling

For inbound webhook messages containing MIME attachments, Mailday extracts the attachment content, stores it under a random UUID filename in the configured `ATTACHMENTS_DIR`, and records its original filename, MIME type, size, and message relation in PostgreSQL. Attachments are accessible through the same authenticated attachment listing/download endpoints as outbound attachments. The inbound webhook rejects attachment payloads totaling more than 5 MB. ClamAV scanning is supported when `CLAMAV_HOST` is configured. Infected attachments are rejected and cannot be downloaded. If ClamAV is not configured, attachments are stored with scan status `UNCHECKED`; they remain unscanned and must be treated as untrusted.


### Attachment scanning

Mailday supports ClamAV's TCP `INSTREAM` protocol. Configure `CLAMAV_HOST`, `CLAMAV_PORT` (default 3310), and `CLAMAV_TIMEOUT_MS` (default 10000) to connect to a ClamAV daemon. Uploads and inbound MIME attachments are scanned before persistence. Detected malware is rejected. When no scanner host is configured, attachments are explicitly marked `UNCHECKED`; this is not equivalent to a clean scan. Configure a private network connection to ClamAV and do not expose the daemon publicly.
