import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';
import { generarPDFEstadoCuenta } from '../lib/pdf';
import { clientePublicSelect } from '../lib/selects';
import { logger } from '../lib/logger';

const router = Router();
router.use(authenticate);

// GET /libretas
router.get('/', requirePermiso('LIBRETAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { estado, cliente_id, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (cliente_id) where.cliente_id = parseInt(String(cliente_id));

    const [libretas, total] = await Promise.all([
      prisma.libreta.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { creado_en: 'desc' },
        include: { cliente: { select: clientePublicSelect }, empresa: true },
      }),
      prisma.libreta.count({ where }),
    ]);

    res.json({
      success: true,
      data: libretas,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener libretas' });
  }
});

// GET /libretas/:id
router.get('/:id', requirePermiso('LIBRETAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    let libreta = await prisma.libreta.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { cliente: { select: clientePublicSelect }, empresa: true },
    });
    if (!libreta) {
      res.status(404).json({ success: false, message: 'Libreta no encontrada' });
      return;
    }

    // Bloqueo automático por mora: si está ACTIVA, tiene saldo actual > 0 y pasó el día de vencimiento del mes
    let bloqueada_automaticamente = false;
    if (libreta.estado === 'ACTIVA' && libreta.saldo_actual > BigInt(0) && libreta.dia_vencimiento) {
      const hoy = new Date();
      if (hoy.getDate() > libreta.dia_vencimiento) {
        libreta = await prisma.libreta.update({
          where: { id: libreta.id },
          data: { estado: 'BLOQUEADA', saldo_vencido: libreta.saldo_actual },
          include: { cliente: { select: clientePublicSelect }, empresa: true },
        });
        bloqueada_automaticamente = true;

        await registrarAuditoria({
          usuarioId: req.user?.userId,
          modulo: 'LIBRETAS',
          accion: 'BLOQUEO_AUTOMATICO',
          registroId: libreta.id,
          valorNuevo: { motivo: 'Deuda vencida: superó día de vencimiento del mes', saldo_vencido: String(libreta.saldo_vencido) },
          ip: req.ip,
        });
      }
    }

    res.json({ success: true, data: { ...libreta, bloqueada_automaticamente } });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener libreta' });
  }
});

// GET /libretas/:id/movimientos
router.get('/:id/movimientos', requirePermiso('LIBRETAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { page = '1', limit = '30' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const [movimientos, total] = await Promise.all([
      prisma.libretaMovimiento.findMany({
        where: { libreta_id: id },
        skip,
        take: limitNum,
        orderBy: { fecha_movimiento: 'desc' },
        include: { venta: true, pago: true, usuario: { select: { nombre: true, apellido: true } } },
      }),
      prisma.libretaMovimiento.count({ where: { libreta_id: id } }),
    ]);

    res.json({
      success: true,
      data: movimientos,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener movimientos' });
  }
});

// POST /libretas
router.post(
  '/',
  requirePermiso('LIBRETAS:CREAR'),
  [
    body('cliente_id').isInt().withMessage('Cliente requerido'),
    body('limite_credito').isInt({ min: 0 }).withMessage('Límite inválido'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { cliente_id, empresa_id, tipo, limite_credito, dia_corte, dia_vencimiento } = req.body;

      // Check if cliente already has active libreta
      const existente = await prisma.libreta.findFirst({
        where: { cliente_id, estado: 'ACTIVA' },
      });
      if (existente) {
        res.status(400).json({ success: false, message: 'El cliente ya tiene una libreta activa' });
        return;
      }

      const libreta = await prisma.libreta.create({
        data: {
          cliente_id,
          empresa_id: empresa_id || undefined,
          tipo: tipo || 'PERSONAL',
          limite_credito: BigInt(limite_credito),
          saldo_actual: BigInt(0),
          saldo_vencido: BigInt(0),
          dia_corte,
          dia_vencimiento,
          estado: 'ACTIVA',
        },
        include: { cliente: { select: clientePublicSelect } },
      });

      res.status(201).json({ success: true, message: 'Libreta creada', data: libreta });
    } catch (error) {
      logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al crear libreta' });
    }
  }
);

