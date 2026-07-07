import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { pick } from '../lib/pick';
import { logger } from '../lib/logger';

const router = Router();
router.use(authenticate);

router.get('/', requirePermiso('PROVEEDORES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { buscar, activo } = req.query;
    const where: Record<string, unknown> = {};
    if (activo !== undefined) where.activo = activo === 'true';
    if (buscar) {
      where.OR = [
        { nombre: { contains: String(buscar), mode: 'insensitive' } },
        { ruc: { contains: String(buscar), mode: 'insensitive' } },
      ];
    }
    const proveedores = await prisma.proveedor.findMany({ where, orderBy: { nombre: 'asc' } });
    res.json({ success: true, data: proveedores });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener proveedores' });
  }
});

router.get('/:id', requirePermiso('PROVEEDORES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const proveedor = await prisma.proveedor.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { _count: { select: { compras: true } } },
    });
    if (!proveedor) {
      res.status(404).json({ success: false, message: 'Proveedor no encontrado' });
      return;
    }
    res.json({ success: true, data: proveedor });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener proveedor' });
  }
});

router.post(
  '/',
  requirePermiso('PROVEEDORES:CREAR'),
  [body('nombre').notEmpty().withMessage('Nombre requerido'), handleValidation],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const proveedor = await prisma.proveedor.create({ data: pick(req.body, ['nombre', 'ruc', 'telefono', 'email', 'direccion', 'activo']) });
      res.status(201).json({ success: true, message: 'Proveedor creado', data: proveedor });
    } catch (error) {
      logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al crear proveedor' });
    }
  }
);

router.put('/:id', requirePermiso('PROVEEDORES:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const proveedor = await prisma.proveedor.update({ where: { id }, data: pick(req.body, ['nombre', 'ruc', 'telefono', 'email', 'direccion', 'activo']) });
    res.json({ success: true, message: 'Proveedor actualizado', data: proveedor });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al actualizar proveedor' });
  }
});

router.delete('/:id', requirePermiso('PROVEEDORES:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.proveedor.update({ where: { id }, data: { activo: false } });
    res.json({ success: true, message: 'Proveedor desactivado' });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al eliminar proveedor' });
  }
});

export default router;
