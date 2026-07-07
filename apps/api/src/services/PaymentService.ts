import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { registrarAuditoria } from '../lib/audit';
import { logger } from '../lib/logger';
import { toJson } from '../lib/json';
import type { PaymentProvider, ConfirmarPagoResult } from '../lib/payment/PaymentProvider';

/**
 * Lógica de dominio de pagos: cálculo de pendiente, completitud de venta,
 * idempotencia y confirmación de webhooks. Extraída de routes/pagos.ts (A1).
 */
export class PaymentService {
  constructor(private prisma: PrismaClient) {}

  /** Monto pendiente de una venta = total − suma de pagos CONFIRMADOS. */
  async calcularMontoPendiente(ventaId: number): Promise<{
    venta: { id: number; total: bigint; estado: string; cliente_id: number | null };
    pendiente: bigint;
  }> {
    const venta = await this.prisma.venta.findUnique({
      where: { id: ventaId },
      select: { id: true, total: true, estado: true, cliente_id: true },
    });
    if (!venta) throw new AppError(404, 'Venta no encontrada');

    const pagosConfirmados = await this.prisma.pago.aggregate({
      where: { venta_id: ventaId, estado: 'CONFIRMADO' },
      _sum: { monto: true },
    });
    const totalPagado = pagosConfirmados._sum.monto ?? BigInt(0);
    return { venta, pendiente: venta.total - totalPagado };
  }

  /** Marca la venta COMPLETADA si ya no queda pendiente. */
  async verificarCompletitudVenta(ventaId: number): Promise<void> {
    const { venta, pendiente } = await this.calcularMontoPendiente(ventaId);
    if (pendiente <= BigInt(0) && venta.estado !== 'COMPLETADA') {
      await this.prisma.venta.update({ where: { id: ventaId }, data: { estado: 'COMPLETADA' } });
      logger.info('Venta marcada como COMPLETADA', { ventaId });
    }
  }

  /**
   * Claim atómico de un evento de webhook vía la restricción única
   * (proveedor+event_id). Evita el race TOCTOU: sólo el primer request crea la
   * fila (EN_PROCESO); los duplicados reciben P2002 y se descartan. Un evento en
   * ERROR puede reprocesarse. Devuelve el evento o null si ya fue/está en proceso.
   */
  async reclamarEvento(proveedor: string, eventId: string, payload: unknown): Promise<{ id: number } | null> {
    const payloadJson = toJson(payload);
    try {
      return await this.prisma.webhookEvento.create({
        data: { proveedor, event_id: eventId, payload: payloadJson, estado: 'EN_PROCESO' },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e;
      const existente = await this.prisma.webhookEvento.findUnique({
        where: { proveedor_event_id: { proveedor, event_id: eventId } },
      });
      if (!existente || existente.estado !== 'ERROR') return null;
      const claim = await this.prisma.webhookEvento.updateMany({
        where: { id: existente.id, estado: 'ERROR' },
        data: { estado: 'EN_PROCESO', payload: payloadJson },
      });
      return claim.count > 0 ? { id: existente.id } : null;
    }
  }

  /**
   * Confirma un pago a partir del resultado de un webhook, validando el monto
   * contra el pago y evitando doble confirmación. Idempotente.
   */
  private async confirmarDesdeWebhook(
    proveedor: string,
    resultado: ConfirmarPagoResult,
    ip?: string
  ): Promise<void> {
    if (!resultado.exitoso || !resultado.referencia_externa) return;

    const intento = await this.prisma.pagoIntento.findFirst({
      where: { referencia_externa: resultado.referencia_externa },
      include: { pago: true },
    });
    if (!intento) {
      logger.warn(`Webhook ${proveedor}: no se encontró intento para referencia`, {
        referencia: resultado.referencia_externa,
      });
      return;
    }

    // El monto confirmado debe coincidir con el del pago (evita pagar de menos).
    const montoOk =
      resultado.monto_confirmado === undefined || resultado.monto_confirmado === intento.pago.monto;

    if (!montoOk) {
      logger.warn(`Webhook ${proveedor}: monto confirmado no coincide con el pago`, {
        referencia: resultado.referencia_externa,
        esperado: intento.pago.monto.toString(),
        recibido: resultado.monto_confirmado?.toString(),
      });
      await registrarAuditoria({
        modulo: 'PAGOS',
        accion: `RECHAZO_WEBHOOK_${proveedor}_MONTO`,
        registroId: intento.pago_id,
        valorNuevo: {
          referencia: resultado.referencia_externa,
          esperado: intento.pago.monto.toString(),
          recibido: resultado.monto_confirmado?.toString(),
        },
        ip,
      });
      return;
    }

    if (intento.pago.estado === 'CONFIRMADO') return; // idempotencia

    await this.prisma.$transaction(async (tx) => {
      await tx.pagoIntento.update({
        where: { id: intento.id },
        data: { estado: 'CONFIRMADO', response_payload: toJson(resultado.response_payload ?? {}) },
      });
      await tx.pago.update({
        where: { id: intento.pago_id },
        data: { estado: 'CONFIRMADO', fecha_pago: new Date() },
      });
    });

    if (intento.pago.venta_id) {
      await this.verificarCompletitudVenta(intento.pago.venta_id);
    }

    await registrarAuditoria({
      modulo: 'PAGOS',
      accion: `CONFIRMAR_WEBHOOK_${proveedor}`,
      registroId: intento.pago_id,
      valorNuevo: { referencia: resultado.referencia_externa, exitoso: true },
      ip,
    });
  }

  /**
   * Flujo completo de un webhook: claim idempotente, procesamiento por el
   * proveedor, confirmación del pago y actualización del estado del evento.
   * No lanza: registra el error y marca el evento como ERROR (los webhooks
   * siempre deben responder 200 para no gatillar reintentos infinitos).
   */
  async manejarWebhook(params: {
    proveedor: string;
    provider: PaymentProvider;
    payload: Record<string, unknown>;
    eventId: string | null;
    ip?: string;
  }): Promise<void> {
    const { proveedor, provider, payload, ip } = params;
    const eventId = params.eventId ?? `${proveedor}_${Date.now()}`;

    try {
      const evento = await this.reclamarEvento(proveedor, eventId, payload);
      if (!evento) {
        logger.info(`Webhook ${proveedor} duplicado o ya procesado`, { eventId });
        return;
      }

      const resultado = await provider.procesarWebhook(payload);
      logger.info(`Webhook ${proveedor} procesado`, {
        exitoso: resultado.exitoso,
        referencia: resultado.referencia_externa,
      });

      await this.confirmarDesdeWebhook(proveedor, resultado, ip);

      await this.prisma.webhookEvento.update({
        where: { id: evento.id },
        data: {
          estado: resultado.exitoso ? 'PROCESADO' : 'ERROR',
          procesado_en: new Date(),
          error: resultado.exitoso ? null : JSON.stringify(resultado.response_payload),
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Error procesando webhook ${proveedor}`, { error: msg, eventId });
      try {
        await this.prisma.webhookEvento.updateMany({
          where: { proveedor, event_id: eventId, estado: { in: ['RECIBIDO', 'EN_PROCESO'] } },
          data: { estado: 'ERROR', error: msg },
        });
      } catch {
        // ignorar errores secundarios
      }
    }
  }
}
