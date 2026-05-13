import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';

const router = Router();

// Webhook routes do NOT use authenticate — called by external payment services.
// HMAC validation placeholder: in production, verify the signature header using a
// shared secret stored in Configuracion (e.g. clave='BANCARD_SECRET_KEY') with
// crypto.createHmac('sha256', secret).update(rawBody).digest('hex') compared to
// the X-Bancard-Signature / X-Pagopar-Signature header.

// POST /pagos/webhook/bancard — must be registered BEFORE router.use(authenticate)
router.post('/webhook/bancard', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: verificar firma HMAC con secret de Configuracion 'BANCARD_SECRET_KEY'
    const { token, operation } = req.body as {
      token?: string;
      operation?: { response_code?: string; authorization_number?: string; amount_detail?: { amount?: string } };
    };

    if (!token) {
      res.status(400).json({ success: false, message: 'Token requerido' });
      return;
    }

    // Buscar el pago por referencia_externa (guardamos el token al crear la orden)
    const pago = await prisma.pago.findFirst({
      where: { referencia_externa: token, estado: 'PENDIENTE' },
      include: { venta: true },
    });

    if (!pago) {
      res.status(404).json({ success: false, message: 'Pago no encontrado' });
      return;
    }

    const aprobado = operation?.response_code === '00';

    await prisma.$transaction(async (tx) => {
      await tx.pago.update({
        where: { id: pago.id },
        data: {
          estado: aprobado ? 'CONFIRMADO' : 'RECHAZADO',
          autorizacion: operation?.authorization_number,
        },
      });

      if (aprobado && pago.venta_id) {
        await tx.venta.update({
          where: { id: pago.venta_id },
          data: { estado: 'COMPLETADA' },
        });
      }
    });

    await registrarAuditoria({
      usuarioId: null as unknown as number,
      modulo: 'PAGOS',
      accion: aprobado ? 'CONFIRMAR_BANCARD' : 'RECHAZAR_BANCARD',
      registroId: pago.id,
      valorNuevo: { token, response_code: operation?.response_code },
      ip: req.ip,
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error procesando webhook Bancard' });
  }
});

// POST /pagos/webhook/pagopar — must be registered BEFORE router.use(authenticate)
router.post('/webhook/pagopar', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: verificar public_key contra Configuracion 'PAGOPAR_PUBLIC_KEY'
    const { public_key, id_transaccion, resultado } = req.body as {
      public_key?: string;
      id_transaccion?: string;
      resultado?: string;
      monto?: string;
    };

    if (!id_transaccion) {
      res.status(400).json({ success: false, message: 'id_transaccion requerido' });
      return;
    }

    const pago = await prisma.pago.findFirst({
      where: { referencia_externa: id_transaccion, estado: 'PENDIENTE' },
      include: { venta: true },
    });

    if (!pago) {
      res.status(404).json({ success: false, message: 'Pago no encontrado' });
      return;
    }

    const aprobado = resultado === 'APROBADO';

    await prisma.$transaction(async (tx) => {
      await tx.pago.update({
        where: { id: pago.id },
        data: { estado: aprobado ? 'CONFIRMADO' : 'RECHAZADO' },
      });

      if (aprobado && pago.venta_id) {
        await tx.venta.update({
          where: { id: pago.venta_id },
          data: { estado: 'COMPLETADA' },
        });
      }
    });

    await registrarAuditoria({
      usuarioId: null as unknown as number,
      modulo: 'PAGOS',
      accion: aprobado ? 'CONFIRMAR_PAGOPAR' : 'RECHAZAR_PAGOPAR',
      registroId: pago.id,
      valorNuevo: { id_transaccion, resultado, public_key },
      ip: req.ip,
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error procesando webhook Pagopar' });
  }
});

// All routes below require authentication
router.use(authenticate);

