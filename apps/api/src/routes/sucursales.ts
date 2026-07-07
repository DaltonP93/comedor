import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { pick } from '../lib/pick';

const router = Router();
router.use(authenticate);

router.get('/', requirePermiso('SUCURSALES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { activo } = req.query;
    const where: Record<string, unknown> = {};
    if (activo !== undefined) where.activo = activo === 'true';
    const sucursales = await prisma.sucursal.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: { cajas: true, _count: { select: { usuarios: true } } },
    });
    res.json({ success: true, data: sucursales });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener sucursales' });
  }
});

router.get('/:id', requirePermiso('SUCURSALES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const sucursal = await prisma.sucursal.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { cajas: true, usuarios: { select: { id: true, nombre: true, apellido: true, email: true, rol: true } } },
    });
    if (!sucursal) {
      res.status(404).json({ success: false, message: 'Sucursal no encontrada' });
      return;
    }
    res.json({ success: true, data: sucursal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener sucursal' });
  }
});

router.post(
  '/',
  requirePermiso('SUCURSALES:CREAR'),
  [body('nombre').notEmpty().withMessage('Nombre requerido'), handleValidation],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const sucursal = await prisma.sucursal.create({ data: pick(req.body, ['nombre', 'direccion', 'telefono', 'activo']) });
      res.status(201).json({ success: true, message: 'Sucursal creada', data: sucursal });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear sucursal' });
    }
  }
);

router.put('/:id', requirePermiso('SUCURSALES:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const sucursal = await prisma.sucursal.update({ where: { id }, data: pick(req.body, ['nombre', 'direccion', 'telefono', 'activo']) });
    res.json({ success: true, message: 'Sucursal actualizada', data: sucursal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar sucursal' });
  }
});

router.delete('/:id', requirePermiso('SUCURSALES:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.sucursal.update({ where: { id }, data: { activo: false } });
    res.json({ success: true, message: 'Sucursal desactivada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al eliminar sucursal' });
  }
});

export default router;
