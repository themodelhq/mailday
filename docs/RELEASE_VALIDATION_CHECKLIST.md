# MailDay Release Validation Checklist

This is the final pre-production checklist. A green build does not substitute for a live staging smoke test with real provider configuration.

## Automated verification
- [x] Latest GitHub Actions backend job passes (build + Jest suite) (run 44958054695).
- [x] Latest GitHub Actions frontend job passes (production build) (run 44958054695).
- [x] Dependency audit completed for backend and frontend (run 44958013397). Reports are successful artifacts, but findings are **release blockers** until remediated or formally accepted after risk review.

### Dependency audit snapshot (2026-11-21)
- Backend: **2 critical, 16 high, 18 moderate, 3 low** (39 total).
- Frontend: **1 critical, 9 high, 7 moderate** (17 total).
- Critical/high direct dependency findings include backend NestJS CLI/config/platform-express, mailparser, Nodemailer; frontend Next.js, eslint-config-next, and Zod.
- Critical/high transitive findings include Handlebars, proxy-addr, body-parser, Multer, Lodash, and PostCSS. The audit reports major-version fixes for several direct dependencies; do not apply broad major upgrades without compatibility testing.
- **Release status: NO-GO** until critical/high dependency findings are addressed or individually risk-reviewed with documented mitigation and owner approval.
- [ ] Latest GitHub Actions frontend job passes (Next.js production build).
- [ ] Dependency audit reports reviewed for both backend and frontend; unresolved critical/high findings have documented disposition.
- [ ] Deployment configuration regression tests pass.
- [ ] A staging restore drill has been completed using the backup runbook.

## Render deployment
- [ ] Render Blueprint reviewed and deployed in a staging environment first.
- [ ] Production secrets generated independently; JWT_SECRET and JWT_REFRESH_SECRET are distinct and each at least 32 characters.
- [ ] FRONTEND_URL contains only approved HTTPS frontend origins.
- [ ] DATABASE_URL and REDIS_URL point to provisioned production services.
- [ ] ATTACHMENTS_DIR is set to the mounted persistent disk path; disk capacity and growth alerts are monitored.
- [ ] Migrations complete successfully during service startup and migration status is clean.
- [ ] /health returns 200; /health/ready returns 200 and reports database and Redis healthy.
- [ ] Rollback plan documented. Database migrations are not automatically reversible; restore/cutover must be planned.

## Netlify deployment
- [ ] NEXT_PUBLIC_API_URL points to the deployed API.
- [ ] Production domain and HTTPS configured.
- [ ] Netlify Next.js plugin/build configuration verified against a production deploy.
- [ ] API CORS FRONTEND_URL exactly includes the production origin.

## Critical user journey smoke tests (staging)
1. Register a new account; verify password policy and authentication.
2. Log in; refresh token; log out; verify revoked session cannot be reused.
3. Open inbox; search; page through results; open/read a message.
4. Create/edit/delete a draft; send with SMTP configured and verify delivery lifecycle state.
5. Upload an attachment; verify clean scan result when scanner is configured, download it, then delete it.
6. Confirm attachment file persists after service restart/redeploy (persistent disk test).
7. Connect an IMAP account; validate credential test, sync, imported messages, and disconnect.
8. Exercise AI draft/reply/summarize only with provider key configured; verify disabled/unconfigured state otherwise.
9. Validate inbound webhook using provider test event, then duplicate event; verify idempotency.
10. Validate bounce webhook with a provider test event; verify bounce lifecycle and delivery status.
11. Test an admin account and confirm non-admin accounts cannot access admin APIs.
12. Confirm responsive UI on desktop and narrow mobile viewport.

## External service prerequisites and known limitations
- SMTP provider and verified sender/domain, SPF/DKIM/DMARC, rate/volume limits, and delivery monitoring.
- Inbound email provider, MX/routing setup, webhook URL, and INBOUND_WEBHOOK_TOKEN. Native inbound delivery is provider-dependent.
- Bounce provider integration and DELIVERY_BOUNCE_WEBHOOK_TOKEN.
- AI provider account/key and selected model (ZAI_API_KEY/ZAI_MODEL) if AI features are enabled.
- Persistent attachment storage provisioned and sized. ClamAV is optional; without CLAMAV_HOST, attachments are marked UNCHECKED, not virus-free.
- PostgreSQL backup retention/PITR capability confirmed for the selected provider plan; backup copies stored outside the production service.
- Redis durability/availability expectations understood; queue/worker behavior validated under restart.
- Secrets and provider credentials stored in the hosting provider's secret manager, not repository files.
- Monitoring/alerting for API errors, readiness failures, queue age, delivery failures/bounces, storage usage, and provider outages configured.
- Domain ownership, privacy policy, terms, support/contact process, and any required compliance review completed.

## Release decision
Release only after all automated checks are green, dependency findings are reviewed, critical staging journeys pass, backup restore has been tested, and external prerequisites are confirmed. Any unchecked item must be assigned, explicitly accepted as a launch limitation, or block release.
