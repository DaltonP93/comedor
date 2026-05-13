#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL es requerida" >&2
  exit 1
fi

echo "Generando cliente Prisma..."
cd /app/packages/database
npx prisma generate --schema=./prisma/schema.prisma

if [ "$NODE_ENV" = "production" ]; then
  if ! find prisma/migrations -type f -name '*.sql' 2>/dev/null | grep -q .; then
    echo "ERROR: No existen migraciones Prisma. En producción no se permite db push." >&2
    exit 1
  fi
  echo "Aplicando migraciones (producción)..."
  npx prisma migrate deploy --schema=./prisma/schema.prisma
else
  if find prisma/migrations -type f -name '*.sql' 2>/dev/null | grep -q .; then
    echo "Aplicando migraciones (desarrollo)..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma
  else
    echo "Sin migraciones encontradas, usando db push (desarrollo)..."
    npx prisma db push --skip-generate --schema=./prisma/schema.prisma
  fi
fi

echo "Base de datos lista."
cd /app
exec "$@"
