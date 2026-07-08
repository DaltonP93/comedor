import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // Roles
  const roles = [
    { nombre: 'SUPERADMIN', descripcion: 'Acceso total al sistema' },
    { nombre: 'ADMINISTRADOR', descripcion: 'Administrador del comedor' },
    { nombre: 'CAJERO', descripcion: 'Operador de caja' },
    { nombre: 'COCINERO', descripcion: 'Personal de cocina' },
    { nombre: 'STOCK', descripcion: 'Encargado de stock' },
    { nombre: 'MENU', descripcion: 'Gestor de menús' },
    { nombre: 'COBRANZAS', descripcion: 'Encargado de cobranzas' },
    { nombre: 'DELIVERY', descripcion: 'Personal de delivery' },
    { nombre: 'CLIENTE', descripcion: 'Cliente del sistema' },
    { nombre: 'EMPRESA', descripcion: 'Empresa convenio' },
    { nombre: 'AUDITOR', descripcion: 'Auditor del sistema' },
  ];

  const createdRoles: Record<string, number> = {};
  for (const rol of roles) {
    const created = await prisma.rol.upsert({
      where: { nombre: rol.nombre },
      update: {},
      create: rol,
    });
    createdRoles[rol.nombre] = created.id;
  }
  console.log('Roles creados:', Object.keys(createdRoles).length);

  // Permisos
  const modulos = [
    'DASHBOARD', 'CLIENTES', 'PRODUCTOS', 'CATEGORIAS', 'CONCEPTOS',
    'MENUS', 'RESERVAS', 'VENTAS', 'LIBRETAS', 'STOCK', 'COMPRAS',
    'PROVEEDORES', 'USUARIOS', 'ROLES', 'SUCURSALES', 'CAJAS',
    'REPORTES', 'CONFIGURACION', 'AUDITORIA', 'COCINA',
  ];

  const acciones = ['VER', 'CREAR', 'EDITAR', 'ELIMINAR'];

  const permisosCreados: Record<string, number> = {};
  for (const modulo of modulos) {
    for (const accion of acciones) {
      const codigo = `${modulo}:${accion}`;
      const p = await prisma.permiso.upsert({
        where: { codigo },
        update: {},
        create: {
          codigo,
          descripcion: `${accion} en módulo ${modulo}`,
          modulo,
        },
      });
      permisosCreados[codigo] = p.id;
    }
  }

  // Permisos granulares adicionales
  const permisosGranulares = [
    { codigo: 'VENTAS:ANULAR', descripcion: 'Anular ventas', modulo: 'VENTAS' },
    { codigo: 'VENTAS:DESCUENTO', descripcion: 'Aplicar descuentos en ventas', modulo: 'VENTAS' },
    { codigo: 'CAJA:ABRIR', descripcion: 'Abrir turno de caja', modulo: 'CAJAS' },
    { codigo: 'CAJA:CERRAR', descripcion: 'Cerrar turno de caja', modulo: 'CAJAS' },
    { codigo: 'CAJA:AJUSTAR', descripcion: 'Registrar retiros y ajustes de caja', modulo: 'CAJAS' },
    { codigo: 'LIBRETAS:COBRAR', descripcion: 'Registrar cobros en libretas', modulo: 'LIBRETAS' },
    { codigo: 'LIBRETAS:BLOQUEAR', descripcion: 'Bloquear/desbloquear libretas', modulo: 'LIBRETAS' },
    { codigo: 'STOCK:ENTRADA', descripcion: 'Registrar entrada de stock', modulo: 'STOCK' },
    { codigo: 'STOCK:SALIDA', descripcion: 'Registrar salida de stock', modulo: 'STOCK' },
    { codigo: 'STOCK:AJUSTE', descripcion: 'Ajustar inventario', modulo: 'STOCK' },
    { codigo: 'MENUS:PUBLICAR', descripcion: 'Publicar menús del día', modulo: 'MENUS' },
    { codigo: 'MENUS:CANCELAR', descripcion: 'Cancelar menús publicados', modulo: 'MENUS' },
    { codigo: 'REPORTES:EXPORTAR', descripcion: 'Exportar reportes', modulo: 'REPORTES' },
    { codigo: 'FACTURAS:ANULAR', descripcion: 'Anular facturas emitidas', modulo: 'VENTAS' },
    { codigo: 'FACTURAS:SIFEN', descripcion: 'Reenviar facturas a SIFEN', modulo: 'VENTAS' },
    { codigo: 'PAGOS:CONFIRMAR', descripcion: 'Confirmar pagos pendientes', modulo: 'VENTAS' },
    { codigo: 'PAGOS:RECHAZAR', descripcion: 'Rechazar pagos', modulo: 'VENTAS' },
    { codigo: 'NOTIFICACIONES:ENVIAR', descripcion: 'Enviar notificaciones masivas', modulo: 'CLIENTES' },
  ];

  for (const pg of permisosGranulares) {
    const p = await prisma.permiso.upsert({
      where: { codigo: pg.codigo },
      update: {},
      create: pg,
    });
    permisosCreados[pg.codigo] = p.id;
  }

  console.log('Permisos creados:', Object.keys(permisosCreados).length);

  // Asignar todos los permisos a SUPERADMIN y ADMINISTRADOR
  const todosLosPermisos = Object.values(permisosCreados);
  for (const rolNombre of ['SUPERADMIN', 'ADMINISTRADOR']) {
    const rolId = createdRoles[rolNombre];
    for (const permisoId of todosLosPermisos) {
      await prisma.rolPermiso.upsert({
        where: { rol_id_permiso_id: { rol_id: rolId, permiso_id: permisoId } },
        update: {},
        create: { rol_id: rolId, permiso_id: permisoId },
      });
    }
  }

  // Permisos para CAJERO
  const permisosCajero = [
    'DASHBOARD:VER', 'CLIENTES:VER', 'CLIENTES:CREAR', 'CLIENTES:EDITAR',
    'VENTAS:VER', 'VENTAS:CREAR', 'VENTAS:EDITAR',
    'RESERVAS:VER', 'RESERVAS:EDITAR',
    'LIBRETAS:VER', 'LIBRETAS:EDITAR',
    'PAGOS:VER', 'PAGOS:CREAR',
    'CAJAS:VER', 'CAJAS:EDITAR',
  ];

  for (const codigo of permisosCajero) {
    if (permisosCreados[codigo]) {
      await prisma.rolPermiso.upsert({
        where: { rol_id_permiso_id: { rol_id: createdRoles['CAJERO'], permiso_id: permisosCreados[codigo] } },
        update: {},
        create: { rol_id: createdRoles['CAJERO'], permiso_id: permisosCreados[codigo] },
      });
    }
  }

  // Permisos para COCINERO
  const permisosCocinero = [
    'DASHBOARD:VER', 'MENUS:VER', 'RESERVAS:VER', 'RESERVAS:EDITAR',
    'COCINA:VER', 'COCINA:EDITAR',
  ];

  for (const codigo of permisosCocinero) {
    if (permisosCreados[codigo]) {
      await prisma.rolPermiso.upsert({
        where: { rol_id_permiso_id: { rol_id: createdRoles['COCINERO'], permiso_id: permisosCreados[codigo] } },
        update: {},
        create: { rol_id: createdRoles['COCINERO'], permiso_id: permisosCreados[codigo] },
      });
    }
  }

  console.log('Permisos asignados a roles');

  // Sucursal Principal
  const sucursal = await prisma.sucursal.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: 'Sucursal Principal',
      direccion: 'Av. Mcal. López 1234, Asunción',
      telefono: '021-555-0001',
    },
  });
  console.log('Sucursal creada:', sucursal.nombre);

  // Admin user — credenciales desde el entorno; en producción son obligatorias.
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@comedor.com';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production' && !adminPassword) {
    throw new Error('ADMIN_PASSWORD es obligatorio en producción para crear el usuario admin.');
  }
  const passwordPlano = adminPassword || 'admin123'; // fallback solo para demo/dev
  const passwordHash = await bcrypt.hash(passwordPlano, 10);
  const adminUser = await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      nombre: 'Administrador',
      apellido: 'Sistema',
      email: adminEmail,
      password_hash: passwordHash,
      rol_id: createdRoles['SUPERADMIN'],
      sucursal_id: sucursal.id,
    },
  });
  console.log('Usuario admin creado:', adminUser.email);
  if (!adminPassword) {
    console.warn('⚠️  Usuario admin con contraseña de demo. Definí ADMIN_PASSWORD en producción.');
  }

  // Caja default
  await prisma.caja.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: 'Caja Principal',
      sucursal_id: sucursal.id,
      estado: 'CERRADA',
    },
  });

  // Categorías de productos
  const categorias = [
    { nombre: 'Almuerzos', descripcion: 'Menús del día' },
    { nombre: 'Bebidas', descripcion: 'Bebidas frías y calientes' },
    { nombre: 'Snacks', descripcion: 'Meriendas y snacks' },
    { nombre: 'Insumos', descripcion: 'Insumos de cocina' },
    { nombre: 'Postres', descripcion: 'Postres y dulces' },
  ];

  const categoriasCreadas: Record<string, number> = {};
  for (const cat of categorias) {
    const c = await prisma.categoriaProducto.upsert({
      where: { id: categorias.indexOf(cat) + 1 },
      update: {},
      create: cat,
    });
    categoriasCreadas[cat.nombre] = c.id;
  }
  console.log('Categorías creadas:', Object.keys(categoriasCreadas).length);

  // Productos de ejemplo
  const productos = [
    {
      codigo: 'ALM001',
      nombre: 'Almuerzo Completo',
      descripcion: 'Sopa, segundo, postre y bebida',
      categoria_id: categoriasCreadas['Almuerzos'],
      unidad_medida: 'PORCION',
      precio_venta: BigInt(18000),
      costo_promedio: BigInt(10000),
      iva_porcentaje: 10,
      controla_stock: false,
      venta_por_kilo: false,
    },
    {
      codigo: 'ALM002',
      nombre: 'Almuerzo Económico',
      descripcion: 'Segundo y bebida',
      categoria_id: categoriasCreadas['Almuerzos'],
      unidad_medida: 'PORCION',
      precio_venta: BigInt(12000),
      costo_promedio: BigInt(7000),
      iva_porcentaje: 10,
      controla_stock: false,
      venta_por_kilo: false,
    },
    {
      codigo: 'BEB001',
      nombre: 'Refresco',
      descripcion: 'Refresco del día 500ml',
      categoria_id: categoriasCreadas['Bebidas'],
      unidad_medida: 'UNIDAD',
      precio_venta: BigInt(3000),
      costo_promedio: BigInt(1500),
      iva_porcentaje: 10,
      controla_stock: true,
      venta_por_kilo: false,
    },
    {
      codigo: 'BEB002',
      nombre: 'Agua mineral',
      descripcion: 'Agua mineral 500ml',
      categoria_id: categoriasCreadas['Bebidas'],
      unidad_medida: 'UNIDAD',
      precio_venta: BigInt(2000),
      costo_promedio: BigInt(1000),
      iva_porcentaje: 10,
      controla_stock: true,
      venta_por_kilo: false,
    },
    {
      codigo: 'SNK001',
      nombre: 'Chipá',
      descripcion: 'Chipá artesanal',
      categoria_id: categoriasCreadas['Snacks'],
      unidad_medida: 'UNIDAD',
      precio_venta: BigInt(1500),
      costo_promedio: BigInt(700),
      iva_porcentaje: 10,
      controla_stock: true,
      venta_por_kilo: false,
    },
    {
      codigo: 'SNK002',
      nombre: 'Sándwich',
      descripcion: 'Sándwich de pollo',
      categoria_id: categoriasCreadas['Snacks'],
      unidad_medida: 'UNIDAD',
      precio_venta: BigInt(8000),
      costo_promedio: BigInt(4000),
      iva_porcentaje: 10,
      controla_stock: true,
      venta_por_kilo: false,
    },
    {
      codigo: 'POS001',
      nombre: 'Postre del día',
      descripcion: 'Postre según disponibilidad',
      categoria_id: categoriasCreadas['Postres'],
      unidad_medida: 'PORCION',
      precio_venta: BigInt(4000),
      costo_promedio: BigInt(2000),
      iva_porcentaje: 10,
      controla_stock: false,
      venta_por_kilo: false,
    },
    {
      codigo: 'GAS001',
      nombre: 'Gaseosa lata',
      descripcion: 'Gaseosa lata 350ml',
      categoria_id: categoriasCreadas['Bebidas'],
      unidad_medida: 'UNIDAD',
      precio_venta: BigInt(4500),
      costo_promedio: BigInt(2500),
      iva_porcentaje: 10,
      controla_stock: true,
      venta_por_kilo: false,
    },
  ];

  for (const prod of productos) {
    await prisma.producto.upsert({
      where: { codigo: prod.codigo },
      update: {},
      create: prod,
    });
  }
  console.log('Productos creados:', productos.length);

  // Conceptos de venta
  const conceptos = [
    {
      codigo: 'ALMUERZO',
      nombre: 'Almuerzo',
      tipo: 'PRODUCTO',
      aplica_iva: true,
      tasa_iva: 10,
      se_factura: true,
      afecta_stock: false,
      permite_descuento: true,
      permite_libreta: true,
      permite_reserva: true,
    },
    {
      codigo: 'BEBIDA',
      nombre: 'Bebida',
      tipo: 'PRODUCTO',
      aplica_iva: true,
      tasa_iva: 10,
      se_factura: true,
      afecta_stock: true,
      permite_descuento: false,
      permite_libreta: true,
      permite_reserva: false,
    },
    {
      codigo: 'SNACK',
      nombre: 'Snack/Merienda',
      tipo: 'PRODUCTO',
      aplica_iva: true,
      tasa_iva: 10,
      se_factura: true,
      afecta_stock: true,
      permite_descuento: false,
      permite_libreta: true,
      permite_reserva: false,
    },
    {
      codigo: 'VENTA_KILO',
      nombre: 'Venta por kilo',
      tipo: 'KILO',
      aplica_iva: true,
      tasa_iva: 10,
      se_factura: true,
      afecta_stock: true,
      permite_descuento: true,
      permite_libreta: true,
      permite_reserva: false,
    },
    {
      codigo: 'CARGO_LIBRETA',
      nombre: 'Cargo a libreta',
      tipo: 'CREDITO',
      aplica_iva: false,
      tasa_iva: 0,
      se_factura: false,
      afecta_stock: false,
      permite_descuento: false,
      permite_libreta: true,
      permite_reserva: false,
    },
  ];

  for (const concepto of conceptos) {
    await prisma.conceptoVenta.upsert({
      where: { codigo: concepto.codigo },
      update: {},
      create: concepto,
    });
  }
  console.log('Conceptos de venta creados:', conceptos.length);

  // Configuraciones
  const configuraciones = [
    { clave: 'EMPRESA_NOMBRE', valor: 'Comedor Empresarial S.A.', descripcion: 'Nombre de la empresa' },
    { clave: 'EMPRESA_RUC', valor: '80012345-6', descripcion: 'RUC de la empresa' },
    { clave: 'EMPRESA_TELEFONO', valor: '021-555-0000', descripcion: 'Teléfono de la empresa' },
    { clave: 'EMPRESA_EMAIL', valor: 'info@comedor.com', descripcion: 'Email de la empresa' },
    { clave: 'EMPRESA_DIRECCION', valor: 'Av. Mcal. López 1234, Asunción', descripcion: 'Dirección de la empresa' },
    { clave: 'MONEDA', valor: 'PYG', descripcion: 'Moneda del sistema' },
    { clave: 'MONEDA_SIMBOLO', valor: 'Gs.', descripcion: 'Símbolo de la moneda' },
    { clave: 'IVA_10', valor: '10', descripcion: 'IVA 10%' },
    { clave: 'IVA_5', valor: '5', descripcion: 'IVA 5%' },
    { clave: 'IVA_EXENTO', valor: '0', descripcion: 'IVA Exento' },
    { clave: 'TIMEZONE', valor: 'America/Asuncion', descripcion: 'Zona horaria' },
    { clave: 'HORA_LIMITE_RESERVA_DEFAULT', valor: '10:00', descripcion: 'Hora límite de reserva por defecto' },
    { clave: 'STOCK_MINIMO_ALERTA', valor: '10', descripcion: 'Stock mínimo para alertas' },
    { clave: 'JWT_EXPIRACION_HORAS', valor: '8', descripcion: 'Horas de expiración del token JWT' },
    { clave: 'NUMERO_FACTURA_ACTUAL', valor: '0001-001-0000001', descripcion: 'Número de factura actual' },
    { clave: 'TIMBRADO', valor: '12345678', descripcion: 'Número de timbrado' },
    { clave: 'PERMITE_VENTA_SIN_STOCK', valor: 'false', descripcion: 'Permite vender sin stock' },
    { clave: 'LIMITE_CREDITO_DEFAULT', valor: '500000', descripcion: 'Límite de crédito por defecto en Gs.' },
  ];

  for (const config of configuraciones) {
    await prisma.configuracion.upsert({
      where: { clave: config.clave },
      update: {},
      create: config,
    });
  }
  console.log('Configuraciones creadas:', configuraciones.length);

  // Proveedor de ejemplo
  await prisma.proveedor.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: 'Distribuidora La Central',
      ruc: '80099999-1',
      telefono: '021-444-0001',
      email: 'ventas@lacentral.com',
      direccion: 'Ruta 1 km 5, Asunción',
    },
  });

  // Clientes de ejemplo
  const clientes = [
    {
      tipo_cliente: 'INDIVIDUAL',
      nombre: 'Juan',
      documento_tipo: 'CI',
      documento_numero: '1234567',
      telefono: '0981-111-001',
      whatsapp: '0981-111-001',
      email: 'juan@example.com',
      permite_notificaciones: true,
      canal_preferido: 'WHATSAPP',
    },
    {
      tipo_cliente: 'INDIVIDUAL',
      nombre: 'María',
      documento_tipo: 'CI',
      documento_numero: '2345678',
      telefono: '0982-222-002',
      whatsapp: '0982-222-002',
      email: 'maria@example.com',
      permite_notificaciones: true,
      canal_preferido: 'WHATSAPP',
    },
    {
      tipo_cliente: 'EMPRESA',
      nombre: 'Empresa Demo',
      razon_social: 'Empresa Demo S.A.',
      ruc: '80011111-1',
      documento_tipo: 'RUC',
      documento_numero: '80011111-1',
      telefono: '021-333-003',
      email: 'admin@empresademo.com',
      permite_notificaciones: false,
    },
  ];

  for (const cliente of clientes) {
    const exists = await prisma.cliente.findFirst({
      where: { documento_numero: cliente.documento_numero },
    });
    if (!exists) {
      const c = await prisma.cliente.create({ data: cliente });

      // Crear libreta para clientes individuales
      if (cliente.tipo_cliente === 'INDIVIDUAL') {
        await prisma.libreta.create({
          data: {
            cliente_id: c.id,
            tipo: 'PERSONAL',
            limite_credito: BigInt(500000),
            saldo_actual: BigInt(0),
            estado: 'ACTIVA',
          },
        });
      }
    }
  }
  console.log('Clientes de ejemplo creados');

  // Menu de ejemplo para hoy
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const menuExistente = await prisma.menu.findFirst({
    where: {
      sucursal_id: sucursal.id,
      fecha: today,
    },
  });

  if (!menuExistente) {
    const menuHoy = await prisma.menu.create({
      data: {
        sucursal_id: sucursal.id,
        fecha: today,
        titulo: 'Menú del día - Demo',
        descripcion: 'Sopa de pollo, Milanesa con arroz y ensalada, Postre, Refresco',
        precio: BigInt(18000),
        precio_convenio: BigInt(15000),
        precio_libreta: BigInt(16000),
        cupo_total: 100,
        cupo_reservado: 0,
        estado: 'PUBLICADO',
        publicado_en: new Date(),
        creado_por: adminUser.id,
      },
    });

    const prodAlmuerzo = await prisma.producto.findFirst({ where: { codigo: 'ALM001' } });
    if (prodAlmuerzo) {
      await prisma.menuItem.createMany({
        data: [
          { menu_id: menuHoy.id, producto_id: prodAlmuerzo.id, descripcion: 'Almuerzo completo', tipo: 'PRINCIPAL' },
          { menu_id: menuHoy.id, descripcion: 'Sopa de pollo', tipo: 'ENTRADA' },
          { menu_id: menuHoy.id, descripcion: 'Refresco del día', tipo: 'BEBIDA' },
        ],
      });
    }
    console.log('Menú de ejemplo creado para hoy');
  }

  console.log('✅ Seed completado exitosamente!');
  console.log('Usuario admin: admin@comedor.com / admin123');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
