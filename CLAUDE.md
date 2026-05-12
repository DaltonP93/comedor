# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Sistema de ventas, reservas, menú, stock, libreta y pagos para comedor en Paraguay. Moneda: Guaraníes (PYG, enteros sin decimales). El README.md contiene la especificación funcional completa con 35 secciones de detalle.

**Estado actual:** Fases 1–6 implementadas. Ver sección "Roadmap" abajo para detalle de cada fase.

**Demo:** `admin@comedor.com` / `admin123`

---

## Comandos

### Desarrollo local (sin Docker)

```bash
# Instalar dependencias (desde raíz del monorepo)
npm install

# Generar cliente Prisma (obligatorio tras cambios en schema.prisma)
npm run db:generate

# Aplicar migraciones a la base de datos
cd packages/database && DATABASE_URL=postgresql://comedor:comedor123@localhost:5432/comedor npx prisma migrate deploy

# Seed de datos iniciales
cd packages/database && DATABASE_URL=postgresql://comedor:comedor123@localhost:5432/comedor npx ts-node prisma/seed.ts

# Correr API y frontend en paralelo
npm run dev

# Solo el backend (puerto 3001)
npm run dev --workspace=apps/api

# Solo el frontend (puerto 5173 en dev)
npm run dev --workspace=apps/web-admin
```

### Docker (recomendado para probar)

```bash
# Levantar todo (postgres, redis, api, web-admin, nginx)
docker-compose up -d

# Primera vez: migrar y seedear dentro del contenedor
docker-compose exec api sh -c "npx prisma migrate deploy"
docker-compose exec api sh -c "npx ts-node ../../packages/database/prisma/seed.ts"

# Ver logs
docker-compose logs -f api
docker-compose logs -f web-admin

# Reconstruir imagen tras cambios
docker-compose build api && docker-compose up -d api
```

Acceso local: `http://localhost:3000` (frontend), `http://localhost:3001` (API), `http://localhost:3001/health` (health check).

### Base de datos

```bash
# Crear nueva migración tras modificar schema.prisma
cd packages/database && npx prisma migrate dev --name nombre_migracion

# Abrir Prisma Studio (GUI para explorar datos)
cd packages/database && DATABASE_URL=... npx prisma studio

# Resetear base de datos (borra todo y re-seedea)
cd packages/database && DATABASE_URL=... npx prisma migrate reset
```

### Build para producción

```bash
npm run build
```

---

## Arquitectura

### Monorepo (npm workspaces)

```
comedor/
├── apps/
│   ├── api/           # Express + TypeScript (puerto 3001)
│   ├── web-admin/     # React + Vite + Tailwind — panel admin (puerto 3000 prod / 5173 dev)
│   └── web-cliente/   # React + Vite + Tailwind — portal cliente (puerto 3002 prod / 5174 dev)
├── packages/
│   └── database/      # Prisma schema + seed
└── docker/            # nginx.conf, postgres init
```

**Scripts raíz adicionales:**
- `npm run dev:cliente` — inicia solo el portal del cliente

### Backend (`apps/api/`)

**Patrón de rutas:** Cada archivo en `src/routes/` es un Express Router autocontenido. Todos requieren `authenticate` middleware al inicio. Los permisos se verifican por ruta con `requirePermiso('MODULO:ACCION')`.

```typescript
// Patrón estándar de cada ruta
router.use(authenticate);
router.get('/', requirePermiso('VENTAS:VER'), async (req, res) => { ... });
router.post('/', requirePermiso('VENTAS:CREAR'), [validaciones, handleValidation], async (req, res) => { ... });
```

**Respuesta estándar de la API:**
```json
{ "success": true, "data": {...}, "message": "...", "meta": { "total": 0, "page": 1, "limit": 20, "totalPages": 0 } }
```

**Libs clave:**
- `src/lib/prisma.ts` — singleton del cliente Prisma
- `src/lib/jwt.ts` — `generateToken()`, `verifyToken()`, `generateRefreshToken()`
- `src/lib/audit.ts` — `registrarAuditoria({ usuarioId, modulo, accion, registroId, valorAnterior, valorNuevo, ip })`
- `src/middleware/auth.ts` — `authenticate` (JWT → `req.user`) y `requirePermiso(codigo)`
- `src/middleware/validate.ts` — `handleValidation` para express-validator

