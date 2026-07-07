-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "modulo" VARCHAR(50) NOT NULL,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permisos" (
    "rol_id" INTEGER NOT NULL,
    "permiso_id" INTEGER NOT NULL,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "sucursales" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "direccion" VARCHAR(255),
    "telefono" VARCHAR(30),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "sucursal_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cajas" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "sucursal_id" INTEGER NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'CERRADA',
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cajas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "tipo_cliente" VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL',
    "nombre" VARCHAR(100) NOT NULL,
    "razon_social" VARCHAR(200),
    "documento_tipo" VARCHAR(20),
    "documento_numero" VARCHAR(30),
    "ruc" VARCHAR(20),
    "telefono" VARCHAR(30),
    "whatsapp" VARCHAR(30),
    "email" VARCHAR(150),
    "direccion" VARCHAR(255),
    "password_hash" VARCHAR(255),
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "permite_notificaciones" BOOLEAN NOT NULL DEFAULT true,
    "canal_preferido" VARCHAR(20),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "ruc" VARCHAR(20),
    "telefono" VARCHAR(30),
    "email" VARCHAR(150),
    "direccion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_empresas" (
    "cliente_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "cargo" VARCHAR(100),

    CONSTRAINT "cliente_empresas_pkey" PRIMARY KEY ("cliente_id","empresa_id")
);

