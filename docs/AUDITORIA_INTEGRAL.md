# Auditoría Integral — Sistema Comedor

**Fecha:** 2026-07-07
**Alcance:** monorepo completo (apps/api, apps/web-admin, apps/web-cliente, packages/database)
**Metodología:** análisis multi-rol (Ciberseguridad, Base de Datos, Arquitectura, Desarrollo) con verificación adversarial de hallazgos críticos.
**Rama:** `claude/setup-project-readme-7HOyV`

> **Estado de remediación:** los hallazgos marcados ✅ **CORREGIDO** ya se implementaron en el commit `fd7d7bd`. Los marcados ⏳ **PENDIENTE** están documentados con su recomendación para una segunda iteración.

---

## Resumen ejecutivo

El sistema está funcionalmente completo y bien estructurado (monorepo, RBAC por permisos, dinero en BigInt, transacciones Prisma, auditoría). Sin embargo la auditoría encontró **vulnerabilidades críticas de seguridad** —principalmente en el portal público del cliente y en el flujo de pagos— y una **ausencia total de índices de base de datos** que degradaría el rendimiento a escala.

En esta iteración se corrigieron los **8 hallazgos críticos/altos de seguridad más explotables** y se agregaron índices a los 10 modelos transaccionales core. El resto queda documentado abajo con plan priorizado.

| Rol | Hallazgos | Corregidos | Pendientes |
|-----|-----------|------------|------------|
| Ciberseguridad | 20 | 8 | 12 |
| Base de Datos | 5 | 1 (índices core) | 4 |
| Arquitectura | 6 | 1 (secreto portal) | 5 |
| Desarrollo | 5 | 1 (setup tests) | 4 |

---

## 🔐 Rol 1 — Ciberseguridad

### Corregidos en esta iteración

| # | Severidad | Hallazgo | Archivo | Estado |
|---|-----------|----------|---------|--------|
| S1 | 🔴 CRÍTICA | Secreto JWT con fallback hardcodeado (`fallback-secret-change-in-production`) → falsificación de tokens de admin | `apps/api/src/lib/jwt.ts:3` | ✅ Fail-fast si falta el secreto; sin default |
| S2 | 🔴 CRÍTICA | Account takeover: el registro del portal sobrescribía la contraseña de cualquier cliente existente por teléfono/email | `apps/api/src/routes/portal.ts` (register + /registro) | ✅ Devuelve 409 si ya existe cuenta con credenciales |
| S3 | 🔴 CRÍTICA | Exfiltración no autenticada de `password_hash` y PII vía `POST /portal/reservas` (`include: cliente: true`) | `apps/api/src/routes/portal.ts` | ✅ `select` seguro sin `password_hash` |
| S4 | 🔴 CRÍTICA | Bypass de firma de webhook Pagopar: la condición `&& hash` permitía omitir la verificación no enviando el campo | `apps/api/src/lib/payment/PagoparProvider.ts:106` | ✅ Ausencia de firma = rechazo |
| S5 | 🔴 CRÍTICA | Mass assignment en `PUT /libretas/:id`: `data = {...req.body}` permitía manipular `saldo_actual`/`estado` del ledger de crédito | `apps/api/src/routes/libretas.ts:168` | ✅ Allowlist; saldos no editables por API |
| S6 | 🟠 ALTA | Fuga de PII: `GET /portal/reservas?telefono=` público devolvía nombre/tel/email de cualquier cliente | `apps/api/src/routes/portal.ts:323` | ✅ Requiere auth; filtra por cliente autenticado |
| S7 | 🟠 ALTA | Mass assignment en `POST /clientes`: inyección de `password_hash`/`estado`; contraseña registrada en auditoría | `apps/api/src/routes/clientes.ts:162` | ✅ Allowlist + auditoría sin contraseña |
| S8 | 🟡 MEDIA | Portal y admin comparten `JWT_SECRET` (confusión de dominios de confianza) | `apps/api/src/routes/portal.ts:9` | ✅ `PORTAL_JWT_SECRET` independiente (falta claim `aud`) |

### Pendientes (recomendaciones para segunda iteración)

