#!/bin/bash
# Script de backup de PostgreSQL para sistema comedor
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_NAME="${POSTGRES_DB:-comedor}"
DB_USER="${POSTGRES_USER:-comedor}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/comedor_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Iniciando backup de $DB_NAME..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-password \
  --format=plain \
  --no-owner \
  --no-privileges | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup completado: $BACKUP_FILE ($SIZE)"

# Limpiar backups viejos
find "$BACKUP_DIR" -name "comedor_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Backups más viejos de $RETENTION_DAYS días eliminados"

# Listar backups disponibles
echo "[$(date)] Backups disponibles:"
ls -lh "$BACKUP_DIR"/comedor_*.sql.gz 2>/dev/null || echo "  Ninguno"