**Valores monetarios:** Todos los campos de dinero en la base de datos son `BigInt` (Guaraníes enteros). Al crear transacciones Prisma se usa `BigInt(valor)`. El JSON serializa BigInt como string; el frontend lo recibe así y lo convierte.

**Transacciones:** Las operaciones que afectan múltiples tablas (venta → stock + libreta + pago) usan `prisma.$transaction(async (tx) => { ... })`.

**Auditoría:** Llamar `registrarAuditoria()` después de cada mutación crítica (crear/anular venta, ajuste de stock, cambio de precio, publicar menú, etc.).

### Base de datos (`packages/database/prisma/schema.prisma`)

30 modelos. Los más importantes para el flujo central:

- `Venta` → `VentaItem[]` + `Pago[]` + `Factura?` + `LibretaMovimiento[]`
- `Reserva` → se convierte en `Venta` al entregar; libera `cupo_reservado` en `Menu` si se cancela
- `Libreta` → `LibretaMovimiento[]` (ledger inmutable: CARGO en ventas, ABONO en pagos)
- `StockMovimiento` — kardex por producto/sucursal; cantidades negativas = salida

**Estados de enums (strings, no enums Prisma):**
- `Menu.estado`: `BORRADOR` → `PUBLICADO` → `CERRADO` | `AGOTADO` | `CANCELADO`
- `Reserva.estado`: `PENDIENTE` → `CONFIRMADA` → `EN_PREPARACION` → `LISTA` → `ENTREGADA` | `CANCELADA_*`
- `Venta.estado`: `PENDIENTE` → `COMPLETADA` | `ANULADA`
- `Libreta.estado`: `ACTIVA` | `SUSPENDIDA` | `BLOQUEADA`
- `Caja.estado`: `ABIERTA` | `CERRADA`

### Frontend (`apps/web-admin/`)

**Auth:** `AuthContext.tsx` provee `{ usuario, token, login, logout }`. El token se guarda en `localStorage`. `src/api/client.ts` es un axios instance que inyecta `Authorization: Bearer <token>` en cada request y redirige a `/login` en 401.

**Todas las llamadas a la API** van por `src/api/endpoints.ts`, organizado en objetos por módulo: `clientesApi`, `ventasApi`, `menusApi`, etc.

**Utilidades globales (`src/lib/utils.ts`):**
- `formatGs(amount)` — formatea montos como `Gs. 45.000`
- `formatFecha(date)` — fecha en formato paraguayo `dd/mm/yyyy`
- `formatFechaHora(date)` — con hora
- `hoyISO()` — fecha de hoy como `YYYY-MM-DD`
- `getErrorMessage(error)` — extrae mensaje de errores axios

**Componentes UI reutilizables** en `src/components/UI/`: `Button`, `Input`, `Select`, `Modal`, `Table`, `Badge`, `Card`, `LoadingSpinner`, `Alert`, `Pagination`. Usarlos siempre antes de crear nuevos.

**Variables de entorno del frontend:**
- `VITE_API_URL` — base URL de la API (default: `http://localhost:3001/api`)

### Permisos

El sistema de permisos es `MODULO:ACCION`. Ejemplos: `VENTAS:VER`, `VENTAS:CREAR`, `VENTAS:EDITAR`, `MENU:PUBLICAR`, `LIBRETA:COBRAR`, `STOCK:ENTRADA`. El rol `SUPERADMIN` tiene todos los permisos. Los permisos por rol se definen en el seed y en la tabla `rol_permisos`.

### Flujo de venta (reglas de negocio críticas)

