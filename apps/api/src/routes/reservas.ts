import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';
import { AppError } from '../middleware/errorHandler';
import { clientePublicSelect } from '../lib/selects';

const router = Router();
router.use(authenticate);

// GET /reservas
router.get('/', requirePermiso('RESERVAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { estado, menu_id, sucursal_id, fecha, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (menu_id) where.menu_id = parseInt(String(menu_id));
    if (sucursal_id) where.sucursal_id = parseInt(String(sucursal_id));
    if (fecha) {
      const fechaDate = new Date(String(fecha));
      const fechaFin = new Date(fechaDate);
      fechaFin.setDate(fechaFin.getDate() + 1);
      where.creado_en = { gte: fechaDate, lt: fechaFin };
    }

    const [reservas, total] = await Promise.all([
      prisma.reserva.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { creado_en: 'desc' },
        include: {
          cliente: { select: clientePublicSelect },
          menu: true,
          sucursal: true,
        },
      }),
      prisma.reserva.count({ where }),
    ]);

    res.json({
      success: true,
      data: reservas,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener reservas' });
  }
});

// GET /reservas/:id
router.get('/:id', requirePermiso('RESERVAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const reserva = await prisma.reserva.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { cliente: { select: clientePublicSelect }, menu: { include: { items: true } }, sucursal: true, venta: true },
    });
    if (!reserva) {
      res.status(404).json({ success: false, message: 'Reserva no encontrada' });
      return;
    }
    res.json({ success: true, data: reserva });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener reserva' });
  }
});

// POST /reservas
router.post(
  '/',
  requirePermiso('RESERVAS:CREAR'),
  [
    body('cliente_id').isInt().withMessage('Cliente requerido'),
    body('menu_id').isInt().withMessage('Menú requerido'),
    body('cantidad').isInt({ min: 1 }).withMessage('Cantidad inválida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { cliente_id, menu_id, cantidad, tipo_entrega, observacion, forma_pago_prevista } = req.body;

      // Check menu exists and is available
      const menu = await prisma.menu.findUnique({ where: { id: menu_id } });
      if (!menu) {
        res.status(404).json({ success: false, message: 'Menú no encontrado' });
        return;
      }
      if (menu.estado !== 'PUBLICADO') {
        res.status(400).json({ success: false, message: 'El menú no está publicado' });
        return;
      }

      // Check hora limite
      if (menu.hora_limite_reserva && new Date() > menu.hora_limite_reserva) {
        res.status(400).json({ success: false, message: 'El tiempo límite de reserva ha pasado' });
        return;
      }

      // Calculate total
      const total = BigInt(menu.precio) * BigInt(cantidad);

      const reserva = await prisma.$transaction(async (tx) => {
        // Actualización atómica de cupo con bloqueo a nivel de fila
        const result = await tx.$queryRaw<Array<{ id: number }>>`
          UPDATE menus
          SET cupo_reservado = cupo_reservado + ${cantidad}
          WHERE id = ${menu_id}
            AND estado = 'PUBLICADO'
            AND (cupo_total IS NULL OR cupo_reservado + ${cantidad} <= cupo_total)
          RETURNING id
        `;
        if (!result || result.length === 0) {
          throw new AppError(409, 'MENU_SIN_CUPO', 'No hay cupo disponible para este menú');
        }

        const r = await tx.reserva.create({
          data: {
            cliente_id,
            menu_id,
            sucursal_id: menu.sucursal_id,
            cantidad,
            tipo_entrega: tipo_entrega || 'LOCAL',
            observacion,
            forma_pago_prevista,
            estado: 'CONFIRMADA',
            total,
          },
          include: { cliente: { select: clientePublicSelect }, menu: true },
        });

        return r;
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'RESERVAS',
        accion: 'CREAR',
        registroId: reserva.id,
        ip: req.ip,
      });

      res.status(201).json({ success: true, message: 'Reserva creada', data: reserva });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear reserva' });
    }
  }
);

// PUT /reservas/:id/estado
router.put('/:id/estado', requirePermiso('RESERVAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { estado } = req.body;

    const validEstados = ['PENDIENTE', 'CONFIRMADA', 'EN_COCINA', 'PREPARADA', 'ENTREGADA', 'CANCELADA'];
    if (!validEstados.includes(estado)) {
      res.status(400).json({ success: false, message: 'Estado inválido' });
      return;
    }

    const reserva = await prisma.reserva.update({
      where: { id },
      data: { estado },
      include: { cliente: { select: clientePublicSelect }, menu: true },
    });

    res.json({ success: true, message: 'Estado actualizado', data: reserva });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar estado' });
  }
});

