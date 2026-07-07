import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../lib/logger';
import { BancardProvider } from '../lib/payment/BancardProvider';
import { PagoparProvider } from '../lib/payment/PagoparProvider';
import type { PaymentProvider } from '../lib/payment/PaymentProvider';
import { clientePublicSelect } from '../lib/selects';
import { toJson } from '../lib/json';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProveedor(nombre: string): PaymentProvider {
  switch (nombre.toUpperCase()) {
    case 'BANCARD':
      return BancardProvider;
    case 'PAGOPAR':
      return PagoparProvider;
    default:
      throw new AppError(400, `Proveedor de pago no soportado: ${nombre}`);
  }
}

/**
 * Calcula el monto pendiente de una venta:
 * total de la venta menos la suma de pagos CONFIRMADOS.
 */
async function calcularMontoPendiente(ventaId: number): Promise<{ venta: { id: number; total: bigint; estado: string; cliente_id: number | null }; pendiente: bigint }> {
  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    select: { id: true, total: true, estado: true, cliente_id: true },
  });
  if (!venta) throw new AppError(404, 'Venta no encontrada');

  const pagosConfirmados = await prisma.pago.aggregate({
    where: { venta_id: ventaId, estado: 'CONFIRMADO' },
    _sum: { monto: true },
  });

  const totalPagado = (pagosConfirmados._sum.monto as bigint | null) ?? BigInt(0);
  const pendiente = (venta.total as bigint) - totalPagado;
  return { venta, pendiente };
}

/**
 * Verifica si la venta quedó completamente pagada y la marca COMPLETADA si corresponde.
 * Debe llamarse dentro de una transacción o directamente según el contexto.
 */
async function verificarCompletitudVenta(ventaId: number): Promise<void> {
  const result = await calcularMontoPendiente(ventaId);
  if (result.pendiente <= BigInt(0) && result.venta.estado !== 'COMPLETADA') {
    await prisma.venta.update({
      where: { id: ventaId },
      data: { estado: 'COMPLETADA' },
    });
    logger.info('Venta marcada como COMPLETADA', { ventaId });
  }
}

// ---------------------------------------------------------------------------
// Rutas de webhook — SIN autenticación (llamadas por pasarelas externas)
// Deben registrarse ANTES de router.use(authenticate)
// ---------------------------------------------------------------------------

/**
 * Reclama de forma atómica el procesamiento de un evento de webhook usando la
 * restricción única (proveedor+event_id). Evita el race TOCTOU: solo el primer
 * request crea la fila (estado EN_PROCESO); los duplicados concurrentes reciben
 * P2002 y se descartan. Un evento previo en ERROR puede reprocesarse.
 * Devuelve el evento reclamado, o null si ya fue/está siendo procesado.
 */
async function reclamarEventoWebhook(
  proveedor: string,
  eventId: string,
  payload: unknown
): Promise<{ id: number } | null> {
  const payloadJson = toJson(payload);
  try {
    return await prisma.webhookEvento.create({
      data: { proveedor, event_id: eventId, payload: payloadJson, estado: 'EN_PROCESO' },
    });
  } catch (e) {
    if ((e as { code?: string }).code !== 'P2002') throw e;
    const existente = await prisma.webhookEvento.findUnique({
      where: { proveedor_event_id: { proveedor, event_id: eventId } },
    });
    if (!existente || existente.estado !== 'ERROR') return null; // ya procesado o en proceso
    const claim = await prisma.webhookEvento.updateMany({
      where: { id: existente.id, estado: 'ERROR' },
      data: { estado: 'EN_PROCESO', payload: payloadJson },
    });
    return claim.count > 0 ? { id: existente.id } : null;
  }
}

