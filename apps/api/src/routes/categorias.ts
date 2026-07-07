import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { pick } from '../lib/pick';

const router = Router();
router.use(authenticate);

router.get('/', requirePermiso('CATEGORIAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { activo } = req.query;
    const where: Record<string, unknown> = {};
    if (activo !== undefined) where.activo = activo === 'true';

    const categorias = await prisma.categoriaProducto.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { productos: true } } },
    });
    res.json({ success: true, data: categorias });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener categorías' });
  }
});

router.get('/:id', requirePermiso('CATEGORIAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const categoria = await prisma.categoriaProducto.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { productos: { where: { activo: true } } },
    });
    if (!categoria) {
      res.status(404).json({ success: false, message: 'Categoría no encontrada' });
      return;
    }
    res.json({ success: true, data: categoria });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener categoría' });
  }
});

router.post(
  '/',
  requirePermiso('CATEGORIAS:CREAR'),
  [body('nombre').notEmpty().withMessage('Nombre requerido'), handleValidation],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const categoria = await prisma.categoriaProducto.create({ data: pick(req.body, ['nombre', 'descripcion', 'activo']) });
      res.status(201).json({ success: true, message: 'Categoría creada', data: categoria });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear categoría' });
    }
  }
);

router.put('/:id', requirePermiso('CATEGORIAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const categoria = await prisma.categoriaProducto.update({ where: { id }, data: pick(req.body, ['nombre', 'descripcion', 'activo']) });
    res.json({ success: true, message: 'Categoría actualizada', data: categoria });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar categoría' });
  }
});

router.delete('/:id', requirePermiso('CATEGORIAS:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.categoriaProducto.update({ where: { id }, data: { activo: false } });
    res.json({ success: true, message: 'Categoría desactivada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al eliminar categoría' });
  }
});

export default router;
