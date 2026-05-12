#!/bin/sh
set -e
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

cd /app/packages/database
npx prisma generate --schema=./prisma/schema.prisma

if [ "$(find prisma/migrations -type f -name '*.sql' 2>/dev/null | head -n 1)" ]; then
  npx prisma migrate deploy --schema=./prisma/schema.prisma
else
  echo "No SQL migrations in prisma/migrations; applying schema with prisma db push"
  npx prisma db push --skip-generate --schema=./prisma/schema.prisma
fi

exec "$@"