// POST /pagos/webhook/bancard
router.post('/webhook/bancard', async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as Record<string, unknown>;
  const shopProcessId = (payload.operation as Record<string, unknown> | undefined)?.shop_process_id?.toString() ?? null;

  try {
    // Claim atómico (idempotencia sin TOCTOU)
    const evento = await reclamarEventoWebhook('BANCARD', shopProcessId ?? `BANCARD_${Date.now()}`, payload);
    if (!evento) {
      logger.info('Webhook Bancard duplicado o ya procesado', { shopProcessId });
      res.json({ success: true, message: 'ya recibido' });
      return;
    }

    // Procesar mediante el proveedor
    const resultado = await BancardProvider.procesarWebhook(payload);
    logger.info('Webhook Bancard procesado', { exitoso: resultado.exitoso, referencia: resultado.referencia_externa });

    if (resultado.exitoso && resultado.referencia_externa) {
      // Buscar el intento de pago por referencia_externa
      const intento = await prisma.pagoIntento.findFirst({
        where: { referencia_externa: resultado.referencia_externa },
        include: { pago: true },
      });

      if (intento) {
        // Validar monto confirmado contra el monto del pago (evita confirmar pagando menos).
        const montoOk =
          resultado.monto_confirmado === undefined ||
          resultado.monto_confirmado === intento.pago.monto;

        if (!montoOk) {
          logger.warn('Webhook Bancard: monto confirmado no coincide con el pago', {
            referencia: resultado.referencia_externa,
            esperado: intento.pago.monto.toString(),
            recibido: resultado.monto_confirmado?.toString(),
          });
          await registrarAuditoria({
            modulo: 'PAGOS',
            accion: 'RECHAZO_WEBHOOK_BANCARD_MONTO',
            registroId: intento.pago_id,
            valorNuevo: { referencia: resultado.referencia_externa, esperado: intento.pago.monto.toString(), recibido: resultado.monto_confirmado?.toString() },
            ip: req.ip,
          });
        } else if (intento.pago.estado !== 'CONFIRMADO') {
          await prisma.$transaction(async (tx) => {
            await tx.pagoIntento.update({
              where: { id: intento.id },
              data: {
                estado: 'CONFIRMADO',
                response_payload: toJson(resultado.response_payload ?? {}),
              },
            });
            await tx.pago.update({
              where: { id: intento.pago_id },
              data: { estado: 'CONFIRMADO', fecha_pago: new Date() },
            });
          });

          if (intento.pago.venta_id) {
            await verificarCompletitudVenta(intento.pago.venta_id);
          }

          await registrarAuditoria({
            modulo: 'PAGOS',
            accion: 'CONFIRMAR_WEBHOOK_BANCARD',
            registroId: intento.pago_id,
            valorNuevo: { referencia: resultado.referencia_externa, exitoso: true },
            ip: req.ip,
          });
        }
      } else {
        logger.warn('Webhook Bancard: no se encontró intento para referencia', {
          referencia: resultado.referencia_externa,
        });
      }
    }

    // Actualizar estado del evento
    await prisma.webhookEvento.update({
      where: { id: evento.id },
      data: {
        estado: resultado.exitoso ? 'PROCESADO' : 'ERROR',
        procesado_en: new Date(),
        error: resultado.exitoso ? null : JSON.stringify(resultado.response_payload),
      },
    });

    // Siempre responder 200 (regla de webhooks)
    res.json({ success: true });
  } catch (error) {
    logger.error('Error procesando webhook Bancard', {
      error: error instanceof Error ? error.message : String(error),
      shopProcessId,
    });

    // Intentar marcar el evento como ERROR si existe
    if (shopProcessId) {
      try {
        await prisma.webhookEvento.updateMany({
          where: { proveedor: 'BANCARD', event_id: shopProcessId, estado: 'RECIBIDO' },
          data: { estado: 'ERROR', error: error instanceof Error ? error.message : String(error) },
        });
      } catch {
        // ignorar errores secundarios
      }
    }

    // Siempre 200 para que la pasarela no reintente indefinidamente
    res.json({ success: true });
  }
});

