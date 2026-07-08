# Especificación funcional y técnica completa  
# Sistema de ventas, reservas, menú, stock, libreta y pagos para comedor en Paraguay

**Versión:** 1.0  
**País objetivo:** Paraguay  
**Moneda:** Guaraníes paraguayos, PYG / Gs.  
**Tipo de negocio:** Comedor, cantina, cocina institucional, comedor empresarial, comedor escolar, comedor hospitalario o restaurante de menú diario.  
**Objetivo:** Diseñar un sistema completo, modular, granular y escalable para vender comida por menú, por producto, por kilo configurable, gestionar stock/mercaderías, reservas, cuentas mensuales tipo libreta, pagos directos, integración con POS y cumplimiento tributario/normativo paraguayo.

---

## 🚀 Instalación rápida (un comando)

**Con Docker (recomendado — instala y levanta todo):**

```bash
npm run setup      # o:  make setup
```

Genera `.env` con secretos fuertes, construye y levanta postgres, redis, API,
panel admin, portal del cliente y nginx, aplica las migraciones y carga el seed.

| Servicio | URL |
|----------|-----|
| Panel admin | http://localhost:3000 |
| Portal del cliente | http://localhost:3002 |
| API / health | http://localhost:3001/health |

Las credenciales del admin quedan en `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

**Sin Docker (Postgres/Redis propios):**

```bash
npm run setup:local   # instala, migra y seedea
npm run dev           # API + panel admin
npm run dev:cliente   # portal del cliente
```

**Comandos útiles** (`make help`): `make up`, `make down`, `make logs`, `make seed`, `make migrate`, `npm test`, `npm run typecheck`, `npm run lint`.

> Producción: definir en el entorno `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORTAL_JWT_SECRET`,
> `POSTGRES_PASSWORD`, `REDIS_PASSWORD` y `ADMIN_PASSWORD`. La API no arranca sin los
> secretos JWT (medida de seguridad).

---

## 1. Resumen ejecutivo

El sistema propuesto permite administrar integralmente un comedor: carga de mercaderías, recetas, costos, publicación de menús, reservas de comidas, ventas inmediatas, ventas por kilo, facturación, cuentas corrientes mensuales tipo **libreta**, pagos digitales, pagos con POS físico, notificaciones a clientes y reportes administrativos.

La lógica principal se basa en que el comedor puede vender de varias formas:

1. **Venta por menú publicado:** almuerzo, cena, desayuno, merienda o combos definidos para una fecha.
2. **Venta por kilo:** configurable por sucursal, por producto, por categoría o por horario.
3. **Venta por producto individual:** bebidas, postres, adicionales, viandas, snacks, cubiertos, envases, delivery, etc.
4. **Reserva anticipada:** el cliente reserva un menú antes de una hora límite.
5. **Cuenta mensual / libreta:** las ventas quedan acumuladas en la cuenta del cliente, funcionario, empresa, convenio o familia, para pago posterior por corte mensual, quincenal o semanal.
6. **Pago directo:** efectivo, transferencia, QR, tarjeta, billetera, pasarela online o POS.

El sistema debe ser **multiusuario, multisucursal, auditable y parametrizable**, con capacidad de operar en mostrador, cocina, administración, delivery y portal del cliente.

---

## 2. Alcance general del sistema

### 2.1. Módulos incluidos

- Autenticación y seguridad.
- Gestión de usuarios, roles y permisos granulares.
- Gestión de clientes.
- Gestión de empresas, convenios y funcionarios.
- Gestión de sucursales, cajas y puntos de expedición.
- Gestión de productos, categorías y conceptos de venta.
- Gestión de menús diarios/semanales.
- Gestión de recetas y costos.
- Entrada de mercaderías.
- Stock e inventario.
- Proveedores.
- Compras.
- Ventas rápidas de mostrador.
- Ventas por menú.
- Ventas por kilo.
- Reservas de comidas.
- Preparación y cocina.
- Delivery o retiro en local.
- Libreta / cuenta corriente de cliente.
- Facturación y documentos tributarios.
- Pagos online.
- Integración con POS físico.
- Notificaciones por WhatsApp, correo, SMS y push.
- Reportes operativos, financieros y contables.
- Auditoría completa.
- Configuración general del negocio.

### 2.2. Alcance no incluido en primera versión, pero previsto

- App móvil nativa Android/iOS.
- Integración directa con balanza fiscal certificada.
- Integración directa con ERP contable externo.
- Inteligencia artificial para predicción de demanda.
- Control biométrico para comedores institucionales.
- Sistema de fidelización avanzado.
- Marketplace multi-comedor.

---

## 3. Objetivos funcionales

1. Permitir que el comedor publique menús diarios o semanales.
2. Permitir que los clientes reserven comidas según disponibilidad.
3. Controlar cupos de producción y evitar sobreventa.
4. Vender en mostrador con caja rápida.
5. Vender por kilo cuando el comedor lo habilite.
6. Registrar entradas de mercaderías y descontar stock por receta o por venta directa.
7. Administrar cuentas mensuales tipo libreta.
8. Emitir comprobantes válidos según normativa tributaria paraguaya.
9. Integrar pagos con tarjetas, QR, billeteras, pasarelas y POS.
10. Permitir conceptos de venta configurables.
11. Generar reportes por día, cliente, empresa, menú, caja, vendedor, sucursal y forma de pago.
12. Mantener trazabilidad completa de operaciones.

---

## 4. Marco normativo y consideraciones para Paraguay

> **Nota:** Esta sección define lineamientos técnicos y funcionales para diseñar el sistema. La validación legal final debe realizarse con contador, asesor tributario o proveedor certificado de facturación electrónica.

### 4.1. Facturación electrónica y DNIT/SIFEN

El sistema debe estar preparado para emitir documentos tributarios conforme al esquema paraguayo de facturación electrónica. La DNIT informa que existen dos vías para emitir facturas electrónicas: desarrollar un software para remitir comprobantes al SIFEN o usar e-Kuatia'i para pequeños facturadores. Para medianas y grandes empresas, e-Kuatia implica desarrollo de software conforme a especificaciones técnicas de la DNIT para remitir Documentos Electrónicos Tributarios al SIFEN.

**Requisitos funcionales derivados:**

- Configurar RUC del emisor.
- Configurar razón social.
- Configurar nombre de fantasía.
- Configurar establecimiento.
- Configurar punto de expedición.
- Configurar timbrado cuando corresponda.
- Generar factura contado.
- Generar factura crédito.
- Generar nota de crédito.
- Generar nota de débito si aplica.
- Generar documento electrónico tributario mediante proveedor o integración propia.
- Guardar CDC, estado, fecha de aprobación, observación de rechazo y XML/representación gráfica.
- Permitir reintentos controlados si la emisión falla.
- No duplicar facturas por error de conexión.
- Permitir contingencia controlada.

### 4.2. Protección de datos personales

El sistema almacenará datos personales de clientes, funcionarios y usuarios: nombre, documento, RUC, teléfono, correo, dirección, historial de consumo, deuda, pagos y preferencias de notificación. Por tanto, debe aplicar principios de finalidad, minimización, seguridad, trazabilidad y control de acceso.

**Requisitos funcionales derivados:**

- Solicitar solo datos necesarios.
- Mostrar política de privacidad.
- Registrar consentimiento para notificaciones.
- Permitir baja de notificaciones.
- Controlar quién ve datos personales.
- Encriptar datos sensibles cuando corresponda.
- Registrar accesos y modificaciones.
- Evitar exposición de cuentas/deudas a usuarios no autorizados.
- Definir retención de datos.
- Permitir exportación o anonimización cuando aplique.

### 4.3. Pagos electrónicos y POS

El sistema debe admitir pagos electrónicos mediante pasarela online, QR, tarjeta, billetera y POS. Bancard ofrece vPOS para app o web, con pagos por tarjeta de crédito, débito y Zimple, modalidad ocasional o con catastro, además de estándares de seguridad como PCI DSS y 3D Secure. Bancard también ofrece POS Android con QR, WiFi, 4G e impresora. Pagopar documenta un flujo donde el comercio crea un pedido, el cliente es redirigido al checkout, Pagopar notifica el pago y luego redirige al resultado.

**Requisitos funcionales derivados:**

- Registrar pagos online con estado pendiente, aprobado, rechazado, anulado o revertido.
- Confirmar pagos vía webhook.
- Conciliar ventas con transacciones del proveedor.
- No entregar pedido como pagado hasta confirmación válida.
- Soportar pago mixto: parte efectivo, parte POS, parte libreta.
- Soportar pago de deuda mensual desde portal del cliente.
- Integrar POS de forma indirecta si no existe API certificada: registrar referencia/voucher manual.
- Integrar POS de forma directa solo si el proveedor entrega SDK/API oficial por USB, WiFi o red local.

---

## 5. Tipos de usuarios y roles

### 5.1. Roles principales

| Rol | Descripción |
|---|---|
| Superadministrador | Control total del sistema, configuración global y permisos. |
| Administrador del comedor | Administra operación, usuarios, productos, reportes y configuración. |
| Encargado de caja | Realiza ventas, cobros, cierres y anulaciones autorizadas. |
| Cocinero / cocina | Visualiza reservas, producción, pedidos y preparación. |
| Encargado de stock | Administra entradas, salidas, inventario y proveedores. |
| Encargado de menú | Crea y publica menús diarios/semanales. |
| Cobranzas | Gestiona libretas, deuda, pagos mensuales y estados de cuenta. |
| Delivery | Visualiza pedidos para envío y confirma entrega. |
| Cliente | Reserva, compra, consulta deuda, paga y recibe notificaciones. |
| Empresa convenio | Visualiza consumos de sus funcionarios y estados de cuenta. |
| Auditor | Solo lectura de operaciones, cambios y reportes. |

### 5.2. Permisos granulares

El sistema debe tener permisos por módulo y acción:

- `productos.ver`
- `productos.crear`
- `productos.editar`
- `productos.eliminar`
- `menu.publicar`
- `menu.modificar_publicado`
- `ventas.crear`
- `ventas.anular`
- `ventas.descuento`
- `ventas.cambiar_precio`
- `caja.abrir`
- `caja.cerrar`
- `caja.reabrir`
- `libreta.ver`
- `libreta.cargar`
- `libreta.cobrar`
- `libreta.ajustar`
- `stock.entrada`
- `stock.ajuste`
- `facturacion.emitir`
- `facturacion.anular`
- `reportes.financieros`
- `configuracion.general`
- `auditoria.ver`

---

## 6. Módulo de clientes

### 6.1. Datos del cliente

- ID interno.
- Nombre y apellido.
- Razón social.
- Tipo de documento: CI, RUC, pasaporte u otro.
- Número de documento.
- RUC para facturación.
- Teléfono.
- WhatsApp.
- Correo.
- Dirección.
- Empresa/convenio asociado.
- Estado: activo, suspendido, bloqueado, eliminado lógico.
- Límite de crédito para libreta.
- Día de corte.
- Forma de pago preferida.
- Permite notificaciones: sí/no.
- Canal preferido: WhatsApp, email, SMS, push.

### 6.2. Tipos de clientes

- Cliente particular.
- Funcionario interno.
- Cliente de empresa convenio.
- Cliente frecuente.
- Cliente eventual.
- Cliente delivery.
- Cliente con libreta.
- Cliente solo contado.

### 6.3. Estado crediticio

Cada cliente puede tener:

- Sin libreta.
- Libreta activa.
- Libreta suspendida.
- Libreta bloqueada por mora.
- Límite excedido.
- En revisión.

---

## 7. Módulo de conceptos de venta configurables

El sistema debe permitir cambiar, crear y parametrizar conceptos de venta sin tocar código.

### 7.1. Ejemplos de conceptos

- Almuerzo menú económico.
- Almuerzo menú ejecutivo.
- Almuerzo menú especial.
- Cena.
- Desayuno.
- Merienda.
- Vianda.
- Comida por kilo.
- Bebida.
- Postre.
- Ensalada extra.
- Delivery.
- Envase descartable.
- Cubiertos.
- Servicio de comedor.
- Descuento convenio.
- Recargo por delivery.
- Recargo por pago tardío.
- Anticipo de reserva.
- Ajuste de cuenta.

### 7.2. Campos del concepto

- Nombre.
- Código interno.
- Categoría.
- Tipo: producto, servicio, combo, menú, kilo, recargo, descuento, ajuste.
- Aplica IVA: sí/no.
- Tasa IVA: 10%, 5%, exento u otra parametrizable.
- Se factura: sí/no.
- Afecta stock: sí/no.
- Permite descuento: sí/no.
- Permite libreta: sí/no.
- Permite reserva: sí/no.
- Activo/inactivo.
- Cuenta contable sugerida.

---

## 8. Módulo de productos

### 8.1. Tipos de productos

- Producto terminado: milanesa, arroz, ensalada, sopa, guiso.
- Producto de reventa: gaseosa, agua, jugo, postre comprado.
- Insumo: carne, arroz, fideo, aceite, verduras.
- Envase: bandeja, cubierto, vaso, bolsa.
- Servicio: delivery, comedor, recargo.
- Producto por peso: comida por kilo, ensalada por kilo, buffet.

### 8.2. Datos del producto

- Código.
- Código de barra.
- Nombre.
- Descripción.
- Categoría.
- Unidad de medida: unidad, kg, gramo, litro, ml, porción, combo.
- Precio venta.
- Precio por kilo.
- Costo promedio.
- Costo última compra.
- IVA.
- Stock mínimo.
- Stock máximo.
- Controla stock: sí/no.
- Producto visible para cliente: sí/no.
- Producto activo: sí/no.
- Imagen.
- Receta asociada.

---

## 9. Módulo de menú

### 9.1. Objetivo

Permitir publicar el menú del día o de la semana para que los clientes puedan comprar o reservar.

### 9.2. Tipos de menú

- Menú del día.
- Menú semanal.
- Menú por horario: desayuno, almuerzo, cena.
- Menú por sucursal.
- Menú por empresa/convenio.
- Menú público.
- Menú privado para clientes registrados.
- Menú con cupo limitado.
- Menú con reserva obligatoria.

### 9.3. Datos del menú

- Fecha.
- Sucursal.
- Título.
- Descripción.
- Foto.
- Categoría.
- Precio.
- Precio convenio.
- Precio libreta.
- Cupo total.
- Cupo reservado.
- Cupo disponible.
- Hora límite de reserva.
- Hora estimada de entrega/retiro.
- Estado: borrador, publicado, cerrado, agotado, cancelado.
- Productos incluidos.
- Opciones: entrada, plato principal, guarnición, bebida, postre.
- Permite modificación: sí/no.
- Permite observación del cliente: sí/no.

### 9.4. Publicación de menú

El encargado puede:

1. Crear menú en borrador.
2. Cargar platos disponibles.
3. Definir precios.
4. Definir cupos.
5. Definir fecha y horario límite.
6. Publicar.
7. Enviar notificación a clientes.
8. Cerrar reservas automáticamente cuando se cumpla la hora límite.

---

## 10. Módulo de reservas

### 10.1. Flujo de reserva

1. Cliente ingresa al portal o recibe menú por WhatsApp/correo.
2. Selecciona menú.
3. Selecciona cantidad.
4. Elige retiro, mesa, delivery o consumo en comedor.
5. Agrega observaciones.
6. Define forma de pago: ahora, al retirar, libreta o empresa.
7. El sistema valida cupo.
8. El sistema registra reserva.
9. Se descuenta cupo disponible.
10. Cocina recibe la reserva.
11. Cliente recibe confirmación.

### 10.2. Estados de reserva

- Pendiente.
- Confirmada.
- En preparación.
- Lista para retirar.
- Entregada.
- Cancelada por cliente.
- Cancelada por comedor.
- No retirada.
- Facturada.

### 10.3. Reglas de reserva

- No permitir reservas si el menú está agotado.
- No permitir reservas después de la hora límite, salvo permiso especial.
- Permitir cupos por cliente.
- Permitir cupos por empresa.
- Permitir cancelación hasta una hora determinada.
- Si la reserva fue pagada, generar nota de crédito o saldo a favor según política.
- Si la reserva va a libreta, cargarla al entregar o al confirmar, según configuración.

---

## 11. Módulo de ventas

### 11.1. Venta rápida de mostrador

Funciones:

- Buscar producto.
- Escanear código de barra.
- Agregar menú del día.
- Agregar venta por kilo.
- Aplicar descuento autorizado.
- Seleccionar cliente.
- Seleccionar forma de pago.
- Emitir comprobante.
- Imprimir ticket interno.
- Enviar comprobante por WhatsApp/email.

### 11.2. Venta por menú

- Seleccionar menú publicado.
- Validar disponibilidad.
- Definir cantidad.
- Asociar cliente opcional.
- Cobrar contado, POS, online o libreta.
- Generar movimiento de stock según receta.

### 11.3. Venta por kilo

Debe ser configurable:

- Habilitar/deshabilitar venta por kilo.
- Precio por kilo por categoría.
- Precio por kilo por horario.
- Precio por kilo por sucursal.
- Integración con balanza por lectura manual.
- Integración futura con balanza USB/serial si existe driver compatible.

Campos de venta por kilo:

- Producto base: comida por kilo.
- Peso en kg.
- Precio por kg.
- Subtotal calculado.
- Envase opcional.
- Descuento opcional.

Fórmula:

```text
subtotal = peso_kg * precio_por_kg
```

Ejemplo:

```text
0,750 kg * Gs. 45.000 = Gs. 33.750
```

### 11.4. Estados de venta

- Borrador.
- Confirmada.
- Pagada.
- Pendiente de pago.
- Cargada a libreta.
- Facturada.
- Anulada.
- Reembolsada.
- Parcialmente pagada.

---

## 12. Módulo de libreta / cuenta mensual

### 12.1. Objetivo

Permitir que clientes, funcionarios o empresas consuman durante el mes y paguen posteriormente. Cada consumo queda registrado en su cuenta.

### 12.2. Concepto de libreta

La libreta funciona como una **cuenta corriente de consumo**. Cada venta no pagada al contado queda como cargo pendiente. Al final del periodo, el sistema genera un estado de cuenta y permite cobrar total o parcialmente.

### 12.3. Tipos de libreta

- Libreta individual.
- Libreta familiar.
- Libreta por funcionario.
- Libreta por empresa.
- Libreta por convenio.
- Libreta prepaga con saldo.
- Libreta postpaga con límite.

### 12.4. Datos de libreta

- Cliente titular.
- Empresa asociada.
- Límite de crédito.
- Saldo actual.
- Saldo vencido.
- Fecha de corte.
- Fecha de vencimiento.
- Estado.
- Responsable de pago.
- Condición: contado diferido, crédito mensual, convenio.

### 12.5. Movimientos de libreta

Tipos de movimiento:

- Cargo por venta.
- Cargo por reserva entregada.
- Pago.
- Anulación.
- Nota de crédito.
- Ajuste positivo.
- Ajuste negativo.
- Recargo.
- Descuento.
- Saldo inicial.

### 12.6. Estado de cuenta mensual

Debe mostrar:

- Cliente.
- Periodo.
- Saldo anterior.
- Consumos del periodo.
- Pagos del periodo.
- Ajustes.
- Total a pagar.
- Detalle por fecha.
- Detalle por ticket/factura.
- Forma de pago.
- Estado: pendiente, parcial, pagado, vencido.

### 12.7. Reglas de bloqueo

- Bloquear nuevas ventas a libreta si excede límite.
- Bloquear si tiene deuda vencida mayor a X días.
- Permitir autorización especial por administrador.
- Registrar auditoría de autorización.

---

## 13. Módulo de mercaderías, compras y stock

### 13.1. Entrada de mercaderías

El sistema debe registrar la compra o recepción de insumos.

Datos:

- Proveedor.
- Fecha.
- Nro. de factura del proveedor.
- Timbrado del proveedor si aplica.
- Producto/insumo.
- Cantidad.
- Unidad.
- Costo unitario.
- IVA.
- Lote.
- Vencimiento.
- Depósito.
- Usuario que registra.

### 13.2. Movimientos de stock

- Entrada por compra.
- Entrada por ajuste.
- Salida por venta.
- Salida por receta.
- Salida por merma.
- Salida por vencimiento.
- Transferencia entre depósitos.
- Devolución a proveedor.
- Devolución de cliente.

### 13.3. Inventario

Funciones:

- Stock actual.
- Kardex por producto.
- Stock mínimo.
- Alertas de reposición.
- Inventario físico.
- Ajuste con autorización.
- Valorización por costo promedio.
- Reporte de merma.

### 13.4. Recetas y consumo automático

Una receta define qué insumos se consumen al vender un menú o producto.

Ejemplo:

```text
Menú: Milanesa con arroz
- Carne vacuna: 0,180 kg
- Pan rallado: 0,030 kg
- Huevo: 0,25 unidad
- Arroz: 0,120 kg
- Aceite: 0,015 litro
- Ensalada: 0,080 kg
```

Al vender 10 menús, el sistema descuenta automáticamente las cantidades multiplicadas por 10.

---

## 14. Módulo de cocina y producción

### 14.1. Panel de cocina

Debe mostrar:

- Menús del día.
- Reservas confirmadas.
- Cantidades por plato.
- Pedidos pendientes.
- Pedidos en preparación.
- Pedidos listos.
- Observaciones especiales.
- Horarios de entrega.

### 14.2. Producción sugerida

El sistema debe calcular:

```text
producción_sugerida = reservas_confirmadas + ventas_promedio_estimadas + margen_seguridad
```

Ejemplo:

```text
Reservas confirmadas: 80
Promedio ventas sin reserva: 25
Margen seguridad: 10%
Producción sugerida: 116 porciones
```

### 14.3. Estados internos de preparación

- Pendiente.
- En cocina.
- Preparado.
- Empaquetado.
- Listo para retirar.
- Entregado.

---

## 15. Módulo de pagos

### 15.1. Formas de pago

- Efectivo.
- Tarjeta crédito.
- Tarjeta débito.
- QR.
- Billetera.
- Transferencia bancaria.
- POS físico.
- Pasarela online.
- Pago mixto.
- Libreta.
- Saldo a favor.
- Convenio empresa.

### 15.2. Pago online

Flujo recomendado:

1. Sistema genera orden de pago.
2. Sistema envía monto, referencia y datos del cliente a pasarela.
3. Cliente paga.
4. Pasarela envía webhook.
5. Sistema valida firma/token del webhook.
6. Sistema marca el pago como aprobado.
7. Sistema emite comprobante o habilita entrega.

### 15.3. Pago con POS físico

#### Opción A: registro manual asistido

Se usa cuando el POS no tiene API oficial disponible.

- Cajero selecciona forma de pago POS.
- Cobra en el POS externo.
- Ingresa número de voucher/autorización.
- Sistema guarda referencia.
- Se imprime ticket interno.

#### Opción B: integración directa por API/SDK

Se usa solo si el proveedor entrega API, SDK o protocolo oficial.

Posibles medios:

- USB.
- WiFi/red local.
- Bluetooth.
- API cloud.
- SmartPOS Android.

Requisitos:

- Token seguro.
- Identificador de terminal.
- Monto enviado desde el sistema.
- Respuesta automática: aprobado/rechazado.
- Nro. de autorización.
- Marca/tipo de tarjeta si el proveedor lo permite.
- Conciliación.

### 15.4. Pago de libreta mensual

El cliente puede pagar:

- Total del mes.
- Monto parcial.
- Facturas seleccionadas.
- Deuda vencida.
- Anticipo.

El sistema debe aplicar pagos por prioridad:

1. Deuda vencida más antigua.
2. Cargos del periodo actual.
3. Saldo futuro o anticipo.

---

## 16. Facturación y comprobantes

### 16.1. Tipos de documentos

- Factura contado.
- Factura crédito.
- Nota de crédito.
- Nota de débito.
- Ticket interno no fiscal.
- Recibo de dinero.
- Estado de cuenta.
- Comprobante de reserva.
- Orden de cocina.

### 16.2. Cuándo facturar

Configurable:

- Facturar en cada venta.
- Facturar al cierre diario.
- Facturar al cierre mensual de libreta.
- Facturar solo al cobrar.
- Facturar por empresa consolidada.

### 16.3. Facturación de libreta

Opciones:

1. **Factura por cada consumo:** útil para venta directa individual.
2. **Factura mensual consolidada:** útil para empresas o clientes con cuenta corriente.
3. **Factura al momento del pago:** útil si se configura libreta como crédito.

Debe definirse con el contador del negocio para alinearse con normativa tributaria y operación real.

### 16.4. Datos mínimos para factura

- RUC o CI del cliente.
- Razón social o nombre.
- Condición: contado/crédito.
- Fecha.
- Conceptos.
- Cantidad.
- Precio unitario.
- IVA.
- Total.
- Medio de pago.
- CDC si es electrónico.
- Estado SIFEN.

---

## 17. Notificaciones

### 17.1. Canales

- WhatsApp.
- Correo electrónico.
- SMS.
- Push web/PWA.
- Notificación interna.

### 17.2. Eventos notificables

- Menú publicado.
- Reserva confirmada.
- Reserva cancelada.
- Pedido listo.
- Delivery en camino.
- Factura emitida.
- Estado de cuenta generado.
- Deuda próxima a vencer.
- Deuda vencida.
- Pago recibido.
- Promoción del día.

### 17.3. Plantillas editables

Cada notificación debe tener plantilla configurable.

Ejemplo WhatsApp:

```text
Hola {{cliente_nombre}}, el menú de hoy es:
{{menu_descripcion}}
Precio: Gs. {{precio}}
Reservá hasta las {{hora_limite}}.
Link: {{link_reserva}}
```

Ejemplo estado de cuenta:

```text
Hola {{cliente_nombre}}, tu estado de cuenta del periodo {{periodo}} es de Gs. {{total}}.
Podés pagar desde este enlace: {{link_pago}}
```

---

## 18. Configuración general

### 18.1. Parámetros del negocio

- Nombre comercial.
- Razón social.
- RUC.
- Dirección.
- Teléfono.
- Logo.
- Moneda.
- Sucursales.
- Cajas.
- Puntos de expedición.
- Horarios.
- Política de reservas.
- Política de cancelación.
- Política de libreta.
- Política de facturación.
- Canales de notificación.

### 18.2. Parámetros de venta por kilo

- Habilitar venta por kilo.
- Precio por kg default.
- Precio por kg por categoría.
- Redondeo de peso.
- Redondeo de importe.
- Tara/envase.
- Balanza manual o integrada.

### 18.3. Parámetros de libreta

- Habilitar libreta.
- Límite por defecto.
- Día de corte.
- Día de vencimiento.
- Bloqueo automático.
- Interés/recargo por mora.
- Permitir pago parcial.
- Permitir consumo con deuda vencida.

---

## 19. Arquitectura funcional

```mermaid
flowchart TD
    A[Cliente] --> B[Portal Cliente / PWA]
    B --> C[Reservas y Pedidos]
    C --> D[Menú Publicado]
    C --> E[Cocina]
    C --> F[Caja / Venta]
    F --> G[Pagos]
    G --> H[POS / QR / Pasarela]
    F --> I[Facturación]
    I --> J[SIFEN / Proveedor de Facturación]
    F --> K[Libreta]
    K --> L[Cobranzas]
    F --> M[Stock]
    M --> N[Mercaderías / Compras]
    O[Administrador] --> D
    O --> M
    O --> P[Reportes]
