import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import { PaymentService } from '../services/PaymentService';

const mockPrisma = prisma as unknown as {
  venta: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  pago: { aggregate: ReturnType<typeof vi.fn> };
};

const service = new PaymentService(prisma as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PaymentService.calcularMontoPendiente', () => {
  it('resta los pagos confirmados del total', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue({ id: 1, total: BigInt(50000), estado: 'PENDIENTE', cliente_id: 1 });
    mockPrisma.pago.aggregate.mockResolvedValue({ _sum: { monto: BigInt(20000) } });

    const { pendiente } = await service.calcularMontoPendiente(1);
    expect(pendiente).toBe(BigInt(30000));
  });

  it('devuelve el total cuando no hay pagos', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue({ id: 1, total: BigInt(50000), estado: 'PENDIENTE', cliente_id: 1 });
    mockPrisma.pago.aggregate.mockResolvedValue({ _sum: { monto: null } });

    const { pendiente } = await service.calcularMontoPendiente(1);
    expect(pendiente).toBe(BigInt(50000));
  });

  it('lanza si la venta no existe', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue(null);
    await expect(service.calcularMontoPendiente(999)).rejects.toThrow('Venta no encontrada');
  });
});

describe('PaymentService.verificarCompletitudVenta', () => {
  it('marca COMPLETADA cuando el pendiente llega a 0', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue({ id: 1, total: BigInt(50000), estado: 'PENDIENTE', cliente_id: 1 });
    mockPrisma.pago.aggregate.mockResolvedValue({ _sum: { monto: BigInt(50000) } });
    mockPrisma.venta.update.mockResolvedValue({});

    await service.verificarCompletitudVenta(1);
    expect(mockPrisma.venta.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { estado: 'COMPLETADA' } });
  });

  it('no toca la venta si aún queda pendiente', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue({ id: 1, total: BigInt(50000), estado: 'PENDIENTE', cliente_id: 1 });
    mockPrisma.pago.aggregate.mockResolvedValue({ _sum: { monto: BigInt(10000) } });

    await service.verificarCompletitudVenta(1);
    expect(mockPrisma.venta.update).not.toHaveBeenCalled();
  });
});
