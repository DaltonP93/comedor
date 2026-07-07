import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { pick } from '../lib/pick';

const router = Router();
router.use(authenticate);

router.get('/', requirePermiso('COMPRAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { proveedor_id, estado, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (proveedor_id) where.proveedor_id = parseInt(String(proveedor_id));
    if (estado) where.estado = estado;

    const [compras, total] = await Promise.all([
      prisma.compra.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { creado_en: 'desc' },
        include: { proveedor: true, _count: { select: { items: true } } },
      }),
      prisma.compra.count({ where }),
    ]);

    res.json({
      success: true,
      data: compras,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener compras' });
  }
});

router.get('/:id', requirePermiso('COMPRAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const compra = await prisma.compra.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { proveedor: true, items: { include: { producto: true } }, usuario: { select: { nombre: true } } },
    });
    if (!compra) {
      res.status(404).json({ success: false, message: 'Compra no encontrada' });
      return;
    }
    res.json({ success: true, data: compra });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener compra' });
  }
});

router.post(
  '/',
  requirePermiso('COMPRAS:CREAR'),
  [
    body('proveedor_id').isInt().withMessage('Proveedor requerido'),
    body('items').isArray({ min: 1 }).withMessage('Items requeridos'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { proveedor_id, numero_factura, items, sucursal_id } = req.body;

      interface CompraItem {
        producto_id: number;
        cantidad: number;
        unidad?: string;
        costo_unitario: number;
        iva_porcentaje?: number;
      }

      let subtotal = BigInt(0);
      let ivaTotal = BigInt(0);

      const itemsCalculados = (items as CompraItem[]).map((item) => {
        const itemSubtotal = BigInt(item.costo_unitario) * BigInt(Math.round(item.cantidad * 1000)) / BigInt(1000);
        const iva = (itemSubtotal * BigInt(item.iva_porcentaje ?? 10)) / BigInt(100);
        subtotal += itemSubtotal;
        ivaTotal += iva;
        return {
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          unidad: item.unidad || 'UNIDAD',
          costo_unitario: BigInt(item.costo_unitario),
          iva_porcentaje: item.iva_porcentaje ?? 10,
          subtotal: itemSubtotal,
        };
      });

      const total = subtotal + ivaTotal;

      const compra = await prisma.$transaction(async (tx) => {
        const c = await tx.compra.create({
          data: {
            proveedor_id,
            numero_factura,
            subtotal,
            iva_total: ivaTotal,
            total,
            estado: 'CONFIRMADA',
            usuario_id: req.user!.userId,
            items: { create: itemsCalculados },
          },
          include: { items: { include: { producto: true } }, proveedor: true },
        });

        // Create stock movements
        for (const item of items as CompraItem[]) {
          await tx.stockMovimiento.create({
            data: {
              producto_id: item.producto_id,
              sucursal_id: sucursal_id || 1,
              tipo_movimiento: 'ENTRADA',
              referencia_tipo: 'COMPRA',
              referencia_id: c.id,
              cantidad: Math.abs(item.cantidad),
              costo_unitario: BigInt(item.costo_unitario),
              observacion: `Compra #${c.id}`,
              usuario_id: req.user!.userId,
            },
          });

          // Update avg cost
          await tx.producto.update({
            where: { id: item.producto_id },
            data: { costo_promedio: BigInt(item.costo_unitario) },
          });
        }

        return c;
      });

      res.status(201).json({ success: true, message: 'Compra registrada', data: compra });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al registrar compra' });
    }
  }
);

router.put('/:id', requirePermiso('COMPRAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const compra = await prisma.compra.findUnique({ where: { id } });
    if (!compra) {
      res.status(404).json({ success: false, message: 'Compra no encontrada' });
      return;
    }
    if (compra.estado === 'ANULADA') {
      res.status(400).json({ success: false, message: 'No se puede editar una compra anulada' });
      return;
    }
    const updated = await prisma.compra.update({ where: { id }, data: pick(req.body, ['numero_factura','fecha','estado']) });
    res.json({ success: true, message: 'Compra actualizada', data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar compra' });
  }
});

router.delete('/:id', requirePermiso('COMPRAS:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.compra.update({ where: { id }, data: { estado: 'ANULADA' } });
    res.json({ success: true, message: 'Compra anulada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al anular compra' });
  }
});

export default router;