```

---

## 20. Arquitectura técnica recomendada

### 20.1. Stack recomendado

#### Frontend

- React.
- TypeScript.
- Tailwind CSS.
- PWA para uso móvil.
- Panel responsive para tablets y celulares.

#### Backend

- Node.js con NestJS o Express estructurado.
- Alternativa: Laravel si se prefiere PHP.
- API REST o GraphQL.
- Webhooks para pagos y facturación.

#### Base de datos

- PostgreSQL recomendado.
- Alternativa: MySQL/MariaDB.
- Redis para colas, sesiones o notificaciones.

#### Infraestructura

- Docker.
- Nginx como reverse proxy.
- SSL/TLS obligatorio.
- Backups automáticos.
- Logs centralizados.

#### Integraciones

- Pasarela de pago: Bancard vPOS, Pagopar u otra.
- POS: integración manual o SDK/API oficial.
- Facturación: SIFEN directo o proveedor habilitado.
- WhatsApp: API oficial, WAHA, proveedor BSP o gateway autorizado.
- Email: SMTP empresarial.
- SMS: proveedor local.

---

## 21. Modelo de base de datos propuesto

### 21.1. Tablas principales

```text
usuarios
roles
permisos
rol_permisos
sucursales
cajas
clientes
empresas
cliente_empresas
productos
categorias_producto
conceptos_venta
menus
menu_items
reservas
reserva_items
ventas
venta_items
pagos
facturas
factura_items
libretas
libreta_movimientos
proveedores
compras
compra_items
stock_movimientos
recetas
receta_items
notificaciones
plantillas_notificacion
auditoria
configuraciones
```

### 21.2. Tabla clientes

```sql
CREATE TABLE clientes (
    id BIGSERIAL PRIMARY KEY,
    tipo_cliente VARCHAR(30) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    razon_social VARCHAR(150),
    documento_tipo VARCHAR(20),
    documento_numero VARCHAR(30),
    ruc VARCHAR(30),
    telefono VARCHAR(30),
    whatsapp VARCHAR(30),
    email VARCHAR(150),
    direccion TEXT,
    permite_notificaciones BOOLEAN DEFAULT TRUE,
    canal_preferido VARCHAR(30),
    estado VARCHAR(30) DEFAULT 'ACTIVO',
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);
```

### 21.3. Tabla productos

```sql
CREATE TABLE productos (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    categoria_id BIGINT,
    unidad_medida VARCHAR(20) NOT NULL,
    precio_venta NUMERIC(14,2) DEFAULT 0,
    precio_por_kg NUMERIC(14,2),
    costo_promedio NUMERIC(14,2) DEFAULT 0,
    iva_porcentaje NUMERIC(5,2) DEFAULT 10,
    controla_stock BOOLEAN DEFAULT TRUE,
    venta_por_kilo BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT NOW()
);
```

### 21.4. Tabla menús

```sql
CREATE TABLE menus (
    id BIGSERIAL PRIMARY KEY,
    sucursal_id BIGINT NOT NULL,
    fecha DATE NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(14,2) NOT NULL,
    cupo_total INTEGER,
    cupo_reservado INTEGER DEFAULT 0,
    hora_limite_reserva TIME,
    estado VARCHAR(30) DEFAULT 'BORRADOR',
    publicado_en TIMESTAMP,
    creado_por BIGINT,
    creado_en TIMESTAMP DEFAULT NOW()
);
```

### 21.5. Tabla reservas

```sql
CREATE TABLE reservas (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL,
    menu_id BIGINT NOT NULL,
    sucursal_id BIGINT NOT NULL,
    cantidad INTEGER NOT NULL,
    tipo_entrega VARCHAR(30),
    observacion TEXT,
    estado VARCHAR(30) DEFAULT 'PENDIENTE',
    forma_pago_prevista VARCHAR(30),
    total NUMERIC(14,2) NOT NULL,
    venta_id BIGINT,
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);
```

### 21.6. Tabla ventas

```sql
CREATE TABLE ventas (
    id BIGSERIAL PRIMARY KEY,
    sucursal_id BIGINT NOT NULL,
    caja_id BIGINT,
    cliente_id BIGINT,
    usuario_id BIGINT NOT NULL,
    tipo_venta VARCHAR(30) NOT NULL,
    estado VARCHAR(30) DEFAULT 'CONFIRMADA',
    condicion_pago VARCHAR(30) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL,
    descuento NUMERIC(14,2) DEFAULT 0,
    iva_total NUMERIC(14,2) DEFAULT 0,
    total NUMERIC(14,2) NOT NULL,
    facturada BOOLEAN DEFAULT FALSE,
    cargada_libreta BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT NOW()
);
```

### 21.7. Tabla venta_items

```sql
CREATE TABLE venta_items (
    id BIGSERIAL PRIMARY KEY,
    venta_id BIGINT NOT NULL,
    producto_id BIGINT,
    concepto_id BIGINT,
    descripcion VARCHAR(200) NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL,
    precio_unitario NUMERIC(14,2) NOT NULL,
    iva_porcentaje NUMERIC(5,2) DEFAULT 10,
    subtotal NUMERIC(14,2) NOT NULL,
    total NUMERIC(14,2) NOT NULL
);
```

### 21.8. Tabla libretas

```sql
CREATE TABLE libretas (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT,
    empresa_id BIGINT,
    tipo VARCHAR(30) NOT NULL,
    limite_credito NUMERIC(14,2) DEFAULT 0,
    saldo_actual NUMERIC(14,2) DEFAULT 0,
    saldo_vencido NUMERIC(14,2) DEFAULT 0,
    dia_corte INTEGER DEFAULT 30,
    dia_vencimiento INTEGER DEFAULT 10,
    estado VARCHAR(30) DEFAULT 'ACTIVA',
    creado_en TIMESTAMP DEFAULT NOW()
);
```

### 21.9. Tabla libreta_movimientos

```sql
CREATE TABLE libreta_movimientos (
    id BIGSERIAL PRIMARY KEY,
    libreta_id BIGINT NOT NULL,
    venta_id BIGINT,
    pago_id BIGINT,
    tipo_movimiento VARCHAR(30) NOT NULL,
    descripcion TEXT,
    monto_debe NUMERIC(14,2) DEFAULT 0,
    monto_haber NUMERIC(14,2) DEFAULT 0,
    saldo_resultante NUMERIC(14,2) NOT NULL,
    fecha_movimiento TIMESTAMP DEFAULT NOW(),
    usuario_id BIGINT
);
```

### 21.10. Tabla pagos

```sql
CREATE TABLE pagos (
    id BIGSERIAL PRIMARY KEY,
    venta_id BIGINT,
    cliente_id BIGINT,
    libreta_id BIGINT,
    forma_pago VARCHAR(30) NOT NULL,
    proveedor_pago VARCHAR(50),
    monto NUMERIC(14,2) NOT NULL,
    estado VARCHAR(30) DEFAULT 'PENDIENTE',
    referencia_externa VARCHAR(150),
    voucher VARCHAR(100),
    autorizacion VARCHAR(100),
    fecha_pago TIMESTAMP,
    creado_en TIMESTAMP DEFAULT NOW()
);
```

### 21.11. Tabla stock_movimientos

```sql
CREATE TABLE stock_movimientos (
    id BIGSERIAL PRIMARY KEY,
    producto_id BIGINT NOT NULL,
    sucursal_id BIGINT NOT NULL,
    deposito_id BIGINT,
    tipo_movimiento VARCHAR(30) NOT NULL,
    referencia_tipo VARCHAR(30),
    referencia_id BIGINT,
    cantidad NUMERIC(14,3) NOT NULL,
    costo_unitario NUMERIC(14,2),
    observacion TEXT,
    usuario_id BIGINT,
    creado_en TIMESTAMP DEFAULT NOW()
);
```

---

## 22. API funcional propuesta

### 22.1. Autenticación

```http
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/me
```

### 22.2. Clientes

```http
GET    /api/clientes
POST   /api/clientes
GET    /api/clientes/{id}
PUT    /api/clientes/{id}
DELETE /api/clientes/{id}
GET    /api/clientes/{id}/estado-cuenta
GET    /api/clientes/{id}/reservas
GET    /api/clientes/{id}/ventas
```

### 22.3. Menús

```http
GET  /api/menus
POST /api/menus
GET  /api/menus/{id}
PUT  /api/menus/{id}
POST /api/menus/{id}/publicar
POST /api/menus/{id}/cerrar
POST /api/menus/{id}/notificar
```

### 22.4. Reservas

```http
GET  /api/reservas
POST /api/reservas
GET  /api/reservas/{id}
PUT  /api/reservas/{id}/estado
POST /api/reservas/{id}/cancelar
POST /api/reservas/{id}/convertir-venta
```

### 22.5. Ventas

```http
GET  /api/ventas
POST /api/ventas
GET  /api/ventas/{id}
POST /api/ventas/{id}/pagar
POST /api/ventas/{id}/facturar
POST /api/ventas/{id}/anular
POST /api/ventas/por-kilo
POST /api/ventas/cargar-libreta
```

### 22.6. Libreta

```http
GET  /api/libretas
POST /api/libretas
GET  /api/libretas/{id}
GET  /api/libretas/{id}/movimientos
POST /api/libretas/{id}/pago
POST /api/libretas/{id}/ajuste
POST /api/libretas/{id}/cerrar-periodo
GET  /api/libretas/{id}/estado-cuenta/pdf
```

### 22.7. Stock

```http
GET  /api/productos
POST /api/productos
GET  /api/stock
GET  /api/stock/kardex/{productoId}
POST /api/stock/entrada
POST /api/stock/ajuste
POST /api/stock/merma
```

### 22.8. Pagos

```http
POST /api/pagos/orden
POST /api/pagos/webhook/bancard
POST /api/pagos/webhook/pagopar
POST /api/pagos/pos/manual
GET  /api/pagos/conciliacion
```

---

## 23. Flujos críticos

### 23.1. Flujo: publicar menú y recibir reservas

```mermaid
sequenceDiagram
    actor Admin
    actor Cliente
    participant Sistema
    participant Cocina
    participant Notificador

    Admin->>Sistema: Crea menú del día
    Admin->>Sistema: Define precio, cupo y hora límite
    Admin->>Sistema: Publica menú
    Sistema->>Notificador: Envía menú a clientes
    Cliente->>Sistema: Reserva comida
    Sistema->>Sistema: Valida cupo y horario
    Sistema->>Cocina: Envía reserva confirmada
    Sistema->>Cliente: Confirma reserva