// POST /pagos/webhook/pagopar
router.post('/webhook/pagopar', async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as Record<string, unknown>;
  const idTransaccion = (payload.id_transaccion ?? payload.referencia)?.toString() ?? null;

  try {
    // Claim atómico (idempotencia sin TOCTOU)
    const evento = await reclamarEventoWebhook('PAGOPAR', idTransaccion ?? `PAGOPAR_${Date.now()}`, payload);
    if (!evento) {
      logger.info('Webhook Pagopar duplicado o ya procesado', { idTransaccion });
      res.json({ success: true, message: 'ya recibido' });
      return;
    }

    const resultado = await PagoparProvider.procesarWebhook(payload);
    logger.info('Webhook Pagopar procesado', { exitoso: resultado.exitoso, referencia: resultado.referencia_externa });

    if (resultado.exitoso && resultado.referencia_externa) {
      const intento = await prisma.pagoIntento.findFirst({
        where: { referencia_externa: resultado.referencia_externa },
        include: { pago: true },
      });

      if (intento) {
        const montoOk =
          resultado.monto_confirmado === undefined ||
          resultado.monto_confirmado === intento.pago.monto;

        if (!montoOk) {
          logger.warn('Webhook Pagopar: monto confirmado no coincide con el pago', {
            referencia: resultado.referencia_externa,
            esperado: intento.pago.monto.toString(),
            recibido: resultado.monto_confirmado?.toString(),
          });
          await registrarAuditoria({
            modulo: 'PAGOS',
            accion: 'RECHAZO_WEBHOOK_PAGOPAR_MONTO',
            registroId: intento.pago_id,
            valorNuevo: { referencia: resultado.referencia_externa, esperado: intento.pago.monto.toString(), recibido: resultado.monto_confirmado?.toString() },
            ip: req.ip,
          });
        } else if (intento.pago.estado !== 'CONFIRMADO') {
          await prisma.$transaction(async (tx) => {
            await tx.pagoIntento.update({
              where: { id: intento.id },
              data: {
                estado: 'CONFIRMADO',
                response_payload: toJson(resultado.response_payload ?? {}),
              },
            });
            await tx.pago.update({
              where: { id: intento.pago_id },
              data: { estado: 'CONFIRMADO', fecha_pago: new Date() },
            });
          });

          if (intento.pago.venta_id) {
            await verificarCompletitudVenta(intento.pago.venta_id);
          }

          await registrarAuditoria({
            modulo: 'PAGOS',
            accion: 'CONFIRMAR_WEBHOOK_PAGOPAR',
            registroId: intento.pago_id,
            valorNuevo: { referencia: resultado.referencia_externa, exitoso: true },
            ip: req.ip,
          });
        }
      } else {
        logger.warn('Webhook Pagopar: no se encontró intento para referencia', {
          referencia: resultado.referencia_externa,
        });
      }
    }

    await prisma.webhookEvento.update({
      where: { id: evento.id },
      data: {
        estado: resultado.exitoso ? 'PROCESADO' : 'ERROR',
        procesado_en: new Date(),
        error: resultado.exitoso ? null : JSON.stringify(resultado.response_payload),
      },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error procesando webhook Pagopar', {
      error: error instanceof Error ? error.message : String(error),
      idTransaccion,
    });

    if (idTransaccion) {
      try {
        await prisma.webhookEvento.updateMany({
          where: { proveedor: 'PAGOPAR', event_id: idTransaccion, estado: 'RECIBIDO' },
          data: { estado: 'ERROR', error: error instanceof Error ? error.message : String(error) },
        });
      } catch {
        // ignorar errores secundarios
      }
    }

    res.json({ success: true });
  }
});

// ---------------------------------------------------------------------------
// Rutas autenticadas
// ---------------------------------------------------------------------------
router.use(authenticate);

// GET /pagos
router.get(
  '/',
  requirePermiso('VENTAS:VER'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
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
        if (fecha_hasta)
          (where.fecha_pago as Record<string, Date>).lte = new Date(String(fecha_hasta) + 'T23:59:59');
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
      logger.error('Error al obtener pagos', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al obtener pagos' });
    }
  }
);

// GET /pagos/conciliacion — debe ir ANTES de GET /:id
router.get(
  '/conciliacion',
  requirePermiso('VENTAS:VER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { fecha_desde, fecha_hasta } = req.query;

      const where: Record<string, unknown> = {};
      if (fecha_desde || fecha_hasta) {
        where.fecha_pago = {};
        if (fecha_desde) (where.fecha_pago as Record<string, Date>).gte = new Date(String(fecha_desde));
        if (fecha_hasta)
          (where.fecha_pago as Record<string, Date>).lte = new Date(String(fecha_hasta) + 'T23:59:59');
      }

      const pagos = await prisma.pago.findMany({
        where,
        include: {
          venta: { select: { id: true, total: true } },
          cliente: { select: { id: true, nombre: true } },
        },
        orderBy: { creado_en: 'desc' },
      });

      const resumenFormaPago: Record<string, bigint> = {};
      for (const p of pagos) {
        const forma = p.forma_pago;
        resumenFormaPago[forma] = (resumenFormaPago[forma] ?? BigInt(0)) + p.monto;
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
      logger.error('Error al obtener conciliación', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al obtener conciliación' });
    }
  }
);

// GET /pagos/:id
router.get('/:id', requirePermiso('VENTAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const pago = await prisma.pago.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        venta: { include: { items: true } },
        cliente: { select: clientePublicSelect },
        libreta: true,
        intentos: { orderBy: { creado_en: 'desc' } },
      },
    });

    if (!pago) {
      res.status(404).json({ success: false, message: 'Pago no encontrado' });
      return;
    }

    res.json({ success: true, data: pago });
  } catch (error) {
    logger.error('Error al obtener pago', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener pago' });
  }
});

