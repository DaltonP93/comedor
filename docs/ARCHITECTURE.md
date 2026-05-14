# Arquitectura del Sistema

## Resumen

Sistema de gestión para comedor en Paraguay. Monorepo con backend Express/TypeScript, dos frontends React y base de datos PostgreSQL. Moneda: Guaraníes (PYG), enteros sin decimales.

---

## Estructura del monorepo

```
comedor/
├── apps/
│   ├── api/              # Express + TypeScript — puerto 3001
│   ├── web-admin/        # React + Vite + Tailwind — panel admin, puerto 3000 (prod) / 5173 (dev)
│   └── web-cliente/      # React + Vite + Tailwind — portal cliente, puerto 3002 (prod) / 5174 (dev)
├── packages/
│   └── database/         # Prisma schema + seed
├── docker/               # nginx.conf, postgres init.sql
├── docker-compose.yml    # entorno de desarrollo/prueba
└── docker-compose.prod.yml  # entorno de producción
```

Gestión de dependencias: **npm workspaces**. Los scripts de raíz coordinan todos los paquetes:

```bash
npm run dev          # API + web-admin en paralelo
npm run dev:cliente  # solo portal cliente
npm run build        # build de los tres apps
npm test             # tests de apps/api
```

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 20, Express 4, TypeScript |
| ORM | Prisma 5 (cliente generado en `packages/database`) |
| Base de datos | PostgreSQL 16 |
| Cache / sesiones | Redis 7 |
| Frontend admin | React 18, Vite, Tailwind CSS, Axios |
| Frontend cliente | React 18, Vite, Tailwind CSS (tema teal, mobile-first) |
| Autenticación | JWT (access 8 h + refresh 7 d) + tabla `user_sessions` |
| PDF | pdfkit (estado de cuenta, facturas fiscales) |
| Tests | Vitest (sin DB, mocks completos) |
| CI/CD | GitHub Actions |
| Contenedores | Docker + docker-compose |
| Proxy inverso | nginx |

---

## Flujo de autenticación

```
Cliente → POST /api/auth/login
          ↓
    validateCredentials (bcrypt)
          ↓
    generateToken()       → JWT 8 h  (payload: userId, email, rolNombre, sucursalId)
    generateRefreshToken() → JWT 7 d
          ↓
    UserSession (hash del refresh token, IP, user-agent, expires_at)
          ↓
    Respuesta: { access_token, refresh_token }
```

**Renovación:**
```
POST /api/auth/refresh  { refresh_token }
  → verifica UserSession (no revocada, no expirada)
  → genera nuevo access_token
  → rota el refresh_token (invalida el anterior en UserSession)
```

**Headers requeridos en cada petición autenticada:**
```
Authorization: Bearer <access_token>
```

El middleware `authenticate` verifica el token, carga el usuario con sus permisos y los coloca en `req.user`.

---

## Cadena de middleware

El orden en `apps/api/src/index.ts`:

```
requestId       → asigna UUID a cada request (header x-request-id)
helmet          → cabeceras de seguridad HTTP
cors            → orígenes permitidos (CORS_ORIGIN env)
morgan          → logging HTTP combinado
express.json    → body parsing (límite 10 mb)
── rutas ──
    authenticate         → valida JWT, inyecta req.user
    requirePermiso(code) → verifica que req.user.permisos incluye el código
    handleValidation     → valida express-validator, responde 422 si hay errores
errorHandler    → maneja AppError y errores inesperados
404 handler     → rutas no encontradas
```

Rate limiting se aplica en las rutas de autenticación mediante `middleware/rateLimit.ts` (basado en Redis).

---

## Capa de servicios

Los servicios encapsulan la lógica de negocio compleja y son usados por las rutas.

### `StockService` (`src/services/StockService.ts`)

- `getStockActual(productoId, sucursalId)` — consulta `stock_actual`
- `validarDisponibilidad(items, sucursalId)` — verifica stock antes de vender; respeta `STOCK_PERMITIR_NEGATIVO`
- Costo promedio ponderado al recibir compras

### `LibretaService` (`src/services/LibretaService.ts`)

- `obtenerLibretaActiva(clienteId)` — lanza error si no existe o está bloqueada
- `validarCredito(clienteId, monto)` — verifica `saldo_actual + monto <= limite_credito`
- `cargarConsumo(tx, ...)` — crea `LibretaMovimiento` (CARGO) dentro de una transacción
- Bloqueo automático: al consultar `GET /libretas/:id`, si `estado=ACTIVA`, `saldo_actual > 0` y día actual supera `dia_vencimiento`, bloquea y registra auditoría
- Desbloqueo automático al llegar el saldo a 0