-- CreateTable
CREATE TABLE "categorias_productos" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(50),
    "codigo_barra" VARCHAR(50),
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "imagen_url" VARCHAR(255),
    "categoria_id" INTEGER,
    "unidad_medida" VARCHAR(20) NOT NULL DEFAULT 'UNIDAD',
    "precio_venta" BIGINT NOT NULL DEFAULT 0,
    "precio_por_kg" BIGINT,
    "costo_promedio" BIGINT NOT NULL DEFAULT 0,
    "iva_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "controla_stock" BOOLEAN NOT NULL DEFAULT true,
    "venta_por_kilo" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conceptos_venta" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "aplica_iva" BOOLEAN NOT NULL DEFAULT false,
    "tasa_iva" DECIMAL(5,2),
    "se_factura" BOOLEAN NOT NULL DEFAULT false,
    "afecta_stock" BOOLEAN NOT NULL DEFAULT false,
    "permite_descuento" BOOLEAN NOT NULL DEFAULT false,
    "permite_libreta" BOOLEAN NOT NULL DEFAULT false,
    "permite_reserva" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "conceptos_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" SERIAL NOT NULL,
    "sucursal_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "precio" BIGINT NOT NULL DEFAULT 0,
    "precio_convenio" BIGINT,
    "precio_libreta" BIGINT,
    "cupo_total" INTEGER,
    "cupo_reservado" INTEGER NOT NULL DEFAULT 0,
    "hora_limite_reserva" TIMESTAMP(3),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    "publicado_en" TIMESTAMP(3),
    "creado_por" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" SERIAL NOT NULL,
    "menu_id" INTEGER NOT NULL,
    "producto_id" INTEGER,
    "descripcion" VARCHAR(200),
    "tipo" VARCHAR(20) NOT NULL DEFAULT 'PRINCIPAL',

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "menu_id" INTEGER NOT NULL,
    "sucursal_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "tipo_entrega" VARCHAR(20) NOT NULL DEFAULT 'LOCAL',
    "observacion" TEXT,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "forma_pago_prevista" VARCHAR(30),
    "total" BIGINT NOT NULL DEFAULT 0,
    "venta_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" SERIAL NOT NULL,
    "sucursal_id" INTEGER NOT NULL,
    "caja_id" INTEGER,
    "cliente_id" INTEGER,
    "usuario_id" INTEGER NOT NULL,
    "tipo_venta" VARCHAR(30) NOT NULL DEFAULT 'MOSTRADOR',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "condicion_pago" VARCHAR(20) NOT NULL DEFAULT 'CONTADO',
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "descuento" BIGINT NOT NULL DEFAULT 0,
    "iva_total" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "facturada" BOOLEAN NOT NULL DEFAULT false,
    "cargada_libreta" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta_items" (
    "id" SERIAL NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "producto_id" INTEGER,
    "concepto_id" INTEGER,
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "unidad_medida" VARCHAR(20) NOT NULL DEFAULT 'UNIDAD',
    "precio_unitario" BIGINT NOT NULL DEFAULT 0,
    "iva_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "venta_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "libretas" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "empresa_id" INTEGER,
    "tipo" VARCHAR(20) NOT NULL DEFAULT 'PERSONAL',
    "limite_credito" BIGINT NOT NULL DEFAULT 0,
    "saldo_actual" BIGINT NOT NULL DEFAULT 0,
    "saldo_vencido" BIGINT NOT NULL DEFAULT 0,
    "dia_corte" INTEGER,
    "dia_vencimiento" INTEGER,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "libretas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "libreta_movimientos" (
    "id" SERIAL NOT NULL,
    "libreta_id" INTEGER NOT NULL,
    "venta_id" INTEGER,
    "pago_id" INTEGER,
    "tipo_movimiento" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255),
    "monto_debe" BIGINT NOT NULL DEFAULT 0,
    "monto_haber" BIGINT NOT NULL DEFAULT 0,
    "saldo_resultante" BIGINT NOT NULL DEFAULT 0,
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" INTEGER,

    CONSTRAINT "libreta_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" SERIAL NOT NULL,
    "venta_id" INTEGER,
    "cliente_id" INTEGER,
    "libreta_id" INTEGER,
    "forma_pago" VARCHAR(30) NOT NULL,
    "proveedor_pago" VARCHAR(50),
    "monto" BIGINT NOT NULL DEFAULT 0,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADO',
    "referencia_externa" VARCHAR(100),
    "voucher" VARCHAR(100),
    "autorizacion" VARCHAR(100),
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" SERIAL NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "cliente_id" INTEGER,
    "tipo_documento" VARCHAR(20) NOT NULL DEFAULT 'FACTURA',
    "numero" VARCHAR(50) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "iva_total" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'VIGENTE',
    "cdc" VARCHAR(100),
    "xml_path" VARCHAR(255),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "ruc" VARCHAR(20),
    "telefono" VARCHAR(30),
    "email" VARCHAR(150),
    "direccion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras" (
    "id" SERIAL NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "numero_factura" VARCHAR(50),
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "iva_total" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA',
    "usuario_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra_items" (
    "id" SERIAL NOT NULL,
    "compra_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "unidad" VARCHAR(20) NOT NULL DEFAULT 'UNIDAD',
    "costo_unitario" BIGINT NOT NULL DEFAULT 0,
    "iva_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "compra_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movimientos" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "sucursal_id" INTEGER NOT NULL,
    "deposito_id" INTEGER,
    "tipo_movimiento" VARCHAR(30) NOT NULL,
    "referencia_tipo" VARCHAR(30),
    "referencia_id" INTEGER,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "costo_unitario" BIGINT,
    "observacion" VARCHAR(255),
    "usuario_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recetas" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "recetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receta_items" (
    "id" SERIAL NOT NULL,
    "receta_id" INTEGER NOT NULL,
    "insumo_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "unidad" VARCHAR(20) NOT NULL DEFAULT 'UNIDAD',

    CONSTRAINT "receta_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER,
    "tipo" VARCHAR(50) NOT NULL,
    "canal" VARCHAR(20) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER,
    "modulo" VARCHAR(50) NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "registro_id" VARCHAR(50),
    "valor_anterior" JSONB,
    "valor_nuevo" JSONB,
    "ip" VARCHAR(50),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuraciones" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" VARCHAR(255),

    CONSTRAINT "configuraciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depositos" (
    "id" SERIAL NOT NULL,
    "sucursal_id" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "depositos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_actual" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "sucursal_id" INTEGER NOT NULL,
    "deposito_id" INTEGER,
    "cantidad" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "costo_promedio" BIGINT NOT NULL DEFAULT 0,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_actual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_aperturas" (
    "id" SERIAL NOT NULL,
    "caja_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "sucursal_id" INTEGER NOT NULL,
    "fecha_apertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto_inicial" BIGINT NOT NULL DEFAULT 0,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
    "observacion" TEXT,
    "fecha_cierre" TIMESTAMP(3),
    "usuario_cierre_id" INTEGER,
    "monto_sistema" BIGINT NOT NULL DEFAULT 0,
    "monto_declarado" BIGINT NOT NULL DEFAULT 0,
    "diferencia" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "caja_aperturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_movimientos" (
    "id" SERIAL NOT NULL,
    "apertura_id" INTEGER NOT NULL,
    "venta_id" INTEGER,
    "pago_id" INTEGER,
    "tipo_movimiento" VARCHAR(30) NOT NULL,
    "forma_pago" VARCHAR(30),
    "monto" BIGINT NOT NULL DEFAULT 0,
    "descripcion" VARCHAR(255),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" INTEGER,

    CONSTRAINT "caja_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_fiscales" (
    "id" SERIAL NOT NULL,
    "venta_id" INTEGER,
    "cliente_id" INTEGER,
    "tipo_documento" VARCHAR(30) NOT NULL,
    "condicion" VARCHAR(20) NOT NULL,
    "establecimiento" VARCHAR(3) NOT NULL,
    "punto_expedicion" VARCHAR(3) NOT NULL,
    "numero" INTEGER NOT NULL,
    "numero_formateado" VARCHAR(50) NOT NULL,
    "timbrado" VARCHAR(50),
    "fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "iva_5" BIGINT NOT NULL DEFAULT 0,
    "iva_10" BIGINT NOT NULL DEFAULT 0,
    "iva_total" BIGINT NOT NULL DEFAULT 0,
    "exento" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'BORRADOR',
    "estado_sifen" VARCHAR(30),
    "cdc" VARCHAR(100),
    "xml" TEXT,
    "kude_url" VARCHAR(255),
    "pdf_path" VARCHAR(255),
    "documento_relacionado_id" INTEGER,
    "motivo_anulacion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_fiscales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_fiscal_eventos" (
    "id" SERIAL NOT NULL,
    "documento_fiscal_id" INTEGER NOT NULL,
    "tipo_evento" VARCHAR(50) NOT NULL,
    "estado_anterior" VARCHAR(30),
    "estado_nuevo" VARCHAR(30),
    "payload" JSONB,
    "respuesta" JSONB,
    "mensaje" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_fiscal_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secuencias_fiscales" (
    "id" SERIAL NOT NULL,
    "establecimiento" VARCHAR(3) NOT NULL,
    "punto_expedicion" VARCHAR(3) NOT NULL,
    "tipo_documento" VARCHAR(30) NOT NULL,
    "ultimo_numero" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secuencias_fiscales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago_intentos" (
    "id" SERIAL NOT NULL,
    "pago_id" INTEGER NOT NULL,
    "proveedor" VARCHAR(50) NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'CREADO',
    "referencia_externa" VARCHAR(150),
    "redirect_url" TEXT,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pago_intentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_eventos" (
    "id" SERIAL NOT NULL,
    "proveedor" VARCHAR(50) NOT NULL,
    "event_id" VARCHAR(150),
    "referencia_externa" VARCHAR(150),
    "signature" TEXT,
    "payload" JSONB NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'RECIBIDO',
    "procesado_en" TIMESTAMP(3),
    "error" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "ip" VARCHAR(50),
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacion_plantillas" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(100) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "canal" VARCHAR(30) NOT NULL,
    "asunto" VARCHAR(200),
    "cuerpo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notificacion_plantillas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_consentimientos" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "aceptado" BOOLEAN NOT NULL DEFAULT false,
    "canal" VARCHAR(30),
    "ip" VARCHAR(50),
    "user_agent" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_consentimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE INDEX "rol_permisos_rol_id_idx" ON "rol_permisos"("rol_id");

-- CreateIndex
CREATE INDEX "rol_permisos_permiso_id_idx" ON "rol_permisos"("permiso_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_rol_id_idx" ON "usuarios"("rol_id");

-- CreateIndex
CREATE INDEX "usuarios_sucursal_id_idx" ON "usuarios"("sucursal_id");

-- CreateIndex
CREATE INDEX "cajas_sucursal_id_idx" ON "cajas"("sucursal_id");

-- CreateIndex
CREATE INDEX "cliente_empresas_cliente_id_idx" ON "cliente_empresas"("cliente_id");

-- CreateIndex
CREATE INDEX "cliente_empresas_empresa_id_idx" ON "cliente_empresas"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_key" ON "productos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_barra_key" ON "productos"("codigo_barra");

-- CreateIndex
CREATE INDEX "productos_categoria_id_idx" ON "productos"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "conceptos_venta_codigo_key" ON "conceptos_venta"("codigo");

-- CreateIndex
CREATE INDEX "menus_sucursal_id_idx" ON "menus"("sucursal_id");

-- CreateIndex
CREATE INDEX "menu_items_menu_id_idx" ON "menu_items"("menu_id");

-- CreateIndex
CREATE INDEX "menu_items_producto_id_idx" ON "menu_items"("producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_venta_id_key" ON "reservas"("venta_id");

-- CreateIndex
CREATE INDEX "reservas_cliente_id_idx" ON "reservas"("cliente_id");

-- CreateIndex
CREATE INDEX "reservas_menu_id_idx" ON "reservas"("menu_id");

-- CreateIndex
CREATE INDEX "reservas_sucursal_id_idx" ON "reservas"("sucursal_id");

-- CreateIndex
CREATE INDEX "reservas_estado_idx" ON "reservas"("estado");

-- CreateIndex
CREATE INDEX "ventas_cliente_id_idx" ON "ventas"("cliente_id");

-- CreateIndex
CREATE INDEX "ventas_sucursal_id_idx" ON "ventas"("sucursal_id");

-- CreateIndex
CREATE INDEX "ventas_usuario_id_idx" ON "ventas"("usuario_id");

-- CreateIndex
CREATE INDEX "ventas_caja_id_idx" ON "ventas"("caja_id");

-- CreateIndex
CREATE INDEX "ventas_estado_idx" ON "ventas"("estado");

-- CreateIndex
CREATE INDEX "ventas_creado_en_idx" ON "ventas"("creado_en");

-- CreateIndex
CREATE INDEX "venta_items_venta_id_idx" ON "venta_items"("venta_id");

-- CreateIndex
CREATE INDEX "venta_items_producto_id_idx" ON "venta_items"("producto_id");

-- CreateIndex
CREATE INDEX "libretas_cliente_id_idx" ON "libretas"("cliente_id");

-- CreateIndex
CREATE INDEX "libretas_empresa_id_idx" ON "libretas"("empresa_id");

-- CreateIndex
CREATE INDEX "libretas_estado_idx" ON "libretas"("estado");

-- CreateIndex
CREATE INDEX "libreta_movimientos_libreta_id_idx" ON "libreta_movimientos"("libreta_id");

-- CreateIndex
CREATE INDEX "libreta_movimientos_venta_id_idx" ON "libreta_movimientos"("venta_id");

-- CreateIndex
CREATE INDEX "libreta_movimientos_pago_id_idx" ON "libreta_movimientos"("pago_id");

-- CreateIndex
CREATE INDEX "libreta_movimientos_fecha_movimiento_idx" ON "libreta_movimientos"("fecha_movimiento");

-- CreateIndex
CREATE INDEX "pagos_venta_id_idx" ON "pagos"("venta_id");

-- CreateIndex
CREATE INDEX "pagos_cliente_id_idx" ON "pagos"("cliente_id");

-- CreateIndex
CREATE INDEX "pagos_libreta_id_idx" ON "pagos"("libreta_id");

-- CreateIndex
CREATE INDEX "pagos_estado_idx" ON "pagos"("estado");

-- CreateIndex
CREATE INDEX "pagos_forma_pago_idx" ON "pagos"("forma_pago");

-- CreateIndex
CREATE INDEX "pagos_fecha_pago_idx" ON "pagos"("fecha_pago");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_venta_id_key" ON "facturas"("venta_id");

-- CreateIndex
CREATE INDEX "facturas_cliente_id_idx" ON "facturas"("cliente_id");

-- CreateIndex
CREATE INDEX "facturas_estado_idx" ON "facturas"("estado");

-- CreateIndex
CREATE INDEX "facturas_fecha_idx" ON "facturas"("fecha");

-- CreateIndex
CREATE INDEX "compras_proveedor_id_idx" ON "compras"("proveedor_id");

-- CreateIndex
CREATE INDEX "compras_usuario_id_idx" ON "compras"("usuario_id");

-- CreateIndex
CREATE INDEX "compra_items_compra_id_idx" ON "compra_items"("compra_id");

-- CreateIndex
CREATE INDEX "compra_items_producto_id_idx" ON "compra_items"("producto_id");

-- CreateIndex
CREATE INDEX "stock_movimientos_producto_id_idx" ON "stock_movimientos"("producto_id");

-- CreateIndex
CREATE INDEX "stock_movimientos_sucursal_id_idx" ON "stock_movimientos"("sucursal_id");

-- CreateIndex
CREATE INDEX "stock_movimientos_referencia_tipo_referencia_id_idx" ON "stock_movimientos"("referencia_tipo", "referencia_id");

-- CreateIndex
CREATE INDEX "stock_movimientos_creado_en_idx" ON "stock_movimientos"("creado_en");

-- CreateIndex
CREATE INDEX "recetas_producto_id_idx" ON "recetas"("producto_id");

-- CreateIndex
CREATE INDEX "receta_items_receta_id_idx" ON "receta_items"("receta_id");

-- CreateIndex
CREATE INDEX "receta_items_insumo_id_idx" ON "receta_items"("insumo_id");

-- CreateIndex
CREATE INDEX "notificaciones_cliente_id_idx" ON "notificaciones"("cliente_id");

-- CreateIndex
CREATE INDEX "notificaciones_estado_idx" ON "notificaciones"("estado");

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_idx" ON "auditoria"("usuario_id");

-- CreateIndex
CREATE INDEX "auditoria_modulo_idx" ON "auditoria"("modulo");

-- CreateIndex
CREATE INDEX "auditoria_creado_en_idx" ON "auditoria"("creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "configuraciones_clave_key" ON "configuraciones"("clave");

-- CreateIndex
CREATE INDEX "depositos_sucursal_id_idx" ON "depositos"("sucursal_id");

-- CreateIndex
CREATE INDEX "stock_actual_producto_id_idx" ON "stock_actual"("producto_id");

-- CreateIndex
CREATE INDEX "stock_actual_sucursal_id_idx" ON "stock_actual"("sucursal_id");

-- CreateIndex
CREATE INDEX "stock_actual_deposito_id_idx" ON "stock_actual"("deposito_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_actual_producto_id_sucursal_id_deposito_id_key" ON "stock_actual"("producto_id", "sucursal_id", "deposito_id");

-- CreateIndex
CREATE INDEX "caja_aperturas_caja_id_idx" ON "caja_aperturas"("caja_id");

-- CreateIndex
CREATE INDEX "caja_aperturas_usuario_id_idx" ON "caja_aperturas"("usuario_id");

-- CreateIndex
CREATE INDEX "caja_aperturas_sucursal_id_idx" ON "caja_aperturas"("sucursal_id");

-- CreateIndex
CREATE INDEX "caja_aperturas_usuario_cierre_id_idx" ON "caja_aperturas"("usuario_cierre_id");

-- CreateIndex
CREATE INDEX "caja_movimientos_apertura_id_idx" ON "caja_movimientos"("apertura_id");

-- CreateIndex
CREATE INDEX "caja_movimientos_venta_id_idx" ON "caja_movimientos"("venta_id");

-- CreateIndex
CREATE INDEX "caja_movimientos_pago_id_idx" ON "caja_movimientos"("pago_id");

-- CreateIndex
CREATE INDEX "caja_movimientos_usuario_id_idx" ON "caja_movimientos"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_fiscales_venta_id_key" ON "documentos_fiscales"("venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_fiscales_cdc_key" ON "documentos_fiscales"("cdc");

-- CreateIndex
CREATE INDEX "documentos_fiscales_cliente_id_idx" ON "documentos_fiscales"("cliente_id");

-- CreateIndex
CREATE INDEX "documentos_fiscales_documento_relacionado_id_idx" ON "documentos_fiscales"("documento_relacionado_id");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_fiscales_establecimiento_punto_expedicion_tipo_d_key" ON "documentos_fiscales"("establecimiento", "punto_expedicion", "tipo_documento", "numero");

-- CreateIndex
CREATE INDEX "documento_fiscal_eventos_documento_fiscal_id_idx" ON "documento_fiscal_eventos"("documento_fiscal_id");

-- CreateIndex
CREATE UNIQUE INDEX "secuencias_fiscales_establecimiento_punto_expedicion_tipo_d_key" ON "secuencias_fiscales"("establecimiento", "punto_expedicion", "tipo_documento");

-- CreateIndex
CREATE INDEX "pago_intentos_pago_id_idx" ON "pago_intentos"("pago_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_eventos_proveedor_event_id_key" ON "webhook_eventos"("proveedor", "event_id");

-- CreateIndex
CREATE INDEX "user_sessions_usuario_id_idx" ON "user_sessions"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "notificacion_plantillas_codigo_key" ON "notificacion_plantillas"("codigo");

-- CreateIndex
CREATE INDEX "cliente_consentimientos_cliente_id_idx" ON "cliente_consentimientos"("cliente_id");

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_empresas" ADD CONSTRAINT "cliente_empresas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_empresas" ADD CONSTRAINT "cliente_empresas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "conceptos_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libretas" ADD CONSTRAINT "libretas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libretas" ADD CONSTRAINT "libretas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libreta_movimientos" ADD CONSTRAINT "libreta_movimientos_libreta_id_fkey" FOREIGN KEY ("libreta_id") REFERENCES "libretas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libreta_movimientos" ADD CONSTRAINT "libreta_movimientos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libreta_movimientos" ADD CONSTRAINT "libreta_movimientos_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libreta_movimientos" ADD CONSTRAINT "libreta_movimientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_libreta_id_fkey" FOREIGN KEY ("libreta_id") REFERENCES "libretas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_items" ADD CONSTRAINT "compra_items_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_items" ADD CONSTRAINT "compra_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movimientos" ADD CONSTRAINT "stock_movimientos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movimientos" ADD CONSTRAINT "stock_movimientos_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movimientos" ADD CONSTRAINT "stock_movimientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_items" ADD CONSTRAINT "receta_items_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "recetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_items" ADD CONSTRAINT "receta_items_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depositos" ADD CONSTRAINT "depositos_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_actual" ADD CONSTRAINT "stock_actual_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_actual" ADD CONSTRAINT "stock_actual_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_actual" ADD CONSTRAINT "stock_actual_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "depositos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_aperturas" ADD CONSTRAINT "caja_aperturas_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_aperturas" ADD CONSTRAINT "caja_aperturas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_aperturas" ADD CONSTRAINT "caja_aperturas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_movimientos" ADD CONSTRAINT "caja_movimientos_apertura_id_fkey" FOREIGN KEY ("apertura_id") REFERENCES "caja_aperturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_movimientos" ADD CONSTRAINT "caja_movimientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscales" ADD CONSTRAINT "documentos_fiscales_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscales" ADD CONSTRAINT "documentos_fiscales_documento_relacionado_id_fkey" FOREIGN KEY ("documento_relacionado_id") REFERENCES "documentos_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_fiscal_eventos" ADD CONSTRAINT "documento_fiscal_eventos_documento_fiscal_id_fkey" FOREIGN KEY ("documento_fiscal_id") REFERENCES "documentos_fiscales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_intentos" ADD CONSTRAINT "pago_intentos_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_consentimientos" ADD CONSTRAINT "cliente_consentimientos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

