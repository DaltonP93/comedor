# Base de Datos — Comedor

## Motor

PostgreSQL 16. ORM: Prisma 5. Timezone: `America/Asuncion` (UTC-4).

## Conexión

```
DATABASE_URL=postgresql://comedor:comedor123@localhost:5432/comedor
```

## Comandos

```bash
# Generar cliente Prisma tras cambios en schema.prisma
npm run db:generate

# Aplicar migraciones
cd packages/database
DATABASE_URL=... npx prisma migrate deploy

# Nueva migración (dev)
DATABASE_URL=... npx prisma migrate dev --name nombre_migracion

# Seed inicial
DATABASE_URL=... npx ts-node prisma/seed.ts

# GUI explorador
DATABASE_URL=... npx prisma studio

# Reset completo (borra todo)
DATABASE_URL=... npx prisma migrate reset
```

## Modelos principales

| Modelo | Descripción |
|---|---|
| `Usuario` | Operadores del sistema (admin, cajero, cocinero) |
| `Cliente` | Clientes del comedor — también usan el portal web |
| `Empresa` | Empresas con convenio de libretas grupales |
| `Producto` | Ítem del catálogo (almuerzo, bebida, insumo) |
| `Menu` | Menú publicado por fecha y sucursal |
| `MenuItem` | Producto + precio dentro de un menú |
| `Reserva` | Reserva de un cliente para un menú |
| `Venta` | Transacción de venta (contado o libreta) |
| `VentaItem` | Línea de una venta |
| `Pago` | Pago asociado a una venta o libreta |
| `Libreta` | Cuenta corriente del cliente |
| `LibretaMovimiento` | Ledger inmutable (CARGO / ABONO) |
| `StockMovimiento` | Kardex de movimientos de inventario |
| `StockActual` | Vista materializada de saldo actual por producto/sucursal |
| `Receta` | Ingredientes de un producto |
| `RecetaIngrediente` | Línea de receta (producto → cantidad de insumo) |
| `Factura` | Documento fiscal emitido |
| `DocumentoFiscal` | Integración SIFEN (CDC, XML, QR) |
| `CajaApertura` | Turno de caja con saldo inicial/final |
| `CajaMovimiento` | Retiros y ajustes dentro de un turno |
| `Notificacion` | Cola de notificaciones a clientes |
| `ClienteConsentimiento` | Preferencias de canales del cliente |
| `UserSession` | Sesiones activas con refresh token hasheado |
| `Auditoria` | Registro inmutable de cambios críticos |

## Convenciones

- **IDs**: `Int` autoincrement (no UUID)
- **Borrado lógico**: campo `activo: Boolean @default(true)` en todas las entidades principales
- **Dinero**: `BigInt` — Guaraníes enteros, sin decimales
- **Estados**: strings, no enums Prisma (permite evolución sin migración)
- **Timestamps**: `creado_en DateTime @default(now())`, `actualizado_en DateTime @updatedAt`

## Flujos críticos de datos

### Venta contado
```
Venta → VentaItem[] → StockMovimiento (SALIDA) → Pago
```

### Venta a libreta
```
Venta → VentaItem[] → StockMovimiento (SALIDA)
     → LibretaMovimiento (CARGO) → Libreta.saldo_actual += total
```

### Anulación de venta
```
Venta.estado = ANULADA
→ StockMovimiento inverso (referencia_tipo ANULACION_VENTA)
→ LibretaMovimiento (ABONO) si cargada_libreta = true
→ Libreta.saldo_actual -= total
```

### Reserva → Venta
```
Reserva.estado = ENTREGADA
→ Menu.cupo_reservado -= cantidad
→ Flujo de venta normal
```

## Índices importantes

El schema define índices en:
- `Venta.cliente_id`, `Venta.sucursal_id`, `Venta.estado`
- `StockMovimiento.producto_id`, `StockMovimiento.sucursal_id`
- `LibretaMovimiento.libreta_id`
- `Auditoria.usuario_id`, `Auditoria.modulo`
- `Notificacion.cliente_id`, `Notificacion.estado`

## Backup y restauración

Ver `scripts/backup-postgres.sh` y `scripts/restore-postgres.sh`.
Retención por defecto: 30 días. Ejecutar desde cron diariamente.
