#!/usr/bin/env bash
#
# Instalación de un solo comando (stack completo con Docker).
# Uso:  ./scripts/setup.sh   ó   npm run setup
#
# Hace: genera .env con secretos fuertes (si no existe) -> construye y levanta
# postgres, redis, api, web-admin, web-cliente y nginx -> aplica migraciones
# (automático en el arranque de la API) -> corre el seed inicial.
#
set -euo pipefail
cd "$(dirname "$0")/.."

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
err() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; }

# ── Requisitos ────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  err "Docker no está instalado. Instalá Docker y volvé a intentar."
  exit 1
fi
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  err "No se encontró 'docker compose' ni 'docker-compose'."
  exit 1
fi

# ── 1. Archivo .env con secretos fuertes ─────────────────────────────────────
gen_secret() { openssl rand -hex 32 2>/dev/null || head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 48; }

if [ ! -f .env ]; then
  log "Creando .env a partir de .env.example con secretos generados..."
  cp .env.example .env
  set_kv() { # set_kv CLAVE VALOR
    if grep -q "^$1=" .env; then
      # usar | como separador para no chocar con / de los secretos
      sed -i "s|^$1=.*|$1=$2|" .env
    else
      printf '%s=%s\n' "$1" "$2" >> .env
    fi
  }
  set_kv JWT_SECRET "$(gen_secret)"
  set_kv JWT_REFRESH_SECRET "$(gen_secret)"
  set_kv PORTAL_JWT_SECRET "$(gen_secret)"
  set_kv POSTGRES_PASSWORD "$(gen_secret)"
  set_kv REDIS_PASSWORD "$(gen_secret)"
  set_kv ADMIN_EMAIL "admin@comedor.com"
  set_kv ADMIN_PASSWORD "$(gen_secret | head -c 20)"
  log ".env creado. Guardá ADMIN_PASSWORD:"
  grep '^ADMIN_PASSWORD=' .env
else
  log ".env ya existe, se respeta el actual."
fi

# ── 2. Construir y levantar el stack ─────────────────────────────────────────
log "Construyendo y levantando contenedores (esto puede tardar la primera vez)..."
$DC up -d --build

# ── 3. Esperar a que la API esté sana (migraciones corren en su entrypoint) ──
log "Esperando a que la API esté disponible..."
ok=0
for i in $(seq 1 60); do
  if curl -fsS http://localhost:3001/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 3
done
if [ "$ok" != "1" ]; then
  err "La API no respondió a tiempo. Revisá los logs:  $DC logs api"
  exit 1
fi
log "API arriba y migraciones aplicadas."

# ── 4. Seed inicial (idempotente: usa upsert) ────────────────────────────────
log "Cargando datos iniciales (seed)..."
$DC exec -T api sh -c 'cd /app/packages/database && npx ts-node prisma/seed.ts'

log "¡Listo! Accesos:"
echo "   Panel admin:    http://localhost:3000"
echo "   Portal cliente: http://localhost:3002"
echo "   API:            http://localhost:3001/health"
echo "   Login admin:    ver ADMIN_EMAIL / ADMIN_PASSWORD en .env"