```

### 23.2. Flujo: venta a libreta

```mermaid
sequenceDiagram
    actor Cajero
    participant Sistema
    participant Libreta
    participant Stock

    Cajero->>Sistema: Selecciona cliente
    Cajero->>Sistema: Registra venta
    Sistema->>Libreta: Valida estado y límite
    Libreta-->>Sistema: Aprobado
    Sistema->>Stock: Descuenta insumos/productos
    Sistema->>Libreta: Carga movimiento debe
    Sistema->>Sistema: Genera ticket/comprobante
```

### 23.3. Flujo: pago mensual de libreta

```mermaid
sequenceDiagram
    actor Cliente
    participant Portal
    participant Sistema
    participant Pasarela
    participant Libreta

    Cliente->>Portal: Consulta estado de cuenta
    Portal->>Sistema: Solicita deuda
    Sistema-->>Portal: Retorna total pendiente
    Cliente->>Portal: Paga online
    Portal->>Pasarela: Crea orden de pago
    Pasarela-->>Sistema: Webhook aprobado
    Sistema->>Libreta: Registra pago
    Sistema->>Cliente: Envía recibo
```

---

## 24. Pantallas necesarias

### 24.1. Panel administrador

- Dashboard general.
- Ventas del día.
- Reservas del día.
- Menús publicados.
- Stock crítico.
- Deudas vencidas.
- Pagos pendientes.
- Estado de facturación.

### 24.2. Caja

- Venta rápida.
- Menú del día.
- Venta por kilo.
- Buscar cliente.
- Cargar a libreta.
- Cobrar.
- Imprimir ticket.
- Cierre de caja.

### 24.3. Cocina

- Pedidos pendientes.
- Reservas confirmadas.
- Producción sugerida.
- Marcar como preparado.
- Marcar como entregado.

### 24.4. Portal del cliente

- Ver menú del día.
- Reservar comida.
- Ver mis reservas.
- Ver mis consumos.
- Ver mi deuda.
- Pagar online.
- Descargar factura/recibo.
- Configurar notificaciones.

### 24.5. Cobranzas

- Cuentas pendientes.
- Deudas vencidas.
- Estado de cuenta.
- Cobro parcial.
- Cobro total.
- Envío masivo de recordatorios.
- Bloqueo/desbloqueo de libreta.

---

## 25. Reportes

### 25.1. Reportes de ventas

- Ventas por fecha.
- Ventas por menú.
- Ventas por producto.
- Ventas por kilo.
- Ventas por cliente.
- Ventas por empresa.
- Ventas por cajero.
- Ventas por forma de pago.
- Ventas anuladas.
- Descuentos otorgados.

### 25.2. Reportes de stock

- Stock actual.
- Kardex.
- Stock mínimo.
- Compras por proveedor.
- Mermas.
- Costo de producción.
- Rentabilidad por menú.

### 25.3. Reportes de libreta

- Deuda por cliente.
- Deuda por empresa.
- Estado de cuenta mensual.
- Pagos recibidos.
- Mora.
- Límite excedido.
- Consumo promedio por cliente.

### 25.4. Reportes de cocina

- Reservas por día.
- Menús más vendidos.
- Producción sugerida vs real.
- Desperdicio estimado.
- Pedidos no retirados.

### 25.5. Reportes tributarios

- Facturas emitidas.
- Facturas pendientes de emisión.
- Facturas rechazadas.
- Notas de crédito.
- IVA por periodo.
- Totales por condición contado/crédito.

---

## 26. Seguridad y auditoría

### 26.1. Seguridad

- HTTPS obligatorio.
- Contraseñas con hash seguro.
- Autenticación JWT o sesiones seguras.
- Refresh tokens protegidos.
- Roles y permisos.
- Bloqueo por intentos fallidos.
- 2FA opcional para administradores.
- Validación de inputs.
- Protección CSRF si aplica.
- Protección contra SQL injection.
- Logs de acceso.
- Backups cifrados.

### 26.2. Auditoría

Registrar:

- Inicio de sesión.
- Creación/modificación de productos.
- Cambios de precio.
- Publicación de menú.
- Anulación de venta.
- Descuento manual.
- Carga a libreta.
- Ajuste de libreta.
- Ajuste de stock.
- Emisión/anulación de comprobante.
- Cambio de configuración.

Campos mínimos:

- Usuario.
- Fecha/hora.
- Módulo.
- Acción.
- Registro afectado.
- Valor anterior.
- Valor nuevo.
- IP/dispositivo.

---

## 27. Reglas de negocio clave

1. Una venta anulada debe revertir stock, libreta y pago si corresponde.
2. Una reserva cancelada debe liberar cupo.
3. Una reserva entregada debe convertirse en venta.
4. Una venta por libreta debe validar límite y estado del cliente.
5. Un pago online no debe marcarse como aprobado sin webhook válido.
6. Una factura electrónica rechazada no debe darse como fiscalmente aprobada.
7. Una venta facturada no debe modificarse directamente; debe corregirse con nota de crédito o anulación conforme al procedimiento tributario.
8. Un cierre de caja no debe permitir nuevas ventas en esa caja cerrada.
9. Un ajuste de stock debe requerir motivo y permiso.
10. Un cambio de precio debe quedar auditado.
11. El menú publicado puede bloquear modificaciones o requerir permiso especial.
12. La venta por kilo debe guardar peso, precio por kilo y subtotal calculado.
13. La libreta debe permitir trazabilidad desde cada cargo hasta la venta original.
14. Los conceptos de venta deben ser parametrizables.
15. Los impuestos deben ser configurables por concepto/producto.

---

## 28. Roadmap de implementación

### Fase 1: Núcleo operativo

- Usuarios, roles y permisos.
- Productos y categorías.
- Clientes.
- Menú diario.
- Reservas.
- Venta rápida.
- Caja.
- Pago efectivo/manual.
- Reportes básicos.

### Fase 2: Stock y cocina

- Proveedores.
- Entrada de mercaderías.
- Stock.
- Recetas.
- Descuento automático.
- Panel de cocina.
- Producción sugerida.

### Fase 3: Libreta y cobranzas

- Libretas individuales.
- Libretas por empresa.
- Estados de cuenta.
- Pagos parciales.
- Bloqueo por mora.
- Recordatorios automáticos.

### Fase 4: Pagos e integraciones

- Pasarela online.
- Webhooks.
- POS manual.
- POS integrado si el proveedor entrega API.
- Conciliación.

### Fase 5: Facturación Paraguay

- Configuración tributaria.
- Factura contado/crédito.
- Integración SIFEN/proveedor.
- Estados de DTE.
- Notas de crédito.
- Representación gráfica.

### Fase 6: Portal cliente y PWA

- Portal de menú.
- Reservas online.
- Pago de deuda.
- Descarga de comprobantes.
- Notificaciones push.

### Fase 7: Optimización

- Predicción de demanda.
- Rentabilidad por menú.
- App móvil.
- Integración con balanza.
- Integración contable.

---

## 29. MVP recomendado

Para iniciar rápido sin perder escalabilidad, el MVP debe incluir:

1. Login y roles.
2. Clientes.
3. Productos.
4. Menú del día.
5. Reservas.
6. Venta en caja.
7. Venta por kilo manual.
8. Carga a libreta.
9. Cobro de libreta.
10. Reporte diario.
11. Entrada básica de mercadería.
12. Stock básico.
13. Notificación manual por WhatsApp.
14. Configuración de conceptos de venta.

Luego se agregan facturación electrónica, pagos online, POS integrado y automatización avanzada.

---

## 30. Recomendaciones específicas para desarrollo

### 30.1. No hardcodear reglas

Todo lo siguiente debe ser configurable:

- IVA.
- Conceptos de venta.
- Precio por kilo.
- Horario límite de reserva.
- Límite de libreta.
- Día de corte.
- Canales de notificación.
- Formas de pago.
- Tipo de facturación.

### 30.2. Diseñar para operación offline parcial

En comedores reales puede fallar internet. Se recomienda:

- Caja local con sincronización posterior, si el contexto lo exige.
- Modo contingencia para ventas internas.
- Cola de facturación.
- Cola de notificaciones.
- Reintento de pagos/facturas.

### 30.3. Separar ticket interno de factura fiscal

No toda impresión interna debe ser factura. El sistema debe diferenciar:

- Ticket de cocina.
- Ticket de caja.
- Recibo interno.
- Factura legal.
- Estado de cuenta.

### 30.4. Diseñar la libreta como ledger

La libreta no debe ser solo un campo `saldo`. Debe tener movimientos contables inmutables:

- Debe.
- Haber.
- Saldo resultante.
- Referencia a venta/pago/ajuste.

Esto evita inconsistencias y permite auditoría.

---

## 31. Checklist de validación antes de producción

### Funcional

- [ ] Crear cliente.
- [ ] Crear producto.
- [ ] Crear concepto de venta.
- [ ] Publicar menú.
- [ ] Reservar menú.
- [ ] Vender menú.
- [ ] Vender por kilo.
- [ ] Cargar venta a libreta.
- [ ] Cobrar libreta.
- [ ] Anular venta.
- [ ] Ajustar stock.
- [ ] Cerrar caja.
- [ ] Generar reporte diario.

### Tributario

- [ ] Configurar RUC.
- [ ] Configurar establecimiento.
- [ ] Configurar punto de expedición.
- [ ] Configurar tipo de comprobante.
- [ ] Validar factura contado.
- [ ] Validar factura crédito.
- [ ] Validar nota de crédito.
- [ ] Guardar CDC/estado si es electrónico.
- [ ] Manejar rechazo.

### Pagos

- [ ] Pago efectivo.
- [ ] Pago POS manual.
- [ ] Pago transferencia.
- [ ] Pago QR/pasarela.
- [ ] Webhook aprobado.
- [ ] Webhook rechazado.
- [ ] Conciliación.

### Seguridad

- [ ] HTTPS.
- [ ] Roles.
- [ ] Permisos.
- [ ] Auditoría.
- [ ] Backup.
- [ ] Políticas de privacidad.
- [ ] Control de acceso a datos personales.

---

## 32. Estructura sugerida de proyecto

```text
comedor-system/
├── apps/
│   ├── web-admin/
│   ├── web-cliente/
│   └── api/
├── packages/
│   ├── database/
│   ├── shared/
│   ├── validators/
│   └── ui/
├── docker/
│   ├── nginx/
│   └── postgres/
├── docs/
│   ├── arquitectura.md
│   ├── api.md
│   ├── base-datos.md
│   ├── facturacion-paraguay.md
│   └── pagos-pos.md
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 33. Variables de entorno sugeridas

