# Guía de Pagos

## Proveedores disponibles

| Proveedor | Estado | Configuración |
|-----------|--------|---------------|
| Efectivo / POS manual | ✅ Activo | Sin configuración |
| Bancard | ✅ Mock/Real | `BANCARD_PRIVATE_KEY`, `BANCARD_PUBLIC_KEY` |
| Pagopar | ✅ Mock/Real | `PAGOPAR_TOKEN_PUBLICO`, `PAGOPAR_TOKEN_PRIVADO` |

---

## Flujo de pago online

```
Cliente → POST /pagos/iniciar → PagoIntento creado
       ↓
Proveedor (Bancard/Pagopar) → redirect_url
       ↓
Cliente paga en el proveedor
       ↓
Proveedor → POST /webhook/bancard (o /webhook/pagopar)
       ↓
Sistema valida firma → actualiza Pago → completa Venta
```

---

## Modo sandbox vs producción

El sistema detecta automáticamente el modo según las variables de entorno:

```bash
# Sandbox (sin credenciales reales)
# BANCARD_PRIVATE_KEY=        ← vacío o no definido
# BANCARD_SANDBOX=true

# Producción
BANCARD_PRIVATE_KEY=clave-real
BANCARD_PUBLIC_KEY=clave-publica-real
BANCARD_SANDBOX=false
```

---

## Idempotencia de webhooks

Cada webhook se guarda en `webhook_eventos` con `(proveedor, event_id)` único.

Si el proveedor reenvía el mismo webhook, el sistema responde `200 OK` sin reprocesar.

---

## POS manual

Para registrar un pago POS sin pasarela online:

```
POST /api/pagos/pos/manual
{
  "venta_id": 123,
  "monto": 50000,
  "voucher": "123456",
  "autorizacion": "ABC123"
}
```

---

## Conciliación

Reporte en `GET /api/pagos/conciliacion?fecha_desde=&fecha_hasta=`

Agrupa los pagos confirmados por forma de pago con totales.

---

## Configurar webhooks en producción

### Bancard

URL a configurar en el panel Bancard:
```
https://tu-dominio.com/api/webhook/bancard
```

### Pagopar

URL a configurar en el panel Pagopar:
```
https://tu-dominio.com/api/webhook/pagopar
```

Ambos endpoints no requieren autenticación JWT (son llamados por las pasarelas).