### `SecuenciaService` (`src/lib/fiscal/SecuenciaService.ts`)

- `obtenerSiguienteNumero(tx, establecimiento, puntoExpedicion, tipoDocumento)` — `UPDATE ... RETURNING` atómico dentro de transacción Prisma; no usa SELECT FOR UPDATE explícito

### Proveedores de pago (`src/lib/payment/`)

- `PaymentProvider` — interfaz común: `iniciarPago()`, `procesarWebhook()`
- `BancardProvider` — firma MD5 para nueva cobro, verificación SHA256 para webhook; modo sandbox automático si no hay claves
- `PagoparProvider` — hash SHA1 para crear orden, verificación SHA256 para webhook; mock si no hay claves

### Proveedor SIFEN (`src/lib/fiscal/SifenProvider.ts`)

- Modo mock (desarrollo) o real (producción con `SIFEN_HABILITADO=true`)
- Genera XML del documento electrónico y envía a SET DNIT

---

## Lib auxiliares

| Archivo | Función |
|---------|---------|
| `src/lib/prisma.ts` | Singleton del cliente Prisma |
| `src/lib/jwt.ts` | `generateToken`, `generateRefreshToken`, `verifyToken`, `verifyRefreshToken` |
| `src/lib/audit.ts` | `registrarAuditoria({ usuarioId, modulo, accion, registroId, valorAnterior, valorNuevo, ip })` |
| `src/lib/calculos.ts` | `calcularTotalesVenta(items)` — IVA 5%/10%/exento incluido en precio |
| `src/lib/logger.ts` | Logger JSON estructurado (producción) / texto (desarrollo) |
| `src/lib/redis.ts` | Cliente Redis singleton |
| `src/lib/pdf.ts` | PDF estado de cuenta libreta (pdfkit) |
| `src/lib/facturaPdf.ts` | PDF factura fiscal con desglose IVA |

---

## Patrón de rutas

Cada archivo en `src/routes/` es un Express Router autocontenido:

```typescript
router.use(authenticate);  // todas las rutas del archivo requieren token

router.get('/', requirePermiso('VENTAS:VER'), async (req, res) => {
  // lógica
  res.json({ success: true, data: [...], meta: { total, page, limit, totalPages } });
});

router.post('/', requirePermiso('VENTAS:CREAR'),
  [body('campo').notEmpty(), handleValidation],
  async (req, res) => { ... }
);
```

**Excepción:** Los webhooks de pasarelas de pago (`/api/pagos/webhook/bancard`, `/api/pagos/webhook/pagopar`) no llevan `authenticate` porque son llamados por terceros.

---

## Decisiones de diseño

### BigInt para Guaraníes

Todos los campos monetarios en la base de datos son `BigInt` (PostgreSQL `bigint`). Esto evita errores de punto flotante con montos grandes. En código TypeScript se usa `BigInt(valor)`. La serialización JSON de BigInt se parchea al inicio del servidor:

```typescript
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
```

El frontend recibe montos como strings y los convierte con `BigInt()` o `Number()` según necesidad.

### Enums como strings

Los estados de los modelos (Menu, Reserva, Venta, Libreta, Caja) se almacenan como `String` en la base de datos, no como enums de Prisma. Esto facilita migraciones sin cambios de esquema al agregar estados.

### Borrado lógico

Todas las entidades principales tienen `activo: Boolean`. El borrado lógico (`activo = false`) preserva el historial y evita errores de integridad referencial. Las consultas filtran `where: { activo: true }` por defecto.

### IDs enteros autoincrement

Los `id` en Prisma son `Int @id @default(autoincrement())`. No se usan UUIDs.

### Transacciones Prisma

Las operaciones que afectan múltiples tablas usan `prisma.$transaction(async (tx) => { ... })` para garantizar atomicidad:

- Crear venta: `Venta` + `VentaItem[]` + `StockMovimiento[]` + `Pago` (+ `LibretaMovimiento` si es a crédito)
- Anular venta: reverso de todos los movimientos anteriores
- Reservar: actualizar `menu.cupo_reservado`
- Emitir factura: `DocumentoFiscal` + `SecuenciaFiscal` (UPDATE atómico)

### Timezone

Toda la lógica de fechas usa `America/Asuncion` (UTC-4). Las fechas se almacenan en UTC en PostgreSQL y se presentan con offset paraguayo.
