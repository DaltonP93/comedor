# Handoff operativo para IA — Sistema de Comedor

> Actualizado: 2026-09-01. Este documento complementa el `CLAUDE.md` técnico existente y prevalece sobre sus afirmaciones de estado cuando no haya evidencia actual.

## Propósito

Sistema institucional de comedor/cantina/restaurante para Paraguay: menú, reservas, ventas, caja, stock, recetas, libreta/cobranzas, pagos, facturación, notificaciones, portal de cliente y auditoría. La prioridad es una operación trazable y segura, no solo una interfaz de caja.

## Arquitectura confirmada

- Monorepo npm workspaces: `apps/api`, `apps/web-admin`, `apps/web-cliente` y `packages/database`.
- API Express/TypeScript; interfaces React/Vite/TypeScript; Prisma para datos.
- Docker Compose para el stack local.
- Moneda: guaraníes enteros; conservar el tratamiento `BigInt` de valores monetarios.
- La especificación funcional está en `README.md`; el `CLAUDE.md` existente contiene rutas, patrones y comandos detallados.

## Línea base y nivel de certeza

- Rama principal: `main`.
- Último commit observado al redactar: `58b56c0` (2026-07-08), que corrigió el lockfile para que `npm ci` pase.
- El repositorio contiene una implementación amplia de módulos/sprints, pero eso no prueba producción real ni integraciones externas operativas.
- No declarar que Pagopar/Bancard, SIFEN, POS, facturación fiscal, notificaciones, backups o despliegue están listos sin ejecutar pruebas de integración, revisar credenciales configuradas y obtener aprobación explícita.

## Reglas de negocio que no se deben romper

1. Una venta/anulación debe actualizar stock, caja, libreta y auditoría de forma atómica y trazable.
2. La libreta es un ledger de movimientos; no alterar saldos históricos de forma directa.
3. Una reserva cancelada libera cupo; una entregada sigue el flujo de venta.
4. Nunca marcar un pago como aprobado solo por datos del cliente: validar firma, contrato, idempotencia y conciliación del webhook.
5. Nunca declarar una factura fiscal aprobada sin respuesta verificable del proveedor/SIFEN. Correcciones fiscales deben seguir el flujo correspondiente, no editar una venta facturada.
6. Conservar auditoría en cambios de precio, stock, ventas, caja, libreta, permisos y documentos.
7. No exponer datos personales, RUC, tokens de pasarela, secretos de correo ni claves de SIFEN.

## Método de trabajo

1. Iniciar con `git status --short`, `git log -1`, revisión de PRs y lectura del módulo afectado.
2. Distinguir especificación, código implementado, pruebas ejecutadas y estado real de producción.
3. Para pagos, reservas, stock, caja o facturación, elaborar primero casos de éxito, error, repetición e idempotencia.
4. No ejecutar migraciones, resets de base, seeds en producción, despliegues, merges ni cambios de proveedores sin autorización.
5. Mantener toda UI, mensajes y reglas de negocio en español y adaptar fechas a `America/Asuncion` cuando corresponda.

## Validación mínima

Desde la raíz, según el alcance:

```bash
npm ci
npm run db:generate
npm test
npm run lint
npm run typecheck
npm run build
```

Las pruebas sin una base de integración no sustituyen validación de pagos, SIFEN, stock concurrente ni producción.

## Inicio de una sesión

Antes de implementar, Claude debe resumir el módulo, la invariante de negocio, los contratos externos implicados, los datos sensibles y el plan de pruebas. Si falta evidencia, debe pedirla en vez de asumir que una fase está terminada.
