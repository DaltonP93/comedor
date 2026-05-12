import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';

const router = Router();
router.use(authenticate);

// GET /notificaciones
router.get('/', requirePermiso('CLIENTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { estado, tipo, canal, cliente_id, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;
    if (canal) where.canal = canal;
    if (cliente_id) where.cliente_id = parseInt(String(cliente_id));

    const [notificaciones, total] = await Promise.all([
      prisma.notificacion.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { creado_en: 'desc' },
        include: {
          cliente: {
            select: { id: true, nombre: true, telefono: true, email: true },
          },
        },
      }),
      prisma.notificacion.count({ where }),
    ]);

    res.json({
      success: true,
      data: notificaciones,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener notificaciones' });
  }
});

// GET /notificaciones/:id
router.get('/:id', requirePermiso('CLIENTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const notificacion = await prisma.notificacion.findUnique({
      where: { id },
      include: {
        cliente: {
          select: { id: true, nombre: true, telefono: true, email: true, whatsapp: true },
        },
      },
    });

    if (!notificacion) {
      res.status(404).json({ success: false, message: 'Notificación no encontrada' });
      return;
    }

    res.json({ success: true, data: notificacion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener notificación' });
  }
});

// POST /notificaciones
router.post(
  '/',
  requirePermiso('CLIENTES:EDITAR'),
  [
    body('tipo').notEmpty().withMessage('Tipo requerido'),
    body('canal').isIn(['WHATSAPP', 'EMAIL', 'SMS']).withMessage('Canal inválido. Use WHATSAPP, EMAIL o SMS'),
    body('mensaje').notEmpty().withMessage('Mensaje requerido'),
    body('cliente_id').optional({ nullable: true }).isInt().withMessage('cliente_id debe ser un número entero'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { cliente_id, tipo, canal, mensaje } = req.body;

      const notificacion = await prisma.notificacion.create({
        data: {
          cliente_id: cliente_id ? parseInt(String(cliente_id)) : null,
          tipo,
          canal,
          mensaje,
          estado: 'PENDIENTE',
        },
        include: {
          cliente: { select: { id: true, nombre: true } },
        },
      });

      res.status(201).json({ success: true, message: 'Notificación creada', data: notificacion });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear notificación' });
    }
  }
);

// PUT /notificaciones/:id/marcar-enviada
router.put('/:id/marcar-enviada', requirePermiso('CLIENTES:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const notificacion = await prisma.notificacion.findUnique({ where: { id } });

    if (!notificacion) {
      res.status(404).json({ success: false, message: 'Notificación no encontrada' });
      return;
    }

    if (notificacion.estado !== 'PENDIENTE') {
      res.status(400).json({ success: false, message: 'Solo se pueden marcar como enviadas las notificaciones pendientes' });
      return;
    }

    const actualizada = await prisma.notificacion.update({
      where: { id },
      data: { estado: 'ENVIADA' },
    });

    res.json({ success: true, message: 'Notificación marcada como enviada', data: actualizada });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar notificación' });
  }
});

// POST /notificaciones/envio-masivo
router.post('/envio-masivo', requirePermiso('CLIENTES:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    // Buscar todas las libretas activas con saldo vencido > 0 que tengan clientes con notificaciones permitidas
    const libretasVencidas = await prisma.libreta.findMany({
      where: {
        estado: 'ACTIVA',
        saldo_vencido: { gt: 0 },
        cliente: {
          permite_notificaciones: true,
        },
      },
      include: {
        cliente: {
          select: { id: true, nombre: true, canal_preferido: true, saldo_vencido: true },
        },
      },
    });

    if (libretasVencidas.length === 0) {
      res.json({
        success: true,
        message: 'No hay clientes con saldo vencido para notificar',
        data: { creadas: 0 },
      });
      return;
    }

    const notificaciones = libretasVencidas.map((libreta) => ({
      cliente_id: libreta.cliente_id,
      tipo: 'RECORDATORIO_PAGO',
      canal: libreta.cliente.canal_preferido || 'WHATSAPP',
      mensaje: `Estimado/a ${libreta.cliente.nombre}, le recordamos que tiene un saldo vencido de Gs. ${Number(libreta.saldo_vencido).toLocaleString('es-PY')} en su libreta. Por favor regularice su situación. Sistema Comedor.`,
      estado: 'PENDIENTE',
    }));

    await prisma.notificacion.createMany({ data: notificaciones });

    res.json({
      success: true,
      message: `Se crearon ${notificaciones.length} notificaciones de recordatorio`,
      data: { creadas: notificaciones.length },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al crear notificaciones masivas' });
  }
});

// DELETE /notificaciones/:id
router.delete('/:id', requirePermiso('CLIENTES:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const notificacion = await prisma.notificacion.findUnique({ where: { id } });

    if (!notificacion) {
      res.status(404).json({ success: false, message: 'Notificación no encontrada' });
      return;
    }

    if (notificacion.estado !== 'PENDIENTE') {
      res.status(400).json({ success: false, message: 'Solo se pueden eliminar notificaciones pendientes' });
      return;
    }

    await prisma.notificacion.delete({ where: { id } });

    res.json({ success: true, message: 'Notificación eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al eliminar notificación' });
  }
});

export default router;