// POST /reservas/:id/cancelar
router.post('/:id/cancelar', requirePermiso('RESERVAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const reserva = await prisma.reserva.findUnique({ where: { id }, include: { menu: true } });

    if (!reserva) {
      res.status(404).json({ success: false, message: 'Reserva no encontrada' });
      return;
    }
    if (['CANCELADA', 'ENTREGADA'].includes(reserva.estado)) {
      res.status(400).json({ success: false, message: 'No se puede cancelar esta reserva' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const r = await tx.reserva.update({
        where: { id },
        data: { estado: 'CANCELADA' },
      });

      // Liberar cupo atómicamente (solo si el menú tiene cupo reservado)
      if (reserva.menu) {
        await tx.$queryRaw`
          UPDATE menus
          SET cupo_reservado = GREATEST(0, cupo_reservado - ${reserva.cantidad})
          WHERE id = ${reserva.menu_id}
        `;
      }

      return r;
    });

    res.json({ success: true, message: 'Reserva cancelada', data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al cancelar reserva' });
  }
});

// POST /reservas/:id/convertir-venta
router.post(
  '/:id/convertir-venta',
  requirePermiso('VENTAS:CREAR'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const { caja_id, forma_pago } = req.body;

      const reserva = await prisma.reserva.findUnique({
        where: { id },
        include: { menu: true, cliente: { include: { libretas: true } } },
      });

      if (!reserva) {
        res.status(404).json({ success: false, message: 'Reserva no encontrada' });
        return;
      }
      if (reserva.venta_id) {
        res.status(400).json({ success: false, message: 'Reserva ya convertida en venta' });
        return;
      }
      if (reserva.estado === 'CANCELADA') {
        res.status(400).json({ success: false, message: 'Reserva cancelada' });
        return;
      }

      const menu = reserva.menu;
      const total = reserva.total;
      const esCreditoLibreta = forma_pago === 'LIBRETA';

      // Check libreta if applicable
      if (esCreditoLibreta && reserva.cliente_id) {
        const libreta = reserva.cliente.libretas.find((l) => l.estado === 'ACTIVA');
        if (!libreta) {
          res.status(400).json({ success: false, message: 'El cliente no tiene libreta activa' });
          return;
        }
        const saldoUsado = libreta.saldo_actual + total;
        if (saldoUsado > libreta.limite_credito) {
          res.status(400).json({ success: false, message: 'Límite de crédito excedido' });
          return;
        }
      }

      const venta = await prisma.$transaction(async (tx) => {
        // Create venta
        const v = await tx.venta.create({
          data: {
            sucursal_id: reserva.sucursal_id,
            caja_id: caja_id || undefined,
            cliente_id: reserva.cliente_id,
            usuario_id: req.user!.userId,
            tipo_venta: 'RESERVA',
            estado: 'COMPLETADA',
            condicion_pago: esCreditoLibreta ? 'CREDITO' : 'CONTADO',
            subtotal: total,
            descuento: BigInt(0),
            iva_total: BigInt(0),
            total,
            cargada_libreta: esCreditoLibreta,
            items: {
              create: [
                {
                  descripcion: menu.titulo,
                  cantidad: reserva.cantidad,
                  unidad_medida: 'PORCION',
                  precio_unitario: menu.precio,
                  subtotal: total,
                  total,
                },
              ],
            },
          },
        });

        // Update reserva
        await tx.reserva.update({
          where: { id },
          data: { venta_id: v.id, estado: 'ENTREGADA' },
        });

        // Handle libreta
        if (esCreditoLibreta && reserva.cliente_id) {
          const libreta = await tx.libreta.findFirst({
            where: { cliente_id: reserva.cliente_id, estado: 'ACTIVA' },
          });
          if (libreta) {
            const nuevoSaldo = libreta.saldo_actual + total;
            await tx.libreta.update({
              where: { id: libreta.id },
              data: { saldo_actual: nuevoSaldo },
            });
            await tx.libretaMovimiento.create({
              data: {
                libreta_id: libreta.id,
                venta_id: v.id,
                tipo_movimiento: 'CARGO',
                descripcion: `Venta por reserva - ${menu.titulo}`,
                monto_debe: total,
                monto_haber: BigInt(0),
                saldo_resultante: nuevoSaldo,
                usuario_id: req.user!.userId,
              },
            });
          }
        }

        // Create pago if contado
        if (!esCreditoLibreta) {
          await tx.pago.create({
            data: {
              venta_id: v.id,
              cliente_id: reserva.cliente_id || undefined,
              forma_pago: forma_pago || 'EFECTIVO',
              monto: total,
              estado: 'CONFIRMADO',
            },
          });
        }

        return v;
      });

      res.status(201).json({ success: true, message: 'Venta creada desde reserva', data: venta });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al convertir reserva en venta' });
    }
  }
);

export default router;
