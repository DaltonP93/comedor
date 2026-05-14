# Guía SIFEN (Facturación Electrónica Paraguay)

## Conceptos

**SIFEN** = Sistema Integrado de Facturación Electrónica Nacional (DNIT Paraguay).

**CDC** = Código de Control de 44 dígitos que identifica cada documento fiscal.

**KUDE** = Representación gráfica del documento electrónico (PDF).

**Timbrado** = Autorización DNIT para emitir documentos fiscales.

---

## Tipos de documento

| Código | Descripción |
|--------|-------------|
| `FACTURA` | Factura electrónica estándar |
| `BOLETA` | Boleta de venta |
| `NOTA_CREDITO` | Nota de crédito (cancela factura anterior) |

---

## Estados del documento

```
BORRADOR → EMITIDA_LOCAL → PENDIENTE_SIFEN → APROBADA_SIFEN
                                           ↘ RECHAZADA_SIFEN
                                           ↘ OBSERVADA_SIFEN
         → ANULADA
```

---

## IVA Paraguay (incluido en precio)

Paraguay usa **IVA incluido** en el precio de venta.

Fórmulas:
```
IVA 10% incluido: iva = precio * 10 / 110
IVA  5% incluido: iva = precio * 5 / 105
Exento:           iva = 0
```

Implementado en `apps/api/src/lib/calculos.ts` → `calcularTotalesVenta()`.

---

## Numeración secuencial

La secuencia fiscal garantiza números únicos sin duplicados:

```
Formato: 001-001-0000001
         │   │   └── número secuencial (7 dígitos)
         │   └────── punto de expedición (3 dígitos)
         └────────── establecimiento (3 dígitos)
```

La generación usa `UPDATE ... RETURNING` atómico en PostgreSQL para evitar duplicados bajo concurrencia.

---

## Modo desarrollo (mock)

Por defecto el sistema corre en modo simulación:
- No llama a SIFEN real
- Genera CDC ficticio para testing
- Documenta como `APROBADA_SIFEN` automáticamente

---

## Habilitar SIFEN real

### 1. Configurar en tabla `Configuracion`

```sql
INSERT INTO configuracion (clave, valor) VALUES
  ('SIFEN_HABILITADO', 'true'),
  ('ESTABLECIMIENTO', '001'),
  ('PUNTO_EXPEDICION', '001'),
  ('RUC_EMISOR', '80000000-0'),
  ('RAZON_SOCIAL', 'Mi Empresa S.A.'),
  ('TIMBRADO_NUMERO', 'TI123456789'),
  ('TIMBRADO_VIGENCIA', '2026-12-31');
```

### 2. Configurar credenciales en `.env`

```
SIFEN_URL=https://sifen.dnit.gov.py/api
SIFEN_TOKEN=token-de-produccion
SIFEN_CERTIFICADO_PATH=/certs/certificado.pfx
SIFEN_CERTIFICADO_PASS=clave-del-certificado
```

### 3. Reiniciar API

```bash
docker compose restart api
```

---

## Claves de configuración (tabla `Configuracion`)

| Clave | Descripción |
|-------|-------------|
| `SIFEN_HABILITADO` | `true` para activar SIFEN real |
| `ESTABLECIMIENTO` | Código de establecimiento (3 dígitos) |
| `PUNTO_EXPEDICION` | Punto de expedición (3 dígitos) |
| `RUC_EMISOR` | RUC de la empresa |
| `RAZON_SOCIAL` | Nombre de la empresa |
| `TIMBRADO_NUMERO` | Número de timbrado DNIT |
| `TIMBRADO_VIGENCIA` | Fecha de vencimiento del timbrado |

---

## Nota de crédito

Para cancelar una factura emitida:

```
POST /api/facturas/:id/nota-credito
{ "motivo": "Devolución de mercadería" }
```

Esto:
1. Crea `DocumentoFiscal` tipo `NOTA_CREDITO` con número propio
2. Marca la factura original como `ANULADA`
3. Si SIFEN habilitado, envía ambos documentos a DNIT
