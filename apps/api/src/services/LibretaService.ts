import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

export class LibretaService {
  constructor(private prisma: PrismaClient) {}

  async obtenerLibretaActiva(clienteId: number) {
    const libreta = await this.prisma.libreta.findFirst({
      where: { cliente_id: clienteId, estado: { in: ['ACTIVA', 'BLOQUEADA'] } },
    });
    if (!libreta) throw new AppError(400, 'El cliente no tiene libreta activa');
    if (libreta.estado === 'BLOQUEADA') throw new AppError(400, 'La libreta está bloqueada por deuda vencida');
    return libreta;
  }

  async validarCredito(clienteId: number, monto: bigint): Promise<void> {
    const libreta = await this.obtenerLibretaActiva(clienteId);
    if (libreta.saldo_actual + monto > libreta.limite_credito) {
      throw new AppError(
        400,
        `Límite de crédito excedido. Disponible: Gs. ${libreta.limite_credito - libreta.saldo_actual}`
      );
    }
  }

  async cargarConsumo(
    tx: Prisma.TransactionClient,
    libretaId: number,
    ventaId: number,
    monto: bigint,
    usuarioId: number
  ): Promise<void> {
    const libreta = await tx.libreta.findUnique({ where: { id: libretaId } });
    if (!libreta) throw new AppError(404, 'Libreta no encontrada');
    const nuevoSaldo = libreta.saldo_actual + monto;
    await tx.libreta.update({ where: { id: libretaId }, data: { saldo_actual: nuevoSaldo } });
    await tx.libretaMovimiento.create({
      data: {
        libreta_id: libretaId,
        venta_id: ventaId,
        tipo_movimiento: 'CARGO',
        descripcion: `Consumo venta #${ventaId}`,
        monto_debe: monto,
        monto_haber: BigInt(0),
        saldo_resultante: nuevoSaldo,
        usuario_id: usuarioId,
      },
    });
  }

  async registrarPago(
    tx: Prisma.TransactionClient,
    libretaId: number,
    pagoId: number,
    monto: bigint,
    usuarioId: number
  ): Promise<void> {
    const libreta = await tx.libreta.findUnique({ where: { id: libretaId } });
    if (!libreta) throw new AppError(404, 'Libreta no encontrada');
    const nuevoSaldo = libreta.saldo_actual - monto < BigInt(0) ? BigInt(0) : libreta.saldo_actual - monto;
    const nuevoEstado = nuevoSaldo === BigInt(0) && libreta.estado === 'BLOQUEADA' ? 'ACTIVA' : libreta.estado;
    await tx.libreta.update({ where: { id: libretaId }, data: { saldo_actual: nuevoSaldo, estado: nuevoEstado } });
    await tx.libretaMovimiento.create({
      data: {
        libreta_id: libretaId,
        pago_id: pagoId,
        tipo_movimiento: 'ABONO',
        descripcion: `Pago registrado`,
        monto_debe: BigInt(0),
        monto_haber: monto,
        saldo_resultante: nuevoSaldo,
        usuario_id: usuarioId,
      },
    });
  }

  async revertirCargo(
    tx: Prisma.TransactionClient,
    libretaId: number,
    ventaId: number,
    monto: bigint,
    usuarioId: number
  ): Promise<void> {
    const libreta = await tx.libreta.findUnique({ where: { id: libretaId } });
    if (!libreta) return;
    const nuevoSaldo = libreta.saldo_actual - monto < BigInt(0) ? BigInt(0) : libreta.saldo_actual - monto;
    await tx.libreta.update({ where: { id: libretaId }, data: { saldo_actual: nuevoSaldo } });
    await tx.libretaMovimiento.create({
      data: {
        libreta_id: libretaId,
        venta_id: ventaId,
        tipo_movimiento: 'ABONO',
        descripcion: `Reverso anulación venta #${ventaId}`,
        monto_debe: BigInt(0),
        monto_haber: monto,
        saldo_resultante: nuevoSaldo,
        usuario_id: usuarioId,
      },
    });
  }
}
