#!/bin/sh
# Applies pending Prisma migrations, then starts the app. Runs on every
# container start (not at build time) because it needs the real runtime
# DATABASE_URL, which isn't available during `docker build`.
set -e

echo "==> Applying database migrations..."
if npx prisma migrate deploy; then
  echo "==> Migrations applied. Starting app..."
  exec node dist/main.js
fi

MIGRATE_STATUS=$?

echo ""
echo "==================================================================="
echo "  prisma migrate deploy failed (exit code ${MIGRATE_STATUS})."
echo ""
echo "  This is most often Prisma error P3009: a previous migration is"
echo "  recorded as started-but-never-finished (e.g. the process was"
echo "  killed mid-migration), so Prisma refuses to apply new ones until"
echo "  that's resolved. This requires a human decision, not an auto-fix,"
echo "  because the correct resolution depends on whether the stuck"
echo "  migration's changes actually made it into the database."
echo ""
echo "  To resolve, from this service's Shell tab:"
echo ""
echo "  1) Check migration state:"
echo "       npx prisma migrate status"
echo ""
echo "  2) Check whether the stuck migration's changes exist in the DB."               
echo "     psql is available in this shell — connect with:"
echo "       psql \"\$DATABASE_URL\""
echo "     then inspect the relevant table(s)/column(s)/type(s) for that"
echo "     migration, e.g.:"
echo "       \\d \"User\""
echo "       SELECT typname FROM pg_type WHERE typname = 'UserRole';"
echo ""
echo "  3) Tell Prisma the true outcome (pick ONE, based on step 2):"
echo "       npx prisma migrate resolve --rolled-back <migration_name>"
echo "       npx prisma migrate resolve --applied <migration_name>"
echo ""
echo "  4) Re-run:"
echo "       npx prisma migrate deploy"
echo ""
echo "  Docs: https://pris.ly/d/migrate-resolve"
echo "==================================================================="

exit "${MIGRATE_STATUS}"
