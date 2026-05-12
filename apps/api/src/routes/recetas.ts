import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { registrarAuditoria } from '../lib/audit';

const router = Router();
router.use(authenticate);

// GET /recetas
router.get('/', requirePermiso('PRODUCTOS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { producto_id, activo } = req.query;
    const where: Record<string, unknown> = {};
    if (producto_id) where.producto_id = parseInt(String(producto_id));
    if (activo !== undefined) where.activo = activo === 'true';

    const recetas = await prisma.receta.findMany({
      where,
      include: {
        producto: { select: { id: true, nombre: true, codigo: true } },
        items: {
          include: {
            insumo: { select: { id: true, nombre: true, codigo: true, unidad_medida: true } },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    res.json({ success: true, data: recetas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al listar recetas' });
  }
});

// GET /recetas/:id
router.get('/:id', requirePermiso('PRODUCTOS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const receta = await prisma.receta.findUnique({
      where: { id },
      include: {
        producto: true,
        items: {
          include: {
            insumo: { select: { id: true, nombre: true, codigo: true, unidad_medida: true, costo_promedio: true } },
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
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener receta' });
  }
});

// POST /recetas
router.post('/', requirePermiso('PRODUCTOS:CREAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { producto_id, nombre, items } = req.body;

    const receta = await prisma.receta.create({
      data: {
        producto_id: parseInt(producto_id),
        nombre,
        items: {
          create: (items || []).map((item: { insumo_id: number; cantidad: number; unidad: string }) => ({
            insumo_id: item.insumo_id,
            cantidad: item.cantidad,
            unidad: item.unidad || 'UNIDAD',
          })),
        },
      },
      include: {
        producto: true,
        items: { include: { insumo: true } },
      },
    });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'RECETAS',
      accion: 'CREAR',
      registroId: receta.id,
      valorNuevo: { nombre, producto_id },
      ip: req.ip,
    });

    res.status(201).json({ success: true, data: receta });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al crear receta' });
  }
});

// PUT /recetas/:id
router.put('/:id', requirePermiso('PRODUCTOS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { nombre, activo, items } = req.body;

    // Delete existing items and recreate
    if (items) {
      await prisma.recetaItem.deleteMany({ where: { receta_id: id } });
    }

    const receta = await prisma.receta.update({
      where: { id },
      data: {
        nombre,
        activo,
        ...(items
          ? {
              items: {
                create: items.map((item: { insumo_id: number; cantidad: number; unidad: string }) => ({
                  insumo_id: item.insumo_id,
                  cantidad: item.cantidad,
                  unidad: item.unidad || 'UNIDAD',
                })),
              },
            }
          : {}),
      },
      include: {
        producto: true,
        items: { include: { insumo: true } },
      },
    });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'RECETAS',
      accion: 'EDITAR',
      registroId: receta.id,
      ip: req.ip,
    });

    res.json({ success: true, data: receta });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar receta' });
  }
});

// DELETE /recetas/:id
router.delete('/:id', requirePermiso('PRODUCTOS:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.receta.delete({ where: { id } });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'RECETAS',
      accion: 'ELIMINAR',
      registroId: id,
      ip: req.ip,
    });

    res.json({ success: true, message: 'Receta eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al eliminar receta' });
  }
});

export default router;