// POST /pagos/iniciar — inicia un pago online (Bancard / Pagopar)
router.post(
  '/iniciar',
  requirePermiso('PAGOS:CREAR'),
  [
    body('venta_id').isInt({ min: 1 }).withMessage('venta_id requerido'),
    body('forma_pago').isIn(['BANCARD', 'PAGOPAR']).withMessage('forma_pago debe ser BANCARD o PAGOPAR'),
    body('return_url').optional().isURL().withMessage('return_url inválida'),
    body('cancel_url').optional().isURL().withMessage('cancel_url inválida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { venta_id, forma_pago, return_url, cancel_url } = req.body as {
        venta_id: number;
        forma_pago: string;
        return_url?: string;
        cancel_url?: string;
      };

      // Calcular monto pendiente
      const { venta, pendiente } = await calcularMontoPendiente(venta_id);

      if (pendiente <= BigInt(0)) {
        res.status(400).json({ success: false, message: 'La venta ya está pagada' });
        return;
      }

      if (venta.estado === 'ANULADA') {
        res.status(400).json({ success: false, message: 'No se puede pagar una venta anulada' });
        return;
      }

      const proveedor = getProveedor(forma_pago);

      // Crear pago en estado PENDIENTE
      const pago = await prisma.pago.create({
        data: {
          venta_id,
          cliente_id: venta.cliente_id ?? undefined,
          forma_pago,
          proveedor_pago: proveedor.nombre,
          monto: pendiente,
          estado: 'PENDIENTE',
        },
      });

      // Crear intento inicial
      const intento = await prisma.pagoIntento.create({
        data: {
          pago_id: pago.id,
          proveedor: proveedor.nombre,
          estado: 'INICIADO',
        },
      });

      // Llamar al proveedor
      const returnUrl = return_url ?? `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/pagos/resultado`;
      const cancelUrl = cancel_url ?? `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/pagos/cancelado`;

      let resultado;
      try {
        resultado = await proveedor.iniciarPago({
          pagoId: pago.id,
          monto: pendiente,
          descripcion: `Venta #${venta_id}`,
          returnUrl,
          cancelUrl,
        });
      } catch (proveedorError) {
        // Marcar intento como fallido pero no eliminar el pago
        await prisma.pagoIntento.update({
          where: { id: intento.id },
          data: {
            estado: 'ERROR',
            response_payload: { error: proveedorError instanceof Error ? proveedorError.message : String(proveedorError) },
          },
        });
        logger.error('Error al iniciar pago con proveedor', {
          proveedor: proveedor.nombre,
          pagoId: pago.id,
          error: proveedorError instanceof Error ? proveedorError.message : String(proveedorError),
        });
        throw new AppError(502, `Error al comunicarse con ${proveedor.nombre}: ${proveedorError instanceof Error ? proveedorError.message : 'error desconocido'}`);
      }

      // Actualizar intento con los datos obtenidos
      await prisma.pagoIntento.update({
        where: { id: intento.id },
        data: {
          estado: 'PENDIENTE',
          referencia_externa: resultado.referencia_externa,
          redirect_url: resultado.redirect_url,
          request_payload: resultado.request_payload,
          response_payload: resultado.response_payload,
        },
      });

      // Guardar referencia_externa en el pago para facilitar búsquedas
      await prisma.pago.update({
        where: { id: pago.id },
        data: { referencia_externa: resultado.referencia_externa },
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'PAGOS',
        accion: 'INICIAR_PAGO',
        registroId: pago.id,
        valorNuevo: { venta_id, forma_pago, monto: pendiente.toString(), referencia: resultado.referencia_externa },
        ip: req.ip,
      });

      logger.info('Pago iniciado', { pagoId: pago.id, intentoId: intento.id, proveedor: proveedor.nombre });

      res.status(201).json({
        success: true,
        message: 'Pago iniciado',
        data: {
          pago_id: pago.id,
          intento_id: intento.id,
          redirect_url: resultado.redirect_url,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      logger.error('Error al iniciar pago', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al iniciar pago' });
    }
  }
);

// POST /pagos/confirmar/:id — confirmación manual
router.post(
  '/confirmar/:id',
  requirePermiso('PAGOS:CONFIRMAR'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido' });
        return;
      }

      const pago = await prisma.pago.findUnique({
        where: { id },
        include: { venta: { select: { id: true, total: true, estado: true } } },
      });

      if (!pago) {
        res.status(404).json({ success: false, message: 'Pago no encontrado' });
        return;
      }
      if (pago.estado === 'CONFIRMADO') {
        res.status(400).json({ success: false, message: 'El pago ya está confirmado' });
        return;
      }
      if (pago.estado === 'RECHAZADO') {
        res.status(400).json({ success: false, message: 'No se puede confirmar un pago rechazado' });
        return;
      }

      await prisma.pago.update({
        where: { id },
        data: { estado: 'CONFIRMADO', fecha_pago: new Date() },
      });

      if (pago.venta_id) {
        await verificarCompletitudVenta(pago.venta_id);
      }

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'PAGOS',
        accion: 'CONFIRMAR_MANUAL',
        registroId: id,
        valorAnterior: { estado: pago.estado },
        valorNuevo: { estado: 'CONFIRMADO' },
        ip: req.ip,
      });

      logger.info('Pago confirmado manualmente', { pagoId: id, usuarioId: req.user!.userId });
      res.json({ success: true, message: 'Pago confirmado' });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      logger.error('Error al confirmar pago', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al confirmar pago' });
    }
  }
);