// GET /pagos
router.get('/', requirePermiso('VENTAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      estado,
      forma_pago,
      fecha_desde,
      fecha_hasta,
      venta_id,
      cliente_id,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (forma_pago) where.forma_pago = forma_pago;
    if (venta_id) where.venta_id = parseInt(String(venta_id));
    if (cliente_id) where.cliente_id = parseInt(String(cliente_id));
    if (fecha_desde || fecha_hasta) {
      where.fecha_pago = {};
      if (fecha_desde) (where.fecha_pago as Record<string, Date>).gte = new Date(String(fecha_desde));
      if (fecha_hasta) (where.fecha_pago as Record<string, Date>).lte = new Date(String(fecha_hasta) + 'T23:59:59');
    }

    const [pagos, total] = await Promise.all([
      prisma.pago.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { creado_en: 'desc' },
        include: {
          venta: { select: { id: true, total: true, estado: true } },
          cliente: { select: { id: true, nombre: true } },
        },
      }),
      prisma.pago.count({ where }),
    ]);

    res.json({
      success: true,
      data: pagos,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener pagos' });
  }
});

// GET /pagos/conciliacion
router.get('/conciliacion', requirePermiso('VENTAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { fecha_desde, fecha_hasta } = req.query;

    const where: Record<string, unknown> = {};
    if (fecha_desde || fecha_hasta) {
      where.fecha_pago = {};
      if (fecha_desde) (where.fecha_pago as Record<string, Date>).gte = new Date(String(fecha_desde));
      if (fecha_hasta) (where.fecha_pago as Record<string, Date>).lte = new Date(String(fecha_hasta) + 'T23:59:59');
    }

    const pagos = await prisma.pago.findMany({
      where,
      include: {
        venta: { select: { id: true, total: true } },
        cliente: { select: { id: true, nombre: true } },
      },
      orderBy: { creado_en: 'desc' },
    });

    // Resumen por estado
    const resumenEstado: Record<string, bigint> = {};
    const resumenFormaPago: Record<string, bigint> = {};

    for (const p of pagos) {
      const estado = p.estado;
      const forma = p.forma_pago;
      resumenEstado[estado] = (resumenEstado[estado] || BigInt(0)) + p.monto;
      resumenFormaPago[forma] = (resumenFormaPago[forma] || BigInt(0)) + p.monto;
    }

    const confirmados = pagos.filter((p) => p.estado === 'CONFIRMADO');
    const pendientes = pagos.filter((p) => p.estado === 'PENDIENTE');
    const rechazados = pagos.filter((p) => p.estado === 'RECHAZADO');

    res.json({
      success: true,
      data: {
        resumen: {
          total_confirmado: confirmados.reduce((acc, p) => acc + p.monto, BigInt(0)).toString(),
          total_pendiente: pendientes.reduce((acc, p) => acc + p.monto, BigInt(0)).toString(),
          total_rechazado: rechazados.reduce((acc, p) => acc + p.monto, BigInt(0)).toString(),
          cantidad_confirmado: confirmados.length,
          cantidad_pendiente: pendientes.length,
          cantidad_rechazado: rechazados.length,
        },
        por_forma_pago: Object.entries(resumenFormaPago).map(([forma_pago, total]) => ({
          forma_pago,
          total: total.toString(),
          cantidad: pagos.filter((p) => p.forma_pago === forma_pago).length,
        })),
        pagos_pendientes: pendientes,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener conciliación' });
  }
});

// GET /pagos/:id
router.get('/:id', requirePermiso('VENTAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const pago = await prisma.pago.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        venta: { include: { items: true } },
        cliente: true,
        libreta: true,
      },
    });

    if (!pago) {
      res.status(404).json({ success: false, message: 'Pago no encontrado' });
      return;
    }

    res.json({ success: true, data: pago });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener pago' });
  }
});

