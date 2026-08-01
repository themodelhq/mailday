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
  - **Real SMTP delivery** — Nodemailer sends outbound mail on `POST /messages` when `SMTP_*` is configured; runs in demo mode (local-only) otherwise.
  - **AI generation** — `POST /ai/generate` (modes: `draft`/`reply`/`summarize`/`rewrite`, with tone) via a **z.ai (Zhipu AI)** OpenAI-compatible Chat Completions API; returns HTTP 503 when `ZAI_API_KEY` is unset.
  - **Inbound mail (IMAP)** — `POST/GET/DELETE /mail/imap` to connect/list/remove per-user accounts, `POST /mail/imap/:id/sync` for on-demand import, plus a background poller that imports new messages into the user's inbox. IMAP passwords are encrypted at rest (AES-256-GCM, `VAULT_SECRET`).
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
