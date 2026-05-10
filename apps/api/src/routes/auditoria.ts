import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', requirePermiso('AUDITORIA:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { modulo, accion, usuario_id, fecha_desde, fecha_hasta, page = '1', limit = '30' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (modulo) where.modulo = String(modulo);
    if (accion) where.accion = String(accion);
    if (usuario_id) where.usuario_id = parseInt(String(usuario_id));
    if (fecha_desde || fecha_hasta) {
      where.creado_en = {};
      if (fecha_desde) (where.creado_en as Record<string, Date>).gte = new Date(String(fecha_desde));
      if (fecha_hasta) (where.creado_en as Record<string, Date>).lte = new Date(String(fecha_hasta));
    }

    const [registros, total] = await Promise.all([
      prisma.auditoria.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { creado_en: 'desc' },
        include: { usuario: { select: { nombre: true, apellido: true, email: true } } },
      }),
      prisma.auditoria.count({ where }),
    ]);

    res.json({
      success: true,
      data: registros,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener auditoría' });
  }
});

export default router;
