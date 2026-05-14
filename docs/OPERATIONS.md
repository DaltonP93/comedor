# Manual de Operaciones

## Checklist diario

- [ ] Verificar health: `GET /api/health/full`
- [ ] Revisar logs de error de la noche anterior
- [ ] Verificar que el backup se ejecutó correctamente
- [ ] Abrir caja antes de iniciar operaciones

---

## Procedimiento apertura de caja

1. Ir a **Cajas** en el menú lateral
2. Seleccionar la caja del turno
3. Clic en **Abrir Caja**
4. Ingresar el monto inicial en efectivo
5. Confirmar apertura

API: `POST /api/caja/:cajaId/abrir`

---

## Procedimiento cierre de caja

1. Ir a **Cajas** → seleccionar caja abierta
2. Clic en **Cerrar Caja**
3. Ingresar el monto declarado por forma de pago
4. El sistema calcula la diferencia automáticamente
5. Confirmar cierre

API: `POST /api/caja/aperturas/:id/cerrar`

---

## Problemas frecuentes

### La API no arranca

```bash
# Verificar logs
docker compose logs -f api

# Verificar DB
docker compose exec api npx prisma migrate status

# Migraciones pendientes
docker compose exec api npx prisma migrate deploy
```

### Stock negativo inesperado

Verificar configuración `STOCK_PERMITIR_NEGATIVO` en tabla `Configuracion`.

Si está en `false` y hay stock negativo, hacer ajuste:
```
POST /api/stock/ajuste { producto_id, cantidad: X, descripcion: "Corrección inventario" }
```

### Libreta bloqueada automáticamente

Las libretas se bloquean si `saldo_actual > 0` y vencieron (`dia_vencimiento`).

Para desbloquear manualmente:
```
PUT /api/libretas/:id { estado: 'ACTIVA' }
```

El sistema desbloquea automáticamente cuando el saldo llega a 0.

### Factura rechazada por SIFEN

1. Verificar `estado_sifen` en la factura
2. Revisar `DocumentoFiscalEvento` para ver el mensaje de error
3. Corregir datos si es necesario
4. Usar **Reenviar SIFEN** en la pantalla de detalle de factura

### Webhook de pago no procesado

1. Revisar tabla `webhook_eventos` para ver el payload recibido y el error
2. Si el estado es `ERROR`, el evento puede reprocesarse manualmente
3. Verificar que las firmas (BANCARD_PRIVATE_KEY, PAGOPAR_TOKEN_PRIVADO) sean correctas

---

## Health checks

| Endpoint | Descripción |
|----------|-------------|
| `/api/health` | Estado general |
| `/api/health/db` | Conexión PostgreSQL |
| `/api/health/redis` | Conexión Redis |
| `/api/health/full` | Todos los componentes |

---

## Logs

```bash
# Logs en tiempo real
docker compose logs -f api

# Últimas 100 líneas
docker compose logs --tail=100 api

# Filtrar errores
docker compose logs api 2>&1 | grep '"level":50'
```

Los logs son JSON estructurado con campos: `level`, `requestId`, `method`, `path`, `status`, `duration`.

---

## Backup y restauración

```bash
# Backup manual
BACKUP_DIR=/backups POSTGRES_PASSWORD=comedor123 ./scripts/backup-postgres.sh

# Listar backups disponibles
ls -lh /backups/comedor_*.sql.gz

# Restaurar (con confirmación)
POSTGRES_PASSWORD=comedor123 ./scripts/restore-postgres.sh /backups/comedor_20260514_020000.sql.gz
```
