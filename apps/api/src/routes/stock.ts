import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';

const router = Router();
router.use(authenticate);

// GET /stock - stock levels
router.get('/', requirePermiso('STOCK:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { sucursal_id, categoria_id, bajo_minimo } = req.query;

    const productosWhere: Record<string, unknown> = { activo: true, controla_stock: true };
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
        const stockActual = Number(result._sum.cantidad ?? 0);

        return {
          ...prod,
          stock_actual: stockActual,
          stock_minimo: 10, // default, could be per-product config
        };
      })
    );

    const filtered = bajo_minimo === 'true'
      ? stockData.filter((p) => p.stock_actual <= p.stock_minimo)
      : stockData;

    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener stock' });
  }
});

// GET /stock/kardex/:productoId
router.get('/kardex/:productoId', requirePermiso('STOCK:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const productoId = parseInt(req.params.productoId);
    const { sucursal_id, fecha_desde, fecha_hasta, page = '1', limit = '30' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { producto_id: productoId };
    if (sucursal_id) where.sucursal_id = parseInt(String(sucursal_id));
    if (fecha_desde || fecha_hasta) {
      where.creado_en = {};
      if (fecha_desde) (where.creado_en as Record<string, Date>).gte = new Date(String(fecha_desde));
      if (fecha_hasta) (where.creado_en as Record<string, Date>).lte = new Date(String(fecha_hasta));
    }

    const [movimientos, total] = await Promise.all([
      prisma.stockMovimiento.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { creado_en: 'desc' },
        include: {
          producto: true,
          sucursal: true,
          usuario: { select: { nombre: true, apellido: true } },
        },
      }),
      prisma.stockMovimiento.count({ where }),
    ]);

    const stockTotal = await prisma.stockMovimiento.aggregate({
      where: { producto_id: productoId },
      _sum: { cantidad: true },
    });

    res.json({
      success: true,
      data: movimientos,
      stockActual: Number(stockTotal._sum.cantidad ?? 0),
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener kardex' });
  }
});

// POST /stock/entrada
router.post(
  '/entrada',
  requirePermiso('STOCK:CREAR'),
  [
    body('producto_id').isInt().withMessage('Producto requerido'),
    body('cantidad').isFloat({ min: 0.001 }).withMessage('Cantidad inválida'),
    body('sucursal_id').isInt().withMessage('Sucursal requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { producto_id, sucursal_id, cantidad, costo_unitario, observacion, referencia_tipo, referencia_id } = req.body;

      const movimiento = await prisma.stockMovimiento.create({
        data: {
          producto_id,
          sucursal_id,
          tipo_movimiento: 'ENTRADA',
          referencia_tipo: referencia_tipo || 'MANUAL',
          referencia_id: referencia_id || undefined,
          cantidad: Math.abs(cantidad),
          costo_unitario: costo_unitario ? BigInt(costo_unitario) : undefined,
          observacion,
          usuario_id: req.user!.userId,
        },
        include: { producto: true, sucursal: true },
      });

      // Update product average cost if provided
      if (costo_unitario) {
        await prisma.producto.update({
          where: { id: producto_id },
          data: { costo_promedio: BigInt(costo_unitario) },
        });
      }

      res.status(201).json({ success: true, message: 'Entrada registrada', data: movimiento });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al registrar entrada' });
    }
  }
);

// POST /stock/ajuste
router.post(
  '/ajuste',
  requirePermiso('STOCK:EDITAR'),
  [
    body('producto_id').isInt().withMessage('Producto requerido'),
    body('cantidad').isFloat().withMessage('Cantidad inválida'),
    body('sucursal_id').isInt().withMessage('Sucursal requerida'),
    body('observacion').notEmpty().withMessage('Observación requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { producto_id, sucursal_id, cantidad, observacion } = req.body;

      const movimiento = await prisma.stockMovimiento.create({
        data: {
          producto_id,
          sucursal_id,
          tipo_movimiento: 'AJUSTE',
          referencia_tipo: 'AJUSTE_MANUAL',
          cantidad: Number(cantidad),
          observacion,
          usuario_id: req.user!.userId,
        },
        include: { producto: true, sucursal: true },
      });

      res.status(201).json({ success: true, message: 'Ajuste registrado', data: movimiento });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al registrar ajuste' });
    }
  }
);

export default router;
