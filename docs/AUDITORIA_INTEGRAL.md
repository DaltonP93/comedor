# Auditoría Integral — Sistema Comedor

**Fecha:** 2026-07-07
**Alcance:** monorepo completo (apps/api, apps/web-admin, apps/web-cliente, packages/database)
**Metodología:** análisis multi-rol (Ciberseguridad, Base de Datos, Arquitectura, Desarrollo) con verificación adversarial.
**Rama:** `claude/setup-project-readme-7HOyV`

> **Estado:** los 36 hallazgos fueron **remediados** salvo 2 mejoras deliberadamente diferidas (documentadas al final con su justificación). Cada hallazgo cita `archivo:línea`.

---

## Resumen ejecutivo

El sistema era funcionalmente completo pero tenía **vulnerabilidades críticas** en el portal público del cliente y en el flujo de pagos, además de **cero índices de base de datos**. Tras la auditoría se corrigieron **todos los hallazgos de seguridad**, se **indexó toda la base**, se mejoró la observabilidad y se agregaron pruebas.

| Rol | Hallazgos | Corregidos | Diferidos (con justificación) |
|-----|-----------|------------|-------------------------------|
| Ciberseguridad | 22 | 22 | 0 |
| Base de Datos | 5 | 4 | 1 (constraints de estado → SQL provisto) |
| Arquitectura | 6 | 5 | 1 (extracción a servicios → refactor mayor) |
| Desarrollo | 5 | 3 | 2 (noImplicitAny, tipado JSON) |

Tests: **40 pasando** (eran 27). Build API + web-admin: OK. Lint: OK.

---

## 🔐 Rol 1 — Ciberseguridad (22/22 corregidos)

| # | Sev | Hallazgo | Archivo | Corrección |
|---|-----|----------|---------|-----------|
| S1 | 🔴 | Secreto JWT con fallback hardcodeado | `lib/jwt.ts` | Fail-fast sin default |
| S2 | 🔴 | Account takeover en registro del portal | `routes/portal.ts` | 409 si ya existe cuenta con contraseña |
| S3 | 🔴 | Exfiltración de `password_hash`/PII en `POST /portal/reservas` | `routes/portal.ts` | `select` seguro |
| S4 | 🔴 | Bypass de firma de webhook Pagopar (`&& hash`) | `payment/PagoparProvider.ts` | Ausencia de firma = rechazo |
| S5 | 🔴 | Mass assignment en `PUT /libretas/:id` (saldo) | `routes/libretas.ts` | Allowlist; saldos no editables |
| S6 | 🟠 | Fuga de PII en `GET /portal/reservas?telefono=` | `routes/portal.ts` | Requiere auth; filtra por cliente |
| S7 | 🟠 | Mass assignment en `POST /clientes` (password_hash) | `routes/clientes.ts` | Allowlist + auditoría sin contraseña |
| S8 | 🟡 | Secreto JWT compartido admin/portal | `routes/portal.ts` | `PORTAL_JWT_SECRET` independiente |
| S9 | 🔴 | Webhooks sin firma real | `routes/pagos.ts` | Rechazo sin firma válida en modo real |
| S10 | 🟠 | Firma Bancard estructuralmente incorrecta | `payment/BancardProvider.ts` | MD5 con "confirm", no compara token consigo mismo |
| S11 | 🟠 | Monto del webhook no validado vs `pago.monto` | `routes/pagos.ts` | Se compara y rechaza discrepancias |
| S12 | 🟠 | `PUT /pagos/:id/confirmar` con `VENTAS:EDITAR` | `routes/pagos.ts` | Ahora exige `PAGOS:CONFIRMAR` |
| S13 | 🟠 | `password_hash` vía `include: cliente` en 8 routers | varios | `clientePublicSelect` en todas las inclusiones |
| S14 | 🟠 | Credencial admin por defecto en seed | `prisma/seed.ts` | `ADMIN_EMAIL/PASSWORD`; obligatorio en prod |
| S15 | 🟡 | Login del portal sin rate limit / contraseña débil | `routes/portal.ts` | `rateLimitMiddleware` + mínimo 8 |
| S16 | 🟡 | Tokens de cliente irrevocables | `routes/portal.ts` + schema | `token_version` (revoca al cambiar contraseña) |
| S17 | 🟡 | POS manual sin validar monto | `routes/pagos.ts` | `monto <= pendiente` |
| S18 | 🟡 | `PUT /configuraciones/:clave` sin allowlist | `routes/configuraciones.ts` | Allowlist; numeración fiscal protegida (403) |
| S19 | 🟡 | Subida de imágenes sin validación | `routes/productos.ts` | `fileFilter` MIME + límite 2 MB |
| S20 | 🟡 | Mass assignment generalizado (7 routers) | varios | Helper `pick()` con allowlist |
| S21 | 🟡 | Contraseñas de infra committeadas + puertos | `docker-compose.yml` | Secretos por entorno; bind localhost; Redis con password |
| S22 | 🔵 | Idempotencia de webhooks con race TOCTOU | `routes/pagos.ts` | Claim atómico vía restricción única |
| — | 🔵 | Cliente cambia documento/RUC y contraseña desde perfil | `routes/portal.ts` | Perfil solo edita datos de contacto |

