#!/usr/bin/env bash
#
# Instalación local sin Docker. Requiere PostgreSQL y (opcional) Redis corriendo.
# Uso:  ./scripts/setup-local.sh   ó   npm run setup:local
#
# Hace: crea .env (si no existe) -> npm install -> genera cliente Prisma ->
# aplica migraciones -> corre el seed. Luego arrancá con `npm run dev`.
#
set -euo pipefail
cd "$(dirname "$0")/.."

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }

if [ ! -f .env ]; then
  log "Creando .env desde .env.example (ajustá DATABASE_URL / secretos si hace falta)..."
  cp .env.example .env
fi

# Cargar variables del .env para el resto del script
set -a; . ./.env; set +a
: "${DATABASE_URL:?Definí DATABASE_URL en .env}"

log "Instalando dependencias (npm install)..."
npm install

log "Generando cliente Prisma..."
npm run db:generate

log "Aplicando migraciones..."
( cd packages/database && npx prisma migrate deploy )

log "Cargando datos iniciales (seed)..."
npm run db:seed

log "¡Listo! Arrancá el entorno de desarrollo con:  npm run dev"
log "(portal del cliente:  npm run dev:cliente)"
