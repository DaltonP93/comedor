import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';
import { logger } from '../lib/logger';

const router = Router();
router.use(authenticate);

// GET /recetas
router.get('/', requirePermiso('STOCK:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { producto_id, activo, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (producto_id) where.producto_id = parseInt(String(producto_id));
    if (activo !== undefined) where.activo = activo === 'true';

    const [recetas, total] = await Promise.all([
      prisma.receta.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { id: 'desc' },
        include: {
          producto: { select: { id: true, nombre: true, unidad_medida: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.receta.count({ where }),
    ]);

    res.json({
      success: true,
      data: recetas,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener recetas' });
  }
});

// GET /recetas/:id
router.get('/:id', requirePermiso('STOCK:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const receta = await prisma.receta.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        producto: true,
        items: {
          include: {
            insumo: { select: { id: true, nombre: true, unidad_medida: true } },
          },
        },
      },
    });

    if (!receta) {
      res.status(404).json({ success: false, message: 'Receta no encontrada' });
      return;
    }

    res.json({ success: true, data: receta });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener receta' });
  }
});

// POST /recetas
router.post(
  '/',
  requirePermiso('STOCK:ENTRADA'),
  [
    body('producto_id').isInt({ min: 1 }).withMessage('Producto requerido'),
    body('nombre').notEmpty().withMessage('Nombre requerido'),
    body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un ingrediente'),
    body('items.*.insumo_id').isInt({ min: 1 }).withMessage('Insumo inválido'),
    body('items.*.cantidad').isFloat({ min: 0.001 }).withMessage('Cantidad inválida'),
    body('items.*.unidad').notEmpty().withMessage('Unidad requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { producto_id, nombre, items } = req.body;

      const producto = await prisma.producto.findUnique({ where: { id: producto_id } });
      if (!producto) {
        res.status(400).json({ success: false, message: 'Producto no encontrado' });
        return;
      }

      const receta = await prisma.receta.create({
        data: {
          producto_id,
          nombre,
          activo: true,
          items: {
            create: items.map((item: { insumo_id: number; cantidad: number; unidad: string }) => ({
              insumo_id: item.insumo_id,
              cantidad: item.cantidad,
              unidad: item.unidad,
            })),
          },
        },
        include: {
          producto: true,
          items: {
            include: {
              insumo: { select: { id: true, nombre: true, unidad_medida: true } },
            },
          },
        },
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'RECETAS',
        accion: 'CREAR',
        registroId: receta.id,
        valorNuevo: { producto_id, nombre },
        ip: req.ip,
      });

      res.status(201).json({ success: true, message: 'Receta creada', data: receta });
    } catch (error) {
      logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al crear receta' });
    }
  }
);

// PUT /recetas/:id
router.put(
  '/:id',
  requirePermiso('STOCK:ENTRADA'),
  [
    body('nombre').optional().notEmpty().withMessage('Nombre inválido'),
    body('items').optional().isArray({ min: 1 }).withMessage('Debe incluir al menos un ingrediente'),
    body('items.*.insumo_id').optional().isInt({ min: 1 }).withMessage('Insumo inválido'),
    body('items.*.cantidad').optional().isFloat({ min: 0.001 }).withMessage('Cantidad inválida'),
    body('items.*.unidad').optional().notEmpty().withMessage('Unidad requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const { nombre, activo, items } = req.body;

      const existing = await prisma.receta.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Receta no encontrada' });
        return;
      }

      const receta = await prisma.$transaction(async (tx) => {
        // Delete all items and recreate if provided
        if (items !== undefined) {
          await tx.recetaItem.deleteMany({ where: { receta_id: id } });
        }

        return tx.receta.update({
          where: { id },
          data: {
            ...(nombre !== undefined && { nombre }),
            ...(activo !== undefined && { activo }),
            ...(items !== undefined && {
              items: {
                create: items.map((item: { insumo_id: number; cantidad: number; unidad: string }) => ({
                  insumo_id: item.insumo_id,
                  cantidad: item.cantidad,
                  unidad: item.unidad,
                })),
              },
            }),
          },
          include: {
            producto: true,
            items: {
              include: {
                insumo: { select: { id: true, nombre: true, unidad_medida: true } },
              },
            },
          },
        });
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'RECETAS',
        accion: 'EDITAR',
        registroId: id,
        valorNuevo: { nombre, activo },
        ip: req.ip,
      });

      res.json({ success: true, message: 'Receta actualizada', data: receta });
    } catch (error) {
      logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al actualizar receta' });
    }
  }
);

// DELETE /recetas/:id (soft delete)
router.delete('/:id', requirePermiso('STOCK:ENTRADA'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.receta.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Receta no encontrada' });
      return;
    }

    await prisma.receta.update({ where: { id }, data: { activo: false } });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'RECETAS',
      accion: 'ELIMINAR',
      registroId: id,
      ip: req.ip,
    });

    res.json({ success: true, message: 'Receta eliminada' });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al eliminar receta' });
  }
});

export default router;
