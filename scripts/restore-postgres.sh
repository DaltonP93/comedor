#!/bin/bash
# Script de restauración de backup PostgreSQL para sistema comedor
set -e

BACKUP_FILE="$1"
DB_NAME="${POSTGRES_DB:-comedor}"
DB_USER="${POSTGRES_USER:-comedor}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Uso: $0 <archivo_backup.sql.gz>"
  echo ""
  echo "Backups disponibles:"
  ls -lh "${BACKUP_DIR:-/backups}"/comedor_*.sql.gz 2>/dev/null || echo "  Ninguno en ${BACKUP_DIR:-/backups}"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: archivo no encontrado: $BACKUP_FILE"
  exit 1
fi

echo "[$(date)] ADVERTENCIA: Esto sobrescribirá la base de datos '$DB_NAME'"
echo "[$(date)] Presione Ctrl+C en 5 segundos para cancelar..."
sleep 5

echo "[$(date)] Restaurando desde $BACKUP_FILE..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-password < <(gunzip -c "$BACKUP_FILE")

echo "[$(date)] Restauración completada exitosamente"