```env
APP_ENV=production
APP_URL=https://comedor.midominio.com
API_URL=https://api-comedor.midominio.com
DATABASE_URL=postgresql://usuario:password@localhost:5432/comedor
REDIS_URL=redis://localhost:6379
JWT_SECRET=CAMBIAR_SECRET
JWT_REFRESH_SECRET=CAMBIAR_REFRESH_SECRET

BUSINESS_RUC=80000000-0
BUSINESS_NAME=MI COMEDOR S.A.
BUSINESS_BRANCH=001
BUSINESS_EXPEDITION_POINT=001

PAYMENT_PROVIDER=bancard
BANCARD_PUBLIC_KEY=
BANCARD_PRIVATE_KEY=
BANCARD_WEBHOOK_SECRET=

PAGOPAR_PUBLIC_KEY=
PAGOPAR_PRIVATE_KEY=

SIFEN_PROVIDER=
SIFEN_API_URL=
SIFEN_TOKEN=

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

WHATSAPP_PROVIDER=waha
WAHA_API_URL=
WAHA_API_KEY=
```

---

## 34. Criterios de aceptación del sistema

El sistema se considera funcionalmente completo cuando puede:

1. Registrar productos, insumos y conceptos de venta.
2. Publicar menú diario/semanal.
3. Enviar menú a clientes.
4. Recibir reservas.
5. Controlar cupos.
6. Mostrar reservas en cocina.
7. Vender en caja.
8. Vender por kilo.
9. Registrar pagos.
10. Cargar consumos a libreta.
11. Cobrar estados de cuenta.
12. Registrar entradas de mercadería.
13. Descontar stock.
14. Emitir comprobantes.
15. Integrarse con facturación electrónica o proveedor autorizado.
16. Integrarse con pagos digitales.
17. Registrar POS manual o automático.
18. Generar reportes.
19. Auditar cambios críticos.
20. Proteger datos personales.