| # | Severidad | Hallazgo | Archivo | Recomendación |
|---|-----------|----------|---------|---------------|
| S9 | 🔴 CRÍTICA | Webhooks de pago sin firma real (bypass `if (SANDBOX) return true`) confirman pagos fraudulentamente | `pagos.ts:72,193` | Verificar firma también en sandbox con credenciales reales; no aceptar webhooks sin firma válida |
| S10 | 🟠 ALTA | Verificación de firma Bancard estructuralmente incorrecta (`esperado === token` donde `token` es entrada del hash) | `BancardProvider.ts:32` | Implementar el algoritmo real de Bancard (`SHA256(private_key + shop_process_id + 'confirm' + amount + currency)`) |
| S11 | 🟠 ALTA | El monto del webhook nunca se valida contra `pago.monto` → confirmar pago pagando menos | `pagos.ts:129` | Comparar `monto_confirmado` vs pendiente real y rechazar discrepancias |
| S12 | 🟠 ALTA | Broken access control: `PUT /pagos/:id/confirmar` exige `VENTAS:EDITAR` en vez de `PAGOS:CONFIRMAR` | `pagos.ts:826` | Unificar a `PAGOS:CONFIRMAR` o eliminar la ruta duplicada |
| S13 | 🟠 ALTA | `password_hash` expuesto a staff por `include: { cliente: true }` en `clientes.ts` GET /:id, `reservas.ts`, `ventas.ts` | varios | `select` explícito o helper `publicCliente()` en todas las inclusiones |
| S14 | 🟠 ALTA | Credencial admin por defecto hardcodeada (`admin@comedor.com`/`admin123`), ignora `ADMIN_EMAIL/PASSWORD` del `.env` | `seed.ts:159` | Leer del entorno; generar aleatoria si falta; forzar cambio en primer login |
| S15 | 🟡 MEDIA | Login del portal sin rate limiting y contraseña mínima débil (6) → fuerza bruta | `portal.ts:159` | Aplicar `rateLimitMiddleware`; mínimo 8-10 con requisitos |
| S16 | 🟡 MEDIA | Tokens de cliente irrevocables (7d, stateless), no se invalidan al cambiar contraseña | `portal.ts:20` | Sesiones/refresh con revocación (jti o tabla), invalidar al cambiar contraseña |
| S17 | 🟡 MEDIA | POS manual: `monto` y `cliente_id` del body sin validar contra la venta | `pagos.ts:765` | Derivar monto del pendiente en servidor; tomar cliente de la venta |
| S18 | 🟡 MEDIA | `PUT /configuraciones/:clave` sin allowlist: sobrescribe claves fiscales/credenciales | `configuraciones.ts:23` | Catálogo de claves editables con validadores; tratar numeración fiscal como solo lectura |
| S19 | 🟡 MEDIA | Subida de imágenes sin `fileFilter`/`limits` (almacenamiento de contenido activo) | `productos.ts:11` | Validar MIME (png/jpeg/webp), forzar extensión, límite de tamaño |
| S20 | 🟡 MEDIA | Mass assignment generalizado (`data: req.body`) en productos, conceptos, categorías, proveedores, sucursales, compras, cajas | varios | Allowlist explícita por endpoint + express-validator |
| S21 | 🟡 MEDIA | Contraseñas de infra committeadas (`comedor123`) y puerto 5432/Redis sin password expuestos | `docker-compose.yml:8` | Secretos por entorno no versionados; Redis con `requirepass`; no publicar 5432 |
| S22 | 🔵 BAJA | Idempotencia de webhooks con condición de carrera (TOCTOU) | `pagos.ts:78` | Usar la restricción única (proveedor+event_id) como lock atómico |

---

## 🗄️ Rol 2 — Base de Datos

### Corregido

- **D1 — 🔴 Ausencia total de índices (0 `@@index` en 42 modelos).** PostgreSQL **no** crea índices automáticos en foreign keys; todas las FK y columnas de filtro (`estado`, `fecha`, `creado_en`) hacían *sequential scan*. ✅ **CORREGIDO**: se agregaron `@@index` a los 10 modelos transaccionales core (`Reserva`, `Venta`, `VentaItem`, `Libreta`, `LibretaMovimiento`, `Pago`, `Factura`, `StockMovimiento`, `Notificacion`, `Auditoria`) cubriendo FKs, `estado`, y columnas de fecha usadas en reportes.
  > **Acción requerida:** generar la migración con `npx prisma migrate dev --name add_indexes` para materializar los índices en la base.

### Pendientes

- **D2 — 🟡 Índices restantes.** Falta indexar `Compra`, `CompraItem`, `CajaMovimiento`, `CajaApertura`, `DocumentoFiscal` (cliente_id), `DocumentoFiscalEvento`, `ClienteEmpresa`, `PagoIntento`, `MenuItem`, `Menu` (fecha/estado). Recomendación: indexar toda FK y columna usada en `where`/`orderBy`.
- **D3 — 🟡 Sin tuning de connection pool.** `prisma.ts` usa el pool por defecto. Bajo carga conviene fijar `connection_limit` en la `DATABASE_URL` y considerar PgBouncer.
- **D4 — 🟡 Normalización: saldos denormalizados.** `Libreta.saldo_actual`/`saldo_vencido` se almacenan y se mutan por código; el ledger (`LibretaMovimiento`) es la fuente de verdad. Riesgo de divergencia. Recomendación: job de reconciliación periódico o vista materializada que valide `saldo_actual == SUM(movimientos)`.
- **D5 — 🟡 Enums como String sin constraint.** Estados (`Menu.estado`, `Venta.estado`, etc.) son `VarChar` libres; un valor inválido no lo rechaza la DB. Recomendación: `CHECK` constraints o enums Prisma para los estados estables.

