import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /reportes/dashboard
router.get('/dashboard', requirePermiso('DASHBOARD:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      ventasHoy,
      reservasHoy,
      stockCritico,
      libretasVencidas,
      ultimasVentas,
      menusHoyTotal,
      menusPublicadosHoy,
      ventasMes,
      reservasPendientesHoy,
      clientesActivos,
      productosActivos,
      facturasHoy,
      ventasSinFacturarHoy,
      libretasActivas,
      comprasMes,
    ] = await Promise.all([
      prisma.venta.aggregate({
        where: { creado_en: { gte: hoy, lt: manana }, estado: { not: 'ANULADA' } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.reserva.groupBy({
        by: ['estado'],
        where: { creado_en: { gte: hoy, lt: manana } },
        _count: { id: true },
      }),
      prisma.producto.findMany({
        where: { activo: true, controla_stock: true },
        take: 5,
        include: {
          stock_movimientos: {
            orderBy: { creado_en: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.libreta.aggregate({
        where: { saldo_vencido: { gt: 0 } },
        _sum: { saldo_vencido: true },
        _count: { id: true },
      }),
      prisma.venta.findMany({
        where: { creado_en: { gte: hoy, lt: manana }, estado: { not: 'ANULADA' } },
        orderBy: { creado_en: 'desc' },
        take: 10,
        include: { cliente: true, usuario: { select: { nombre: true } } },
      }),
      prisma.menu.count({ where: { fecha: { gte: hoy, lt: manana } } }),
      prisma.menu.count({ where: { fecha: { gte: hoy, lt: manana }, estado: 'PUBLICADO' } }),
      prisma.venta.aggregate({
        where: { creado_en: { gte: inicioMes, lte: finMes }, estado: { not: 'ANULADA' } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.reserva.count({
        where: { estado: 'PENDIENTE', creado_en: { gte: hoy, lt: manana } },
      }),
      prisma.cliente.count({ where: { estado: 'ACTIVO' } }),
      prisma.producto.count({ where: { activo: true } }),
      prisma.factura.count({ where: { fecha: { gte: hoy, lt: manana } } }),
      prisma.venta.count({
        where: {
          creado_en: { gte: hoy, lt: manana },
          estado: { not: 'ANULADA' },
          facturada: false,
        },
      }),
      prisma.libreta.count({ where: { estado: 'ACTIVA' } }),
      prisma.compra.count({
        where: { creado_en: { gte: inicioMes, lte: finMes } },
      }),
    ]);

    // Calculate stock for critical items
    const stockData = await Promise.all(
      stockCritico.map(async (prod) => {
        const result = await prisma.stockMovimiento.aggregate({
          where: { producto_id: prod.id },
          _sum: { cantidad: true },
        });
        return { ...prod, stock_actual: Number(result._sum.cantidad ?? 0) };
      })
    );

    const stockBajo = stockData.filter((p) => p.stock_actual <= 10);

    res.json({
      success: true,
      data: {
        ventas_hoy: {
          total: Number(ventasHoy._sum.total ?? 0),
          cantidad: ventasHoy._count.id,
        },
        reservas_hoy: reservasHoy.reduce(
          (acc, r) => ({ ...acc, [r.estado]: r._count.id }),
          {} as Record<string, number>
        ),
        stock_critico: stockBajo,
        deudas_vencidas: {
          total: Number(libretasVencidas._sum.saldo_vencido ?? 0),
          cantidad: libretasVencidas._count.id,
        },
        ultimas_ventas: ultimasVentas,
        menus_del_dia: {
          total: menusHoyTotal,
          publicados: menusPublicadosHoy,
        },
        ventas_mes: {
          total: Number(ventasMes._sum.total ?? 0),
          cantidad: ventasMes._count.id,
        },
        reservas_pendientes_hoy: reservasPendientesHoy,
        clientes_activos: clientesActivos,
        productos_activos: productosActivos,
        facturas_emitidas_hoy: facturasHoy,
        ventas_sin_facturar_hoy: ventasSinFacturarHoy,
        libretas_activas: libretasActivas,
        compras_mes: comprasMes,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener dashboard' });
  }
});

// GET /reportes/ventas
router.get('/ventas', requirePermiso('REPORTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { fecha_desde, fecha_hasta, sucursal_id, tipo_venta } = req.query;

    const where: Record<string, unknown> = { estado: { not: 'ANULADA' } };
    if (sucursal_id) where.sucursal_id = parseInt(String(sucursal_id));
    if (tipo_venta) where.tipo_venta = tipo_venta;
    if (fecha_desde || fecha_hasta) {
      where.creado_en = {};
      if (fecha_desde) (where.creado_en as Record<string, Date>).gte = new Date(String(fecha_desde));
      if (fecha_hasta) (where.creado_en as Record<string, Date>).lte = new Date(String(fecha_hasta));
    }

    const [ventas, totales] = await Promise.all([
      prisma.venta.findMany({
        where,
        orderBy: { creado_en: 'desc' },
        include: {
          cliente: { select: { nombre: true } },
          usuario: { select: { nombre: true } },
          sucursal: { select: { nombre: true } },
        },
      }),
      prisma.venta.aggregate({
        where,
        _sum: { total: true, subtotal: true, iva_total: true, descuento: true },
        _count: { id: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        ventas,
        resumen: {
          total_ventas: ventas.length,
          total_monto: Number(totales._sum.total ?? 0),
          total_iva: Number(totales._sum.iva_total ?? 0),
          total_descuento: Number(totales._sum.descuento ?? 0),
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al generar reporte de ventas' });
  }
});

// GET /reportes/stock
router.get('/stock', requirePermiso('REPORTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { sucursal_id, categoria_id } = req.query;

    const productosWhere: Record<string, unknown> = { activo: true };
    if (categoria_id) productosWhere.categoria_id = parseInt(String(categoria_id));

    const productos = await prisma.producto.findMany({
      where: productosWhere,
      include: { categoria: true },
      orderBy: { nombre: 'asc' },
    });

    const stockData = await Promise.all(
      productos.map(async (prod) => {
        const stockWhere: Record<string, unknown> = { producto_id: prod.id };
        if (sucursal_id) stockWhere.sucursal_id = parseInt(String(sucursal_id));

        const result = await prisma.stockMovimiento.aggregate({
          where: stockWhere,
          _sum: { cantidad: true },
        });
        const stock = Number(result._sum.cantidad ?? 0);
        const valorStock = stock * Number(prod.costo_promedio);

        return {
          ...prod,
          stock_actual: stock,
          valor_stock: valorStock,
        };
      })
    );

    const totalValorStock = stockData.reduce((sum, p) => sum + p.valor_stock, 0);

    res.json({
      success: true,
      data: {
        productos: stockData,
        resumen: {
          total_productos: stockData.length,
          valor_total_stock: totalValorStock,
          productos_sin_stock: stockData.filter((p) => p.stock_actual <= 0).length,
          productos_bajo_minimo: stockData.filter((p) => p.stock_actual > 0 && p.stock_actual <= 10).length,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al generar reporte de stock' });
  }
});

// GET /reportes/libreta
router.get('/libreta', requirePermiso('REPORTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { estado, empresa_id } = req.query;

    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (empresa_id) where.empresa_id = parseInt(String(empresa_id));

    const libretas = await prisma.libreta.findMany({
      where,
      include: { cliente: true, empresa: true },
      orderBy: { saldo_actual: 'desc' },
    });

    const totales = await prisma.libreta.aggregate({
      where,
      _sum: { saldo_actual: true, saldo_vencido: true, limite_credito: true },
    });

    res.json({
      success: true,
      data: {
        libretas,
        resumen: {
          total_libretas: libretas.length,
          total_deuda: Number(totales._sum.saldo_actual ?? 0),
          total_vencido: Number(totales._sum.saldo_vencido ?? 0),
          total_limite: Number(totales._sum.limite_credito ?? 0),
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al generar reporte de libretas' });
  }
});

// GET /reportes/cocina
router.get('/cocina', requirePermiso('COCINA:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const { sucursal_id } = req.query;
    const menuWhere: Record<string, unknown> = {
      fecha: { gte: hoy, lt: manana },
      estado: 'PUBLICADO',
    };
    if (sucursal_id) menuWhere.sucursal_id = parseInt(String(sucursal_id));

    const menus = await prisma.menu.findMany({
      where: menuWhere,
      include: {
        items: { include: { producto: true } },
        reservas: {
          where: { estado: { in: ['CONFIRMADA', 'EN_COCINA', 'PREPARADA'] } },
          include: { cliente: true },
        },
      },
    });

    res.json({ success: true, data: menus });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener reporte de cocina' });
  }
});

// GET /reportes/prediccion
router.get('/prediccion', requirePermiso('REPORTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { sucursal_id } = req.query;

    // Fecha objetivo: por defecto mañana
    let fechaObjetivo: Date;
    if (req.query.fecha) {
      fechaObjetivo = new Date(String(req.query.fecha));
    } else {
      fechaObjetivo = new Date();
      fechaObjetivo.setDate(fechaObjetivo.getDate() + 1);
    }
    fechaObjetivo.setHours(0, 0, 0, 0);

    const diaSemana = fechaObjetivo.getDay(); // 0=Domingo … 6=Sábado

    // Obtener menús de las últimas 8 semanas con el mismo día de semana
    const hace8Semanas = new Date(fechaObjetivo);
    hace8Semanas.setDate(hace8Semanas.getDate() - 8 * 7);

    const menuWhere: Record<string, unknown> = {
      fecha: { gte: hace8Semanas, lt: fechaObjetivo },
      estado: { not: 'CANCELADO' },
    };
    if (sucursal_id) menuWhere.sucursal_id = parseInt(String(sucursal_id));

    const menusHistoricos = await prisma.menu.findMany({
      where: menuWhere,
      include: {
        items: { include: { producto: true } },
        reservas: { where: { estado: 'ENTREGADA' } },
      },
      orderBy: { fecha: 'asc' },
    });

    // Filtrar por mismo día de semana
    const menusMismoDia = menusHistoricos.filter((m) => {
      const d = new Date(m.fecha);
      return d.getDay() === diaSemana;
    });

    // Para cada menú histórico, calcular porciones vendidas
    const historicoConPorciones = await Promise.all(
      menusMismoDia.map(async (menu) => {
        // Reservas entregadas
        const porcionesReservas = menu.reservas.reduce((sum, r) => sum + r.cantidad, 0);

        // Ventas completadas de tipo MENU o MOSTRADOR para esa fecha
        const fechaMenu = new Date(menu.fecha);
        fechaMenu.setHours(0, 0, 0, 0);
        const fechaMenuFin = new Date(fechaMenu);
        fechaMenuFin.setDate(fechaMenuFin.getDate() + 1);

        const ventasWhere: Record<string, unknown> = {
          creado_en: { gte: fechaMenu, lt: fechaMenuFin },
          estado: 'COMPLETADA',
          tipo_venta: { in: ['MENU', 'MOSTRADOR'] },
        };
        if (sucursal_id) ventasWhere.sucursal_id = parseInt(String(sucursal_id));

        const ventasAgg = await prisma.ventaItem.aggregate({
          where: {
            venta: ventasWhere as Record<string, unknown>,
          },
          _sum: { cantidad: true },
        });

        const porcionesVentas = Number(ventasAgg._sum.cantidad ?? 0);
        const porcionesTotal = porcionesReservas + porcionesVentas;

        return {
          fecha: fechaMenu.toISOString().split('T')[0],
          menu_id: menu.id,
          titulo: menu.titulo,
          porciones: porcionesTotal,
        };
      })
    );

    // Calcular estadísticas
    const porciones = historicoConPorciones.map((h) => h.porciones);
    const promedio = porciones.length > 0 ? porciones.reduce((a, b) => a + b, 0) / porciones.length : 0;
    const maximo = porciones.length > 0 ? Math.max(...porciones) : 0;
    const minimo = porciones.length > 0 ? Math.min(...porciones) : 0;
    const prediccion = Math.ceil(promedio * 1.1);

    // Reservas ya confirmadas para la fecha objetivo
    const fechaObjetivoFin = new Date(fechaObjetivo);
    fechaObjetivoFin.setDate(fechaObjetivoFin.getDate() + 1);

    const reservasWhere: Record<string, unknown> = {
      menu: { fecha: { gte: fechaObjetivo, lt: fechaObjetivoFin } },
      estado: { in: ['PENDIENTE', 'CONFIRMADA', 'EN_PREPARACION'] },
    };
    if (sucursal_id) (reservasWhere.menu as Record<string, unknown>).sucursal_id = parseInt(String(sucursal_id));

    const reservasConfirmadas = await prisma.reserva.aggregate({
      where: reservasWhere,
      _sum: { cantidad: true },
    });

    const reservasYaConfirmadas = Number(reservasConfirmadas._sum.cantidad ?? 0);
    const produccionSugerida = prediccion + reservasYaConfirmadas;

    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    res.json({
      success: true,
      data: {
        fecha: fechaObjetivo.toISOString().split('T')[0],
        dia_semana: diasSemana[diaSemana],
        historico: historicoConPorciones,
        promedio: Math.round(promedio * 10) / 10,
        maximo,
        minimo,
        prediccion,
        reservas_ya_confirmadas: reservasYaConfirmadas,
        produccion_sugerida: produccionSugerida,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al calcular predicción de demanda' });
  }
});

// GET /reportes/rentabilidad
router.get('/rentabilidad', requirePermiso('REPORTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { fecha_desde, fecha_hasta, sucursal_id } = req.query;

    const ventaWhere: Record<string, unknown> = { estado: 'COMPLETADA' };
    if (sucursal_id) ventaWhere.sucursal_id = parseInt(String(sucursal_id));
    if (fecha_desde || fecha_hasta) {
      ventaWhere.creado_en = {};
      if (fecha_desde) (ventaWhere.creado_en as Record<string, Date>).gte = new Date(String(fecha_desde));
      if (fecha_hasta) {
        const hasta = new Date(String(fecha_hasta));
        hasta.setHours(23, 59, 59, 999);
        (ventaWhere.creado_en as Record<string, Date>).lte = hasta;
      }
    }

    // Obtener todos los items de ventas del período agrupados por producto
    const itemsAgrupados = await prisma.ventaItem.groupBy({
      by: ['producto_id'],
      where: {
        producto_id: { not: null },
        venta: ventaWhere,
      },
      _sum: { total: true, cantidad: true },
    });

    // Para cada producto, obtener nombre y costo promedio
    const productosIds = itemsAgrupados
      .map((g) => g.producto_id)
      .filter((id): id is number => id !== null);

    const productos = await prisma.producto.findMany({
      where: { id: { in: productosIds } },
      select: { id: true, nombre: true, costo_promedio: true },
    });

    const productosMap = new Map<number, { id: number; nombre: string; costo_promedio: bigint | null }>(productos.map((p) => [p.id, p]));

    const resultado = itemsAgrupados
      .map((grupo) => {
        const producto = productosMap.get(grupo.producto_id!);
        if (!producto) return null;

        const totalVendido = Number(grupo._sum.total ?? 0);
        const unidadesVendidas = Number(grupo._sum.cantidad ?? 0);
        const costoTotal = unidadesVendidas * Number(producto.costo_promedio ?? 0);
        const ganancia = totalVendido - costoTotal;
        const margenPct = totalVendido > 0 ? (ganancia / totalVendido) * 100 : 0;

        return {
          producto_id: producto.id,
          nombre: producto.nombre,
          unidades_vendidas: unidadesVendidas,
          total_vendido: totalVendido,
          costo_total: costoTotal,
          ganancia,
          margen_pct: Math.round(margenPct * 100) / 100,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.ganancia - a.ganancia);

    const totalIngresos = resultado.reduce((sum, r) => sum + r.total_vendido, 0);
    const totalCostos = resultado.reduce((sum, r) => sum + r.costo_total, 0);
    const gananciaTotal = totalIngresos - totalCostos;
    const margenPromedio = totalIngresos > 0 ? (gananciaTotal / totalIngresos) * 100 : 0;

    res.json({
      success: true,
      data: {
        productos: resultado,
        resumen: {
          total_ingresos: totalIngresos,
          total_costos: totalCostos,
          ganancia_total: gananciaTotal,
          margen_promedio: Math.round(margenPromedio * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al generar reporte de rentabilidad' });
  }
});

// GET /reportes/desperdicio
router.get('/desperdicio', requirePermiso('REPORTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { fecha_desde, fecha_hasta } = req.query;

    const movWhere: Record<string, unknown> = {};
    if (fecha_desde || fecha_hasta) {
      movWhere.creado_en = {};
      if (fecha_desde) (movWhere.creado_en as Record<string, Date>).gte = new Date(String(fecha_desde));
      if (fecha_hasta) {
        const hasta = new Date(String(fecha_hasta));
        hasta.setHours(23, 59, 59, 999);
        (movWhere.creado_en as Record<string, Date>).lte = hasta;
      }
    }

    // Entradas del período (COMPRA)
    const entradas = await prisma.stockMovimiento.groupBy({
      by: ['producto_id'],
      where: { ...movWhere, tipo_movimiento: 'ENTRADA' },
      _sum: { cantidad: true },
    });

    // Salidas del período (VENTA + RECETA_VENTA)
    const salidas = await prisma.stockMovimiento.groupBy({
      by: ['producto_id'],
      where: {
        ...movWhere,
        tipo_movimiento: 'SALIDA',
        referencia_tipo: { in: ['VENTA', 'RECETA_VENTA'] },
      },
      _sum: { cantidad: true },
    });

    // Stock real acumulado total por producto (todos los movimientos, sin filtro de fecha)
    const stockReal = await prisma.stockMovimiento.groupBy({
      by: ['producto_id'],
      _sum: { cantidad: true },
    });

    // Construir mapa de stock real
    const stockRealMap = new Map<number | null, number>(stockReal.map((s) => [s.producto_id, Number(s._sum.cantidad ?? 0)]));

    // Construir mapa de entradas y salidas del período
    const entradasMap = new Map<number | null, number>(entradas.map((e) => [e.producto_id, Number(e._sum?.cantidad ?? 0)]));
    const salidasMap = new Map<number | null, number>(salidas.map((s) => [s.producto_id, Number(s._sum?.cantidad ?? 0)]));

    // Unión de todos los productos presentes
    const todosProductoIds = new Set([...entradasMap.keys(), ...salidasMap.keys()]);

    const productos = await prisma.producto.findMany({
      where: { id: { in: Array.from(todosProductoIds).filter((id): id is number => id !== null) }, activo: true },
      select: { id: true, nombre: true, costo_promedio: true, unidad_medida: true },
    });

    const resultado = productos
      .map((prod) => {
        const entradaPeriodo: number = entradasMap.get(prod.id) ?? 0;
        const salidaPeriodo: number = salidasMap.get(prod.id) ?? 0;
        const saldoTeorico: number = entradaPeriodo - salidaPeriodo;
        const stockActual: number = stockRealMap.get(prod.id) ?? 0;
        const diferencia: number = saldoTeorico - stockActual;
        const valorPerdida = diferencia > 0 ? diferencia * Number(prod.costo_promedio ?? 0) : 0;

        return {
          producto_id: prod.id,
          nombre: prod.nombre,
          unidad_medida: prod.unidad_medida,
          entrada_periodo: entradaPeriodo,
          salida_periodo: salidaPeriodo,
          saldo_teorico: saldoTeorico,
          stock_actual: stockActual,
          diferencia,
          valor_perdida_estimada: valorPerdida,
        };
      })
      // Solo mostrar productos donde hay posible desperdicio (saldo_teorico > stock_actual)
      .filter((r) => r.diferencia > 0)
      .sort((a, b) => b.valor_perdida_estimada - a.valor_perdida_estimada);

    const totalPerdidaEstimada = resultado.reduce((sum, r) => sum + r.valor_perdida_estimada, 0);

    res.json({
      success: true,
      data: {
        productos: resultado,
        resumen: {
          total_productos_con_merma: resultado.length,
          valor_perdida_total_estimada: totalPerdidaEstimada,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al generar reporte de desperdicio' });
  }
});

export default router;