1. **Venta contado:** crea `Venta` + `VentaItem[]` + `StockMovimiento` (SALIDA) + `Pago`
2. **Venta a libreta:** valida `libreta.saldo_actual + total <= libreta.limite_credito` antes de crear; luego crea `LibretaMovimiento` (CARGO) y actualiza `libreta.saldo_actual`
3. **Anulación:** revierte `StockMovimiento` con cantidad inversa (referencia_tipo `ANULACION_VENTA`), también revierte movimientos de receta (`ANULACION_RECETA`), y revierte `LibretaMovimiento` con ABONO si `cargada_libreta = true`
4. **Reserva:** descuenta `menu.cupo_reservado += cantidad`; al cancelar, `menu.cupo_reservado -= cantidad`; al convertir en venta, llama al flujo de venta normal
5. **Recetas:** al vender un producto con receta activa, se crean `StockMovimiento` (SALIDA, referencia_tipo `RECETA_VENTA`) por cada ingrediente proporcional a la cantidad vendida
6. **Bloqueo automático de libreta:** al consultar `GET /libretas/:id`, si `estado=ACTIVA` y `saldo_actual > 0` y `hoy.día > dia_vencimiento`, se bloquea automáticamente y registra auditoría; al pagar y el saldo llega a 0, se desbloquea automáticamente

### Nuevos módulos (Fases 3–6)

- `src/routes/empresas.ts` — CRUD empresas/convenios; `GET /empresas/:id` incluye clientes y libretas agrupadas
- `src/routes/notificaciones.ts` — cola de notificaciones; `POST /notificaciones/envio-masivo` crea recordatorios para todos los clientes con saldo vencido
- `src/routes/pagos.ts` — webhooks en `/webhook/bancard` y `/webhook/pagopar` sin `authenticate` (llamados por pasarelas externas); `GET /pagos/conciliacion` agrupa por forma_pago
- `src/routes/facturas.ts` — numeración secuencial desde tabla `Configuracion` clave `FACTURA_ULTIMO_NUMERO`; `POST /facturas/:id/reenviar-sifen` es placeholder hasta configurar credenciales
- `src/lib/pdf.ts` — PDF estado de cuenta libreta con pdfkit
- `src/lib/facturaPdf.ts` — PDF factura fiscal con desglose IVA 5%/10%/exento

### Portal del cliente (`apps/web-cliente/`)

App React separada con diseño mobile-first, esquema de color teal. Token guardado como `cliente_token` en localStorage (distinto del `token` del admin). Rutas: `/login` → `/menu` → `/reservar?menu_id=X` → `/mis-reservas` → `/mi-libreta` → `/pagar`. Corre en puerto 5174 (dev) o 3002 (Docker).

---

## Roadmap de implementación (del README)

- **Fase 1** ✅ Núcleo operativo (usuarios/roles, clientes, productos, menús, reservas, ventas, libretas, stock, compras, reportes)
- **Fase 2** ✅ Recetas CRUD + descuento automático de ingredientes al vender + producción sugerida en cocina
- **Fase 3** ✅ PDF estado de cuenta, módulo Empresas con libretas por empresa, sistema de notificaciones con envío masivo, VentaDetalle con anulación, bloqueo/desbloqueo automático de libreta
- **Fase 4** ✅ Estructura completa de pagos: webhooks Bancard/Pagopar, POS manual, conciliación, confirmación/rechazo manual (conectar credenciales reales en .env)
- **Fase 5** ✅ Facturación: numeración secuencial, PDF fiscal con IVA 5%/10%/exento, anulación con nota de crédito, configuración tributaria, capa SIFEN lista (activar con SIFEN_HABILITADO=true en Configuracion)
- **Fase 6** ✅ Portal del cliente (`apps/web-cliente`): login, menú del día, reservar, mis reservas, mi libreta, pago online
- **Fase 7** 🔲 Predicción de demanda, app móvil nativa, integración con balanza (requiere hardware)

---

## Convenciones

- Todo el código, mensajes de error, labels y UI en **español**
- Identificadores paraguayos: RUC, CI, DNIT, Gs., cupo, libreta, vianda
- Los `id` en Prisma son `Int` autoincrement (no UUID)
- El campo `activo: Boolean` se usa para borrado lógico en todas las entidades principales
- Timezone: `America/Asuncion` (UTC-4)