---

## 🏛️ Rol 3 — Arquitectura

- **A1 — 🟡 Lógica de negocio en las rutas.** Coexisten servicios (`StockService`, `LibretaService`, `SecuenciaService`) con rutas que embeben lógica compleja (`ventas.ts`, `pagos.ts` de 910 líneas). Recomendación: extraer la lógica de negocio a la capa de servicios de forma consistente.
- **A2 — 🟡 Observabilidad inconsistente.** 23 routers usan `console.error` en lugar del `logger` estructurado. Recomendación: reemplazar por `logger.error(msg, {requestId, ...})`.
- **A3 — 🟡 `requestId` desde header del cliente.** `errorHandler` lee `x-request-id` del request (spoofeable). Recomendación: generar el id en el middleware `requestId` y no confiar en el header entrante.
- **A4 — 🟡 API design: alias redundantes divergentes.** El portal expone `/me` + `/perfil` y `/auth/register` + `/registro` con implementaciones separadas (una fuente de bugs de seguridad divergentes, como en el account takeover). Recomendación: una sola implementación por operación.
- **A5 — 🟡 Rutas duplicadas de confirmación de pago** con permisos distintos (ver S12). Consolidar.
- **A6 — ✅ Secreto de portal separado** del admin (`PORTAL_JWT_SECRET`). Pendiente: agregar claim `aud`/`tipo` verificado en cada middleware.

---

## 🛠️ Rol 4 — Desarrollo

- **V1 — ✅ Tests estabilizados.** `test/setup.ts` ahora fija los secretos a nivel de módulo (antes fallaban al importar `jwt.ts`). 27 tests pasan.
- **V2 — 🟡 Cobertura de tests baja en rutas de dinero.** Solo hay tests de `auth`, `calculos` y `reservas`. **No** hay tests de `ventas`, `libretas`, `pagos` ni `facturas` — los flujos de mayor riesgo. Recomendación: tests de integración con Prisma mockeado para el flujo venta→stock→libreta→pago y anulaciones.
- **V3 — 🟡 `noImplicitAny: false`.** `apps/api/tsconfig.json` desactiva `noImplicitAny`, ocultando errores de tipo. Recomendación: reactivar gradualmente y tipar los callbacks.
- **V4 — 🟡 `JSON.parse(JSON.stringify(...))` como cast de JSON de Prisma.** Parche funcional pero frágil; conviene tipar los payloads con `Prisma.InputJsonValue`.
- **V5 — 🟡 Duplicación en el menú del admin.** `navItems.tsx` tiene entradas duplicadas de "Recetas" y "Empresas". Recomendación: deduplicar.

---

## Plan de mejora priorizado

### Inmediato (seguridad de dinero y datos) — parcialmente hecho
1. ✅ Secretos JWT sin fallback + portal independiente
2. ✅ Cerrar account takeover y fuga de PII del portal
3. ✅ Mass assignment de libretas y clientes
4. ✅ Bypass de firma Pagopar
5. ⏳ **Firma real de webhooks Bancard/Pagopar + validación de monto (S9–S11)** ← siguiente prioridad
6. ⏳ Corregir control de acceso de confirmación de pagos (S12)
7. ⏳ Quitar `password_hash` de todos los `include: cliente` (S13)
8. ⏳ Credenciales admin y de infra desde entorno (S14, S21)

### Corto plazo
- Rate limit + política de contraseña en el portal (S15, S16)
- Allowlist en todos los routers y en configuraciones (S18, S20)
- Validación de subida de archivos (S19)
- Generar migración de índices y completar índices restantes (D1, D2)

### Mediano plazo
- Extraer lógica de negocio a servicios (A1); logger estructurado en todas las rutas (A2)
- Reconciliación de saldos de libreta (D4); constraints de estados (D5)
- Elevar cobertura de tests en ventas/libretas/pagos/facturas (V2); reactivar `noImplicitAny` (V3)
- Deduplicar rutas/alias del portal y del menú admin (A4, V5)

---

## Notas de la auditoría

El análisis se ejecutó como orquestación multi-agente (un agente por rol y dimensión) con verificación adversarial. La fase de Ciberseguridad completó 4 de 6 dimensiones antes de agotar la cuota de sesión; las dimensiones de Base de Datos, Arquitectura y Desarrollo se completaron mediante inspección directa del código. Todos los hallazgos citan archivo y línea y fueron verificados leyendo el código fuente.