// POST /pagos/rechazar/:id — rechazo manual
router.post(
  '/rechazar/:id',
  requirePermiso('PAGOS:CONFIRMAR'),
  [body('motivo').optional().isString(), handleValidation],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido' });
        return;
      }

      const { motivo } = req.body as { motivo?: string };

      const pago = await prisma.pago.findUnique({ where: { id } });
      if (!pago) {
        res.status(404).json({ success: false, message: 'Pago no encontrado' });
        return;
      }
      if (pago.estado === 'RECHAZADO') {
        res.status(400).json({ success: false, message: 'El pago ya está rechazado' });
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
        valorAnterior: { estado: pago.estado },
        valorNuevo: { estado: 'RECHAZADO', motivo },
        ip: req.ip,
      });

      logger.info('Pago rechazado manualmente', { pagoId: id, usuarioId: req.user!.userId, motivo });
      res.json({ success: true, message: 'Pago rechazado' });
    } catch (error) {
      logger.error('Error al rechazar pago', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al rechazar pago' });
    }
  }
);

// POST /pagos/orden — crear orden de pago online (retrocompatibilidad)
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

      const token = `TKN_${venta_id}_${Date.now()}`;

      const pago = await prisma.pago.create({
        data: {
          venta_id,
          cliente_id: cliente_id ?? venta.cliente_id ?? undefined,
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

      res.status(201).json({
        success: true,
        message: 'Orden de pago creada',
        data: { pago_id: pago.id, token, redirect_url: null },
      });
    } catch (error) {
      logger.error('Error al crear orden de pago', { error: error instanceof Error ? error.message : String(error) });
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

      const { venta, pendiente } = await calcularMontoPendiente(venta_id);

      // El monto no puede exceder el pendiente real de la venta (evita sobrepago manipulado).
      if (BigInt(monto) > pendiente) {
        res.status(400).json({
          success: false,
          message: `El monto (${monto}) excede el pendiente de la venta (${pendiente.toString()})`,
        });
        return;
      }

      const pago = await prisma.pago.create({
        data: {
          venta_id,
          cliente_id: venta.cliente_id ?? undefined,
          forma_pago: 'POS',
          proveedor_pago: 'POS_MANUAL',
          monto: BigInt(monto),
          estado: 'CONFIRMADO',
          voucher,
          autorizacion,
          referencia_externa: referencia_externa ?? undefined,
        },
      });

      await verificarCompletitudVenta(venta_id);

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'PAGOS',
        accion: 'REGISTRAR_POS',
        registroId: pago.id,
        valorNuevo: { venta_id, monto, voucher, autorizacion },
        ip: req.ip,
      });

      logger.info('Pago POS registrado', { pagoId: pago.id });
      res.status(201).json({ success: true, message: 'Pago POS registrado', data: pago });
    } catch (error) {
      logger.error('Error al registrar pago POS', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al registrar pago POS' });
    }
  }
);

// PUT /pagos/:id/confirmar — compatibilidad con método PUT (mantener para clientes existentes)
router.put(
  '/:id/confirmar',
  requirePermiso('PAGOS:CONFIRMAR'),
  async (req: Request, res: Response): Promise<void> => {
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

      await prisma.pago.update({
        where: { id },
        data: { estado: 'CONFIRMADO', fecha_pago: new Date() },
      });

      if (pago.venta_id) {
        await verificarCompletitudVenta(pago.venta_id);
      }

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'PAGOS',
        accion: 'CONFIRMAR_MANUAL',
        registroId: id,
        ip: req.ip,
      });

      res.json({ success: true, message: 'Pago confirmado' });
    } catch (error) {
      logger.error('Error al confirmar pago', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al confirmar pago' });
    }
  }
);

// PUT /pagos/:id/rechazar — compatibilidad con método PUT
router.put(
  '/:id/rechazar',
  requirePermiso('PAGOS:CONFIRMAR'),
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
      logger.error('Error al rechazar pago', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al rechazar pago' });
    }
  }
);

export default router;
