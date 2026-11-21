# MailDay Production Readiness Roadmap

This roadmap establishes a finite completion plan. Stages are executed sequentially, committed to `main`, and verified by GitHub Actions before the next stage begins. If a stage's CI fails, the failure is repaired before proceeding.

## Verified completed stages

Stages 1–29 have been completed and verified. Recent security stages:
- Stage 25: logout-all session revocation
- Stage 26: session revocation regression tests
- Stage 27: JWT security validation tests
- Stage 28: refresh-token rotation and replay tests
- Stage 29: authentication rate-limit regression tests

## Remaining stages (12)

### Stage 30 — Roadmap baseline and repository-wide readiness inventory
Establish this finite roadmap, map existing functionality and known limitations, and define stage acceptance gates. This document is the baseline.

### Stage 31 — Mailbox API and authorization regression coverage
Audit and test message ownership/authorization across list, read, update, delete, thread, draft, send, retry, delivery status, and attachment routes. Ensure unauthorized cross-user access is rejected consistently.

### Stage 32 — Attachment security and lifecycle hardening
Review upload validation, MIME/content mismatches, path safety, storage cleanup, download headers, scanner-unavailable behavior, malware scan states, and resource limits. Add regression tests for the identified gaps.

### Stage 33 — Inbound mail and MIME resilience
Audit inbound webhook authentication, idempotency, routing, raw MIME size/parse boundaries, malformed payload handling, attachment processing, retries, and failure recovery. Add tests for edge cases.

### Stage 34 — IMAP integration reliability
Audit account connection, credential encryption, DNS pinning/SSRF protections, TLS, sync deduplication, timeouts, cancellation, and per-account failure isolation. Add tests and fix verified gaps.

### Stage 35 — Outbound delivery and bounce lifecycle
Audit queued/scheduled delivery, idempotency, retry policy, worker leases/locks, SMTP error classification, bounce-event authentication/deduplication, and delivery history. Add regression tests and fix gaps.

### Stage 36 — Mailbox UX and responsive behavior
Review the complete frontend on narrow/mobile and desktop layouts, mailbox navigation, message selection/read pane, compose/draft autosave, reply/reply-all/forward, scheduled send, attachments, settings, and loading/empty/error states. Fix concrete defects.

### Stage 37 — Search, pagination, and mailbox performance
Audit pagination boundaries, search fallback and Elasticsearch behavior, cache invalidation, query efficiency, large mailbox behavior, and thread retrieval. Add tests and address measurable problems.

### Stage 38 — AI and external integration safety
Audit AI endpoint validation, prompt/data boundaries, provider failures/timeouts, secret exposure, graceful disabled states, IMAP and SMTP integration configuration, and integration tests/mocks.

### Stage 39 — Monitoring, admin operations, and incident readiness
Audit health/readiness, structured logs and request IDs, delivery metrics/admin monitoring, alerts, sensitive-data redaction, and operational runbook completeness. Implement missing actionable safeguards.

### Stage 40 — Deployment, storage, backup, and recovery verification
Audit Netlify/Render configuration, environment validation, migration safety, persistent attachment storage, database backup and restore instructions, startup/shutdown, and deployment smoke checks. Add automated checks where feasible.

### Stage 41 — End-to-end release validation and final production checklist
Run the full CI suite, review dependency/security audit findings, validate critical user journeys with automated tests where feasible, review remaining external-provider prerequisites, update documentation, and publish a final readiness report. No known critical/high application defects may remain unresolved; external setup limitations must be clearly listed.

## Stage completion gate

For every stage:
1. Inspect current implementation and tests before changing code.
2. Make the smallest coherent set of changes for that stage.
3. Add/update regression tests.
4. Commit changes to `main`.
5. Verify GitHub Actions (backend and frontend) succeeds.
6. Report the stage, commit, CI link/result, and any limitations before continuing.

## Definition of completion

Stage 41 is the final stage in this roadmap. The project is considered ready for release only after its gate passes and the final report distinguishes verified application behavior from external services/configuration that the owner must provision (SMTP, inbound provider/MX routing, AI provider key, storage/scanning infrastructure, production domains and secrets).