// PUT /libretas/:id
router.put('/:id', requirePermiso('LIBRETAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    // Allowlist explícita: nunca hacer spread de req.body.
    // saldo_actual / saldo_vencido son gestionados por el ledger, NO editables por API.
    const data: Record<string, unknown> = {};
    if (req.body.tipo !== undefined) data.tipo = req.body.tipo;
    if (req.body.estado !== undefined) data.estado = req.body.estado;
    if (req.body.dia_corte !== undefined) data.dia_corte = Number(req.body.dia_corte);
    if (req.body.dia_vencimiento !== undefined) data.dia_vencimiento = Number(req.body.dia_vencimiento);
    if (req.body.empresa_id !== undefined) data.empresa_id = req.body.empresa_id;
    if (req.body.limite_credito !== undefined) data.limite_credito = BigInt(req.body.limite_credito);

    const libreta = await prisma.libreta.update({
      where: { id },
      data,
      include: { cliente: { select: { id: true, nombre: true, telefono: true, email: true } } },
    });
    res.json({ success: true, message: 'Libreta actualizada', data: libreta });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al actualizar libreta' });
  }
});

// POST /libretas/:id/pago
router.post(
  '/:id/pago',
  requirePermiso('LIBRETAS:EDITAR'),
  [
    body('monto').isInt({ min: 1 }).withMessage('Monto inválido'),
    body('forma_pago').notEmpty().withMessage('Forma de pago requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const { monto, forma_pago, referencia_externa, voucher } = req.body;

      const libreta = await prisma.libreta.findUnique({
        where: { id },
        include: { cliente: { select: clientePublicSelect } },
      });
      if (!libreta) {
        res.status(404).json({ success: false, message: 'Libreta no encontrada' });
        return;
      }
      // Permitir pago tanto en ACTIVA como en BLOQUEADA (para poder saldar deuda)
      if (libreta.estado !== 'ACTIVA' && libreta.estado !== 'BLOQUEADA') {
        res.status(400).json({ success: false, message: 'Libreta suspendida o inactiva' });
        return;
      }

      const montoBigInt = BigInt(monto);
      const nuevoSaldo = libreta.saldo_actual - montoBigInt;
      const saldoFinal = nuevoSaldo < BigInt(0) ? BigInt(0) : nuevoSaldo;

      // Si la libreta estaba BLOQUEADA y el saldo queda en 0, desbloquear automáticamente
      const desbloquear = libreta.estado === 'BLOQUEADA' && saldoFinal === BigInt(0);

      const result = await prisma.$transaction(async (tx) => {
        const pago = await tx.pago.create({
          data: {
            cliente_id: libreta.cliente_id,
            libreta_id: id,
            forma_pago,
            monto: montoBigInt,
            estado: 'CONFIRMADO',
            referencia_externa,
            voucher,
          },
        });

        await tx.libreta.update({
          where: { id },
          data: {
            saldo_actual: saldoFinal,
            saldo_vencido: saldoFinal === BigInt(0) ? BigInt(0) : libreta.saldo_vencido,
            ...(desbloquear ? { estado: 'ACTIVA' } : {}),
          },
        });

        await tx.libretaMovimiento.create({
          data: {
            libreta_id: id,
            pago_id: pago.id,
            tipo_movimiento: 'PAGO',
            descripcion: `Pago con ${forma_pago}`,
            monto_debe: BigInt(0),
            monto_haber: montoBigInt,
            saldo_resultante: saldoFinal,
            usuario_id: req.user!.userId,
          },
        });

        return pago;
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'LIBRETAS',
        accion: 'PAGO',
        registroId: id,
        valorNuevo: { monto, forma_pago, desbloqueo_automatico: desbloquear },
        ip: req.ip,
      });

      res.json({
        success: true,
        message: desbloquear ? 'Pago registrado. Libreta desbloqueada automáticamente.' : 'Pago registrado',
        data: result,
      });
    } catch (error) {
      logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al registrar pago' });
    }
  }
);

