# MailDay Production Operations Runbook

This runbook covers deployment checks, PostgreSQL backup/recovery, attachment persistence, health checks, and incident response.

## Health endpoints

- `GET /health`: liveness. Confirms the API process is responding.
- `GET /health/ready`: readiness. Confirms PostgreSQL and Redis are reachable. Returns HTTP 503 when a required dependency is unavailable.

Render's health check is configured to use `/health/ready`.

## Pre-deployment checklist

1. Confirm CI is green for the commit being deployed.
2. Review Prisma migrations for destructive changes and ensure a backup exists before applying them.
3. Confirm production environment variables are configured in Render:
   - `DATABASE_URL`, `REDIS_URL`
   - `JWT_SECRET`, `JWT_REFRESH_SECRET`
   - `FRONTEND_URL`
   - `VAULT_SECRET` (required for encrypted IMAP credentials)
   - SMTP and inbound webhook credentials only if those integrations are enabled.
4. Confirm the frontend's `NEXT_PUBLIC_API_URL` points to the production API.
5. After deploy, verify `/health` and `/health/ready` return HTTP 200.
6. Send a test message only after SMTP is configured and verified.

## PostgreSQL backup

Before risky schema changes or maintenance, create a logical backup using the production database connection string in a secure environment:

```bash
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > mailday-$(date -u +%Y%m%dT%H%M%SZ).dump
```

Store backups in a separate, access-controlled storage location—not in the application repository or the same database service.

A backup is not verified until its file is non-empty and a restore has been tested against a separate temporary database.

## Restore verification

```bash
createdb mailday_restore_test
pg_restore --dbname=mailday_restore_test --no-owner --no-privileges mailday-backup.dump
```

After restoring, inspect schema and sample record counts, and run the application against the restored database in a non-production environment. Never restore over production without a reviewed recovery plan.

## Attachments

MailDay stores attachment files in `ATTACHMENTS_DIR`. In the Render Blueprint this points to the persistent disk mounted at `/var/data/mailday-attachments`.

Database backups alone do not back up attachment bytes. Back up the persistent disk or copy the attachment directory to separate durable storage, and periodically test recovering both the database metadata and corresponding files.

## Incident triage

1. Check `/health` to distinguish process availability from dependency readiness.
2. Check `/health/ready` and its dependency details.
3. Inspect Render service logs for API, Prisma, Redis, SMTP, inbound, and outbound-worker errors.
4. In the admin delivery monitoring page, review queued/retrying/processing counts and recent failures.
5. Avoid repeatedly retrying permanent SMTP errors; fix provider credentials, sender policy, or recipient problems first.
6. Preserve logs and timestamps when escalating an incident.

## Recovery notes

- Redis is used for caching/locks; do not treat it as durable application data.
- PostgreSQL is the authoritative application data store.
- Attachment storage must be recovered alongside the database.
- Keep `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `VAULT_SECRET` backed up securely. Rotating them may invalidate sessions or make stored encrypted credentials unreadable.
- For a failed Prisma migration, use `prisma migrate status` and inspect actual database state before resolving it as applied or rolled back. Never blindly mark a migration resolved.

## Request observability

Each HTTP request receives a server-generated `X-Request-ID` response header. The API emits a JSON-formatted log entry on response completion with request ID, method, path, status code, and elapsed milliseconds. Query strings are intentionally excluded to avoid logging tokens or other sensitive query parameters. Use the request ID to correlate a client report with Render logs.

## Dependency maintenance

Dependabot is configured to check backend, frontend, and GitHub Actions dependencies weekly and open grouped minor/patch update pull requests. Major updates are kept separate for review. Dependency update pull requests must pass the normal CI build and tests before merging. Do not apply broad `npm audit fix --force` updates without reviewing breaking changes and the dependency tree.
