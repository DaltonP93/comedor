import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', requirePermiso('CONFIGURACION:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const configuraciones = await prisma.configuracion.findMany({ orderBy: { clave: 'asc' } });
    // Convert to key-value map
    const configMap = configuraciones.reduce(
      (acc, c) => ({ ...acc, [c.clave]: { valor: c.valor, descripcion: c.descripcion, id: c.id } }),
      {} as Record<string, { valor: string; descripcion: string | null; id: number }>
    );
    res.json({ success: true, data: configMap, list: configuraciones });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener configuraciones' });
  }
});

router.put('/:clave', requirePermiso('CONFIGURACION:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { clave } = req.params;
    const { valor, descripcion } = req.body;

    const config = await prisma.configuracion.upsert({
      where: { clave },
      update: { valor, ...(descripcion && { descripcion }) },
      create: { clave, valor, descripcion },
    });

    res.json({ success: true, message: 'Configuración actualizada', data: config });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar configuración' });
  }
});

export default router;
