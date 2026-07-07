import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { pick } from '../lib/pick';

const router = Router();
router.use(authenticate);

router.get('/', requirePermiso('CAJAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { sucursal_id, estado } = req.query;
    const where: Record<string, unknown> = { activo: true };
    if (sucursal_id) where.sucursal_id = parseInt(String(sucursal_id));
    if (estado) where.estado = estado;

    const cajas = await prisma.caja.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: { sucursal: true },
    });
    res.json({ success: true, data: cajas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener cajas' });
  }
});

router.get('/:id', requirePermiso('CAJAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const caja = await prisma.caja.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { sucursal: true },
    });
    if (!caja) {
      res.status(404).json({ success: false, message: 'Caja no encontrada' });
      return;
    }
    res.json({ success: true, data: caja });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener caja' });
  }
});

router.post(
  '/',
  requirePermiso('CAJAS:CREAR'),
  [
    body('nombre').notEmpty().withMessage('Nombre requerido'),
    body('sucursal_id').isInt().withMessage('Sucursal requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const caja = await prisma.caja.create({ data: pick(req.body, ['nombre', 'sucursal_id', 'estado', 'activo']), include: { sucursal: true } });
      res.status(201).json({ success: true, message: 'Caja creada', data: caja });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear caja' });
    }
  }
);

router.put('/:id', requirePermiso('CAJAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const caja = await prisma.caja.update({ where: { id }, data: pick(req.body, ['nombre', 'sucursal_id', 'estado', 'activo']), include: { sucursal: true } });
    res.json({ success: true, message: 'Caja actualizada', data: caja });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar caja' });
  }
});

// POST /cajas/:id/abrir
router.post('/:id/abrir', requirePermiso('CAJAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const caja = await prisma.caja.findUnique({ where: { id } });
    if (!caja) {
      res.status(404).json({ success: false, message: 'Caja no encontrada' });
      return;
    }
    if (caja.estado === 'ABIERTA') {
      res.status(400).json({ success: false, message: 'La caja ya está abierta' });
      return;
    }
    const updated = await prisma.caja.update({ where: { id }, data: { estado: 'ABIERTA' } });
    res.json({ success: true, message: 'Caja abierta', data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al abrir caja' });
  }
});

// POST /cajas/:id/cerrar
router.post('/:id/cerrar', requirePermiso('CAJAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const caja = await prisma.caja.findUnique({ where: { id } });
    if (!caja) {
      res.status(404).json({ success: false, message: 'Caja no encontrada' });
      return;
    }
    if (caja.estado === 'CERRADA') {
      res.status(400).json({ success: false, message: 'La caja ya está cerrada' });
      return;
    }
    const updated = await prisma.caja.update({ where: { id }, data: { estado: 'CERRADA' } });
    res.json({ success: true, message: 'Caja cerrada', data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al cerrar caja' });
  }
});

router.delete('/:id', requirePermiso('CAJAS:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.caja.update({ where: { id }, data: { activo: false } });
    res.json({ success: true, message: 'Caja desactivada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al eliminar caja' });
  }
});

export default router;
