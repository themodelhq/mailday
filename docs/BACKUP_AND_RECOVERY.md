# MailDay Production Backup & Recovery Runbook

This runbook covers the PostgreSQL database and attachment files for a Render deployment.

## What must be backed up
- PostgreSQL: users, mail, metadata, delivery queue/history, attachment metadata, and integration records.
- Persistent attachment disk: files stored under ATTACHMENTS_DIR (Render Blueprint mounts /var/data/mailday-attachments).
- Deployment configuration and secrets: keep a separate secure inventory of environment-variable names and values. Never place secrets in backups, source control, or this runbook.

## PostgreSQL backup
Run from a trusted machine with PostgreSQL client tools and the production connection string available in a protected environment variable:
```bash
export DATABASE_URL='(secure production connection string)'
pg_dump --format=custom --no-owner --no-acl --file="mailday-db-$(date -u +%Y%m%dT%H%M%SZ).dump" "$DATABASE_URL"
```
Verify the file exists and is non-empty. Store it encrypted, restrict access, and retain copies in a separate account/location from production. Do not paste connection strings into shell history or logs.

## Attachment backup
For Render, the persistent disk is mounted at /var/data/mailday-attachments. In the service shell:
```bash
tar -czf /tmp/mailday-attachments-$(date -u +%Y%m%dT%H%M%SZ).tar.gz -C /var/data/mailday-attachments .
```
Transfer the archive out of the service to protected storage using an approved secure method. A file left only on the service disk is not an independent backup.

## Restore test (never overwrite production during a drill)
1. Provision a separate empty PostgreSQL database.
2. Restore a recent dump into that test database:
```bash
pg_restore --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" mailday-db-YYYYMMDDTHHMMSSZ.dump
```
3. Restore the attachment archive to a separate test directory, not the production disk.
4. Deploy the matching application version to staging using the restored database and attachment directory.
5. Run `npx prisma migrate status`, readiness (/health/ready), login, mailbox listing, and attachment download checks.
6. Record restore date, backup timestamp, outcome, and missing files. Never run restore commands against production as part of a drill.

## Recovery procedure
- **Database:** restore to a new database first, validate, then plan a cutover by updating service database configuration. Preserve the damaged database for investigation where possible.
- **Attachments:** restore the archive to the persistent disk at the configured attachment directory. Confirm permissions and compare archive contents before cutover.
- **Application:** deploy the matching release; the service start command applies pending Prisma migrations. Review migration status and logs.
- **Verification:** confirm /health/ready, sign-in, message list/read, attachment list/download, and outbound delivery. Configure SMTP/IMAP/provider credentials and webhook secrets separately.
- **Communications:** record incident timeline, estimated data-loss window, recovery actions, validation, and follow-up.

## Backup cadence and responsibility
Set cadence based on recovery objectives. A reasonable initial target is daily database and attachment backups, more frequent if acceptable data loss requires it. Schedule and periodically test restore drills. Confirm actual retention and backup capabilities/limits of the chosen Render PostgreSQL plan in its dashboard; this runbook does not assume automatic backups or point-in-time recovery.
