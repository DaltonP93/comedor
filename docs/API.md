# API Reference — Comedor

**Base URL:** `http://localhost:3001/api`  
**Autenticación:** `Authorization: Bearer <token>` (JWT 8h)  
**Formato de respuesta:**
```json
{ "success": true, "data": {}, "message": "...", "meta": { "total": 0, "page": 1, "limit": 20 } }
```

## Auth (`/auth`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` | Login de usuario admin |
| POST | `/auth/refresh` | Renovar token con refresh token |
| POST | `/auth/logout` | Cerrar sesión |

## Portal de clientes (`/portal`)

No requiere autenticación de admin. Usa token de cliente (`tipo: CLIENTE`).

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/portal/auth/login` | Login de cliente |
| POST | `/portal/auth/register` | Registro de cliente |
| POST | `/portal/registro` | Alias de registro |
| POST | `/portal/recuperar-password` | Solicitar reset de contraseña |
| GET | `/portal/menus` | Menús publicados (público) |
| GET | `/portal/me` | Perfil del cliente autenticado |
| PUT | `/portal/me` | Actualizar perfil |
| GET | `/portal/perfil` | Alias de GET /me |
| PUT | `/portal/perfil` | Alias de PUT /me |
| PUT | `/portal/password` | Cambiar contraseña |
| GET | `/portal/dashboard` | Resumen del cliente |
| GET | `/portal/reservas/mias` | Reservas del cliente |
| POST | `/portal/reservas` | Crear reserva |
| GET | `/portal/ventas` | Compras del cliente |
| GET | `/portal/libretas` | Libretas del cliente |
| GET | `/portal/pagos` | Pagos del cliente |
| GET | `/portal/facturas` | Facturas del cliente |
| GET | `/portal/facturas/:id/pdf` | PDF de factura |
| GET | `/portal/notificaciones` | Notificaciones recientes |
| GET | `/portal/notificaciones/preferencias` | Preferencias de notificación |
| PUT | `/portal/notificaciones/preferencias` | Guardar preferencias |

## Ventas (`/ventas`)

Requiere permiso `VENTAS:*`.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/ventas` | VENTAS:VER | Listar ventas (filtros: fecha, estado, cliente) |
| GET | `/ventas/:id` | VENTAS:VER | Detalle de venta |
| POST | `/ventas` | VENTAS:CREAR | Crear venta (contado o libreta) |
| POST | `/ventas/:id/anular` | VENTAS:EDITAR | Anular venta |
| POST | `/ventas/rapida` | VENTAS:CREAR | Venta rápida (sin reserva) |
| POST | `/ventas/desde-reserva` | VENTAS:CREAR | Convertir reserva en venta |

### Body de creación de venta
```json
{
  "cliente_id": 1,
  "sucursal_id": 1,
  "items": [{ "producto_id": 1, "cantidad": 2, "precio_unitario": 25000 }],
  "forma_pago": "EFECTIVO",
  "monto_pagado": 50000,
  "cargada_libreta": false,
  "libreta_id": null,
  "observacion": ""
}
```

## Menús (`/menus`)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/menus` | MENUS:VER |
| POST | `/menus` | MENUS:CREAR |
| PUT | `/menus/:id` | MENUS:EDITAR |
| POST | `/menus/:id/publicar` | MENUS:PUBLICAR |
| POST | `/menus/:id/cancelar` | MENUS:CANCELAR |

## Reservas (`/reservas`)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/reservas` | RESERVAS:VER |
| GET | `/reservas/:id` | RESERVAS:VER |
| PUT | `/reservas/:id/estado` | RESERVAS:EDITAR |
| DELETE | `/reservas/:id` | RESERVAS:EDITAR |

