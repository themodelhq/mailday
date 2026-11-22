# MailDay Release Validation Checklist

This is the final pre-production checklist. A green build does not substitute for a live staging smoke test with real provider configuration.

## Automated verification
- [x] Backend Prisma generation, production build, and Jest tests pass in Security Remediation run 45005221782.
- [x] Frontend install and production build pass in Security Remediation run 45005221782.
- [x] Final backend npm audit: **0 vulnerabilities** (all severities).
- [x] Final frontend npm audit: **0 vulnerabilities** (all severities).
- [x] Audit JSON artifacts downloaded and reviewed; report retained for 30 days.
- [x] Deployment configuration regression tests previously passed in CI run 45004905037.
- [ ] A staging restore drill has been completed using the backup runbook.

### Historical dependency audit snapshot (2026-11-21)
Before remediation: backend **2 critical, 16 high, 18 moderate, 3 low** (39 total); frontend **1 critical, 9 high, 7 moderate** (17 total). These findings have now been cleared in the verified audit run above.

- **Release status: NO-GO** pending live staging smoke tests, restore drill, provider/infrastructure configuration, and final operational/legal review.

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