// POST /pagos/orden — crear orden de pago online (Bancard / Pagopar)
router.post(
  '/orden',
  requirePermiso('VENTAS:CREAR'),
  [
    body('venta_id').isInt().withMessage('Venta requerida'),
    body('monto').isInt({ min: 1 }).withMessage('Monto inválido'),
    body('forma_pago').isIn(['BANCARD', 'PAGOPAR']).withMessage('Forma de pago inválida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { venta_id, monto, forma_pago, cliente_id } = req.body as {
        venta_id: number;
        monto: number;
        forma_pago: string;
        cliente_id?: number;
      };

      const venta = await prisma.venta.findUnique({ where: { id: venta_id } });
      if (!venta) {
        res.status(404).json({ success: false, message: 'Venta no encontrada' });
        return;
      }

      // Generar token único para identificar la transacción en el webhook
      const token = `TKN_${venta_id}_${Date.now()}`;

      const pago = await prisma.pago.create({
        data: {
          venta_id,
          cliente_id: cliente_id || venta.cliente_id || undefined,
          forma_pago,
          proveedor_pago: forma_pago,
          monto: BigInt(monto),
          estado: 'PENDIENTE',
          referencia_externa: token,
        },
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'PAGOS',
        accion: 'CREAR_ORDEN',
        registroId: pago.id,
        valorNuevo: { venta_id, forma_pago, monto, token },
        ip: req.ip,
      });

      // TODO: integrar con SDK de Bancard/Pagopar para obtener redirect_url real
      res.status(201).json({
        success: true,
        message: 'Orden de pago creada',
        data: {
          pago_id: pago.id,
          token,
          redirect_url: null, // Placeholder: integración pendiente con proveedor de pagos
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear orden de pago' });
    }
  }
);

// POST /pagos/pos/manual — registrar pago POS manual
router.post(
  '/pos/manual',
  requirePermiso('VENTAS:CREAR'),
  [
    body('venta_id').isInt().withMessage('Venta requerida'),
    body('monto').isInt({ min: 1 }).withMessage('Monto inválido'),
    body('voucher').notEmpty().withMessage('Voucher requerido'),
    body('autorizacion').notEmpty().withMessage('Autorización requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { venta_id, monto, voucher, autorizacion, referencia_externa } = req.body as {
        venta_id: number;
        monto: number;
        voucher: string;
        autorizacion: string;
        referencia_externa?: string;
      };

      const venta = await prisma.venta.findUnique({ where: { id: venta_id } });
      if (!venta) {
        res.status(404).json({ success: false, message: 'Venta no encontrada' });
        return;
      }

      const pago = await prisma.pago.create({
        data: {
          venta_id,
          cliente_id: venta.cliente_id || undefined,
          forma_pago: 'POS',
          proveedor_pago: 'POS_MANUAL',
          monto: BigInt(monto),
          estado: 'CONFIRMADO',
          voucher,
          autorizacion,
          referencia_externa: referencia_externa || undefined,
        },
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'PAGOS',
        accion: 'REGISTRAR_POS',
        registroId: pago.id,
        valorNuevo: { venta_id, monto, voucher, autorizacion },
        ip: req.ip,
      });

      res.status(201).json({ success: true, message: 'Pago POS registrado', data: pago });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al registrar pago POS' });
    }
  }
);

// PUT /pagos/:id/confirmar — confirmar manualmente un pago PENDIENTE
router.put('/:id/confirmar', requirePermiso('VENTAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const pago = await prisma.pago.findUnique({ where: { id }, include: { venta: true } });
    if (!pago) {
      res.status(404).json({ success: false, message: 'Pago no encontrado' });
      return;
    }
    if (pago.estado !== 'PENDIENTE') {
      res.status(400).json({ success: false, message: `No se puede confirmar un pago en estado ${pago.estado}` });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.pago.update({
        where: { id },
        data: { estado: 'CONFIRMADO' },
      });

      if (pago.venta_id) {
        await tx.venta.update({
          where: { id: pago.venta_id },
          data: { estado: 'COMPLETADA' },
        });
      }
    });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'PAGOS',
      accion: 'CONFIRMAR_MANUAL',
      registroId: id,
      ip: req.ip,
    });

    res.json({ success: true, message: 'Pago confirmado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al confirmar pago' });
  }
});

// PUT /pagos/:id/rechazar — rechazar un pago con motivo
router.put(
  '/:id/rechazar',
  requirePermiso('VENTAS:EDITAR'),
  [body('motivo').notEmpty().withMessage('Motivo requerido'), handleValidation],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const { motivo } = req.body as { motivo: string };

      const pago = await prisma.pago.findUnique({ where: { id } });
      if (!pago) {
        res.status(404).json({ success: false, message: 'Pago no encontrado' });
        return;
      }
      if (pago.estado === 'RECHAZADO') {
        res.status(400).json({ success: false, message: 'Pago ya rechazado' });
        return;
      }

      await prisma.pago.update({
        where: { id },
        data: { estado: 'RECHAZADO' },
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'PAGOS',
        accion: 'RECHAZAR_MANUAL',
        registroId: id,
        valorNuevo: { motivo },
        ip: req.ip,
      });

      res.json({ success: true, message: 'Pago rechazado' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al rechazar pago' });
    }
  }
);

export default router;