## Libretas (`/libretas`)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/libretas` | LIBRETAS:VER |
| GET | `/libretas/:id` | LIBRETAS:VER |
| POST | `/libretas/:id/pagar` | LIBRETAS:COBRAR |
| POST | `/libretas/:id/bloquear` | LIBRETAS:BLOQUEAR |
| POST | `/libretas/:id/desbloquear` | LIBRETAS:BLOQUEAR |
| GET | `/libretas/:id/estado-cuenta/pdf` | LIBRETAS:VER |

## Stock (`/stock`)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/stock` | STOCK:VER |
| GET | `/stock/actual` | STOCK:VER |
| POST | `/stock/entrada` | STOCK:ENTRADA |
| POST | `/stock/ajuste` | STOCK:AJUSTE |
| GET | `/stock/alertas` | STOCK:VER |

## Caja (`/caja`)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/caja/aperturas` | CAJA:VER |
| POST | `/caja/:cajaId/abrir` | CAJA:ABRIR |
| POST | `/caja/aperturas/:id/cerrar` | CAJA:CERRAR |
| POST | `/caja/aperturas/:id/retiro` | CAJA:AJUSTAR |
| GET | `/caja/aperturas/:id/resumen` | CAJA:VER |
| GET | `/caja/:cajaId/estado` | CAJA:VER |

## Facturas (`/facturas`)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/facturas` | VENTAS:VER |
| GET | `/facturas/:id` | VENTAS:VER |
| POST | `/facturas` | VENTAS:CREAR |
| GET | `/facturas/:id/pdf` | VENTAS:VER |
| POST | `/facturas/:id/anular` | FACTURAS:ANULAR |
| POST | `/facturas/:id/nota-credito` | FACTURAS:ANULAR |
| POST | `/facturas/:id/reenviar-sifen` | FACTURAS:SIFEN |

## Pagos (`/pagos`)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/pagos` | VENTAS:VER |
| GET | `/pagos/conciliacion` | VENTAS:VER |
| POST | `/pagos/iniciar` | VENTAS:CREAR |
| POST | `/pagos/:id/confirmar` | PAGOS:CONFIRMAR |
| POST | `/pagos/:id/rechazar` | PAGOS:RECHAZAR |
| POST | `/webhook/bancard` | — (sin auth) |
| POST | `/webhook/pagopar` | — (sin auth) |

## Notificaciones (`/notificaciones`)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/notificaciones` | CLIENTES:VER |
| POST | `/notificaciones` | NOTIFICACIONES:ENVIAR |
| POST | `/notificaciones/envio-masivo` | NOTIFICACIONES:ENVIAR |

## Reportes (`/reportes`)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/reportes/dashboard` | DASHBOARD:VER |
| GET | `/reportes/ventas` | REPORTES:VER |
| GET | `/reportes/stock` | REPORTES:VER |
| GET | `/reportes/libreta` | REPORTES:VER |
| GET | `/reportes/cocina` | COCINA:VER |
| GET | `/reportes/prediccion` | REPORTES:VER |
| GET | `/reportes/rentabilidad` | REPORTES:VER |
| GET | `/reportes/desperdicio` | REPORTES:VER |

## Clientes, Productos, Usuarios, Roles, Sucursales

CRUD estándar en `/clientes`, `/productos`, `/usuarios`, `/roles`, `/sucursales`.  
Todos requieren permiso `MODULO:ACCION` correspondiente.

## Empresas (`/empresas`)

| Método | Ruta |
|---|---|
| GET | `/empresas` |
| GET | `/empresas/:id` (incluye clientes y libretas) |
| POST | `/empresas` |
| PUT | `/empresas/:id` |

## Auditoría (`/auditoria`)

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/auditoria` | AUDITORIA:VER |

## Códigos de error

| Código | Descripción |
|---|---|
| 400 | Validación fallida — ver campo `errors` |
| 401 | Token inválido o expirado |
| 403 | Sin permiso para la acción |
| 404 | Recurso no encontrado |
| 409 | Conflicto (duplicado, estado inválido) |
| 429 | Rate limit excedido |
| 500 | Error interno del servidor |
