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

    const [
      ventasHoy,
      reservasHoy,
      stockCritico,
      libretasVencidas,
      ultimasVentas,
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

export default router;
