import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /notificaciones
router.get('/', requirePermiso('CONFIGURACION:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { cliente_id, estado, tipo, canal, page = '1', limit = '20' } = req.query;
    const where: Record<string, unknown> = {};
    if (cliente_id) where.cliente_id = parseInt(String(cliente_id));
    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;
    if (canal) where.canal = canal;

    const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));
    const take = parseInt(String(limit));

    const [notificaciones, total] = await Promise.all([
      prisma.notificacion.findMany({
        where,
        include: { cliente: { select: { id: true, nombre: true } } },
        orderBy: { creado_en: 'desc' },
        skip,
        take,
      }),
      prisma.notificacion.count({ where }),
    ]);

    res.json({
      success: true,
      data: notificaciones,
      meta: {
        total,
        page: parseInt(String(page)),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al listar notificaciones' });
  }
});

// POST /notificaciones
router.post('/', requirePermiso('CONFIGURACION:CREAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { cliente_id, tipo, canal, mensaje } = req.body;

    const notificacion = await prisma.notificacion.create({
      data: {
        cliente_id: cliente_id ? parseInt(cliente_id) : null,
        tipo,
        canal,
        mensaje,
        estado: 'PENDIENTE',
      },
    });

    res.status(201).json({ success: true, data: notificacion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al crear notificación' });
  }
});

// PUT /notificaciones/:id/estado
router.put('/:id/estado', requirePermiso('CONFIGURACION:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { estado } = req.body;

    const notificacion = await prisma.notificacion.update({
      where: { id },
      data: { estado },
    });

    res.json({ success: true, data: notificacion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar notificación' });
  }
});

export default router;