// POST /libretas/:id/ajuste
router.post(
  '/:id/ajuste',
  requirePermiso('LIBRETAS:EDITAR'),
  [
    body('monto').isInt().withMessage('Monto inválido'),
    body('tipo').isIn(['CARGO', 'ABONO', 'AJUSTE']).withMessage('Tipo inválido'),
    body('descripcion').notEmpty().withMessage('Descripción requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const { monto, tipo, descripcion } = req.body;

      const libreta = await prisma.libreta.findUnique({ where: { id } });
      if (!libreta) {
        res.status(404).json({ success: false, message: 'Libreta no encontrada' });
        return;
      }

      const montoBigInt = BigInt(Math.abs(monto));
      let nuevoSaldo = libreta.saldo_actual;
      let montoDebe = BigInt(0);
      let montoHaber = BigInt(0);

      if (tipo === 'CARGO') {
        nuevoSaldo += montoBigInt;
        montoDebe = montoBigInt;
      } else {
        nuevoSaldo -= montoBigInt;
        montoHaber = montoBigInt;
      }

      await prisma.$transaction(async (tx) => {
        await tx.libreta.update({
          where: { id },
          data: { saldo_actual: nuevoSaldo < BigInt(0) ? BigInt(0) : nuevoSaldo },
        });
        await tx.libretaMovimiento.create({
          data: {
            libreta_id: id,
            tipo_movimiento: tipo,
            descripcion,
            monto_debe: montoDebe,
            monto_haber: montoHaber,
            saldo_resultante: nuevoSaldo < BigInt(0) ? BigInt(0) : nuevoSaldo,
            usuario_id: req.user!.userId,
          },
        });
      });

      res.json({ success: true, message: 'Ajuste registrado' });
    } catch (error) {
      logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al registrar ajuste' });
    }
  }
);

// GET /libretas/:id/estado-cuenta/pdf
router.get('/:id/estado-cuenta/pdf', requirePermiso('LIBRETAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const libreta = await prisma.libreta.findUnique({
      where: { id },
      include: { cliente: { select: clientePublicSelect } },
    });
    if (!libreta) {
      res.status(404).json({ success: false, message: 'Libreta no encontrada' });
      return;
    }

    // Movimientos del mes actual
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);

    const movimientos = await prisma.libretaMovimiento.findMany({
      where: {
        libreta_id: id,
        fecha_movimiento: { gte: inicioMes, lte: finMes },
      },
      orderBy: { fecha_movimiento: 'desc' },
    });

    const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const periodo = `${nombresMes[hoy.getMonth()]} ${hoy.getFullYear()}`;

    const buffer = await generarPDFEstadoCuenta({
      libreta: {
        id: libreta.id,
        tipo: libreta.tipo,
        saldo_actual: libreta.saldo_actual,
        limite_credito: libreta.limite_credito,
        cliente: {
          nombre: libreta.cliente?.nombre ?? 'Sin nombre',
          documento_numero: libreta.cliente?.documento_numero ?? null,
        },
      },
      movimientos: movimientos.map((m) => ({
        fecha_movimiento: m.fecha_movimiento,
        descripcion: m.descripcion,
        monto_debe: m.monto_debe,
        monto_haber: m.monto_haber,
        saldo_resultante: m.saldo_resultante,
      })),
      periodo,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="estado-cuenta-${id}.pdf"`);
    res.send(buffer);
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al generar PDF' });
  }
});

// GET /libretas/:id/verificar-saldo
// Reconciliación (solo lectura): compara el saldo_actual almacenado con el
// recalculado desde el ledger inmutable (Σ debe − Σ haber). Detecta divergencias
// sin mutar datos. La corrección debe hacerse con revisión manual.
router.get('/:id/verificar-saldo', requirePermiso('LIBRETAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const libreta = await prisma.libreta.findUnique({ where: { id } });
    if (!libreta) {
      res.status(404).json({ success: false, message: 'Libreta no encontrada' });
      return;
    }

    const agg = await prisma.libretaMovimiento.aggregate({
      where: { libreta_id: id },
      _sum: { monto_debe: true, monto_haber: true },
    });
    const totalDebe = agg._sum.monto_debe ?? BigInt(0);
    const totalHaber = agg._sum.monto_haber ?? BigInt(0);
    const saldoCalculado = totalDebe - totalHaber;
    const saldoAlmacenado = libreta.saldo_actual;
    const diferencia = saldoAlmacenado - saldoCalculado;

    res.json({
      success: true,
      data: {
        libreta_id: id,
        saldo_almacenado: saldoAlmacenado.toString(),
        saldo_calculado: saldoCalculado.toString(),
        diferencia: diferencia.toString(),
        consistente: diferencia === BigInt(0),
        total_debe: totalDebe.toString(),
        total_haber: totalHaber.toString(),
      },
    });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al verificar saldo' });
  }
});

export default router;
