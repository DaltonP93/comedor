import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { pick } from '../lib/pick';

const router = Router();
router.use(authenticate);

router.get('/', requirePermiso('CONCEPTOS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { activo } = req.query;
    const where: Record<string, unknown> = {};
    if (activo !== undefined) where.activo = activo === 'true';

    const conceptos = await prisma.conceptoVenta.findMany({
      where,
      orderBy: { nombre: 'asc' },
    });
    res.json({ success: true, data: conceptos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener conceptos' });
  }
});

router.get('/:id', requirePermiso('CONCEPTOS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const concepto = await prisma.conceptoVenta.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!concepto) {
      res.status(404).json({ success: false, message: 'Concepto no encontrado' });
      return;
    }
    res.json({ success: true, data: concepto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener concepto' });
  }
});

router.post(
  '/',
  requirePermiso('CONCEPTOS:CREAR'),
  [
    body('nombre').notEmpty().withMessage('Nombre requerido'),
    body('codigo').notEmpty().withMessage('Código requerido'),
    body('tipo').notEmpty().withMessage('Tipo requerido'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const concepto = await prisma.conceptoVenta.create({ data: pick(req.body, ['nombre', 'codigo', 'tipo', 'aplica_iva', 'tasa_iva', 'se_factura', 'afecta_stock', 'permite_descuento', 'permite_libreta', 'permite_reserva', 'activo']) });
      res.status(201).json({ success: true, message: 'Concepto creado', data: concepto });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear concepto' });
    }
  }
);

router.put('/:id', requirePermiso('CONCEPTOS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const concepto = await prisma.conceptoVenta.update({ where: { id }, data: pick(req.body, ['nombre', 'codigo', 'tipo', 'aplica_iva', 'tasa_iva', 'se_factura', 'afecta_stock', 'permite_descuento', 'permite_libreta', 'permite_reserva', 'activo']) });
    res.json({ success: true, message: 'Concepto actualizado', data: concepto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar concepto' });
  }
});

router.delete('/:id', requirePermiso('CONCEPTOS:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.conceptoVenta.update({ where: { id }, data: { activo: false } });
    res.json({ success: true, message: 'Concepto desactivado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al eliminar concepto' });
  }
});

export default router;