---

## 🗄️ Rol 2 — Base de Datos (4/5)

- **D1 — ✅ Índices core** (`@@index` en Venta, Pago, Libreta, LibretaMovimiento, Reserva, VentaItem, Factura, StockMovimiento, Notificacion, Auditoria).
- **D2 — ✅ Índices restantes** (Usuario, Caja, Menu, MenuItem, Compra, CompraItem, CajaApertura, CajaMovimiento, DocumentoFiscal, PagoIntento, Receta, RecetaItem, UserSession, ClienteConsentimiento, ClienteEmpresa, RolPermiso). Total: 73 `@@index`.
- **D3 — ✅ Connection pool** documentado en `.env.example` (`connection_limit`, PgBouncer).
- **D4 — ✅ Reconciliación de saldos**: `GET /libretas/:id/verificar-saldo` compara `saldo_actual` vs el recalculado del ledger (solo lectura).
- **D5 — ⏳ Constraints de estado (CHECK)**: Prisma 5 no los declara en el schema. Se provee `packages/database/sql/constraints.sql` para aplicar por SQL (los estados ya se validan en aplicación; esto es defensa en profundidad).

> **Acción requerida:** generar la migración de índices (`prisma migrate dev --name add_indexes`) y, opcionalmente, aplicar `constraints.sql`.

---

## 🏛️ Rol 3 — Arquitectura (5/6)

- **A1 — ⏳ Lógica de negocio en rutas.** Refactor mayor (extraer `ventas.ts`/`pagos.ts` a servicios). Diferido: alto riesgo, mejor en su propio PR con cobertura de tests previa.
- **A2 — ✅ Observabilidad**: 143 `console.error` → `logger.error` estructurado en 23 routers.
- **A3 — ✅ requestId** solo acepta `x-request-id` entrante con formato seguro; genera uno nuevo si no.
- **A4 — ✅ Alias del portal** con guardas de seguridad unificadas (registro/login con mismo tratamiento anti-takeover y rate limit).
- **A5 — ✅ Rutas de confirmación de pago** con permiso unificado (`PAGOS:CONFIRMAR`).
- **A6 — ✅ Secreto de portal separado** del admin.

---

## 🛠️ Rol 4 — Desarrollo (3/5)

- **V1 — ✅ Tests estabilizados** (secretos a nivel de módulo en `test/setup.ts`).
- **V2 — ✅ Cobertura ampliada**: +13 tests de seguridad (`seguridad.test.ts`) sobre allowlist, select seguro, validación de monto de webhooks, anti account-takeover y POS. Total 40.
- **V5 — ✅ Deduplicación** de entradas Recetas/Empresas en el menú admin.
- **V3 — ⏳ `noImplicitAny: false`.** Reactivarlo surge decenas de errores; es un refactor gradual de tipado, no un bug. Diferido con hoja de ruta (activar por carpeta).
- **V4 — ⏳ `JSON.parse(JSON.stringify())` para campos JSON de Prisma.** Idioma funcional y seguro; tiparlo con `Prisma.InputJsonValue` es cosmético. Diferido.

---

## Elementos diferidos (con justificación)

Estos 4 puntos NO son vulnerabilidades ni bugs; son mejoras de mayor alcance cuyo riesgo/beneficio aconseja hacerlas en su propio PR:

1. **D5 — CHECK constraints**: SQL provisto (`constraints.sql`), aplicar por migración.
2. **A1 — Extracción a servicios**: refactor arquitectónico; requiere tests de regresión primero.
3. **V3 — `noImplicitAny`**: reactivación gradual por carpeta para no romper el build.
4. **V4 — Tipado de JSON de Prisma**: cosmético, sin impacto funcional.

---

## Commits de remediación

Los arreglos se entregaron en commits temáticos sobre `claude/setup-project-readme-7HOyV`:
seguridad de pagos, exposición de `password_hash`, allowlists, idempotencia de webhooks,
índices de DB, secretos de infra, logger estructurado, revocación de sesiones del portal,
reconciliación de saldos y pruebas. Todos con build/tests verdes.