---

## 35. Fuentes consultadas para lineamientos Paraguay

- DNIT — Factura Electrónica / SIFEN: https://www.dnit.gov.py/web/portal-institucional/factura-electronica
- DNIT — e-Kuatia: https://www.dnit.gov.py/web/e-kuatia
- BACN — Ley N.º 7593/2025 de Protección de Datos Personales en Paraguay: https://www.bacn.gov.py/leyes-paraguayas/12924/ley-n-7593-2025-de-protecci-n-de-datos-personales-en-la-rep-blica-del-paraguay
- Bancard — vPOS: https://www.bancard.com.py/vpos
- Bancard — POS: https://www.bancard.com.py/pos
- Pagopar — API integración medios de pago: https://soporte.pagopar.com/portal/es/kb/articles/api-integracion-medios-pagos

---

## 36. Conclusión

Este sistema debe construirse como una plataforma modular para comedor, no como una caja simple. La diferencia clave está en manejar correctamente cuatro ejes: **menú/reserva**, **venta/caja**, **stock/producción** y **libreta/cobranzas**. Sobre esos ejes se integran pagos, facturación electrónica, notificaciones y reportes.

La recomendación técnica es iniciar con un MVP sólido, diseñando desde el principio la base de datos, permisos, auditoría y libreta como componentes escalables. Posteriormente se agregan integraciones complejas como SIFEN, pagos online, POS por API, balanza y automatización avanzada.
