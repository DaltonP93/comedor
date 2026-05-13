import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

export class StockService {
  constructor(private prisma: PrismaClient) {}

  async getStockActual(productoId: number, sucursalId: number): Promise<number> {
    const stock = await this.prisma.stockActual.findFirst({
      where: { producto_id: productoId, sucursal_id: sucursalId },
    });
    return Number(stock?.cantidad ?? 0);
  }

  async validarDisponibilidad(
    items: Array<{ producto_id?: number; cantidad: number }>,
    sucursalId: number
  ): Promise<void> {
    const permitirNegativo = process.env.STOCK_PERMITIR_NEGATIVO === 'true';
    if (permitirNegativo) return;

    for (const item of items) {
      if (!item.producto_id) continue;
      const producto = await this.prisma.producto.findUnique({ where: { id: item.producto_id } });
      if (!producto?.controla_stock) continue;

      const disponible = await this.getStockActual(item.producto_id, sucursalId);
      if (disponible < item.cantidad) {
        throw new AppError(
          400,
          `Stock insuficiente para "${producto.nombre}": disponible ${disponible}, requerido ${item.cantidad}`
        );
      }
    }
  }

  async actualizarStockActual(
    tx: Prisma.TransactionClient,
    productoId: number,
    sucursalId: number,
    delta: number,
    costoUnitario?: bigint
  ): Promise<void> {
    const existing = await tx.stockActual.findFirst({
      where: { producto_id: productoId, sucursal_id: sucursalId },
    });

    if (existing) {
      const nuevaCantidad = Number(existing.cantidad) + delta;
      const updateData: Record<string, unknown> = { cantidad: nuevaCantidad };
      if (costoUnitario && delta > 0) {
        // Costo promedio ponderado
        const totalAnterior = Number(existing.cantidad) * Number(existing.costo_promedio);
        const totalNuevo = delta * Number(costoUnitario);
        const nuevaCantidadTotal = Number(existing.cantidad) + delta;
        if (nuevaCantidadTotal > 0) {
          updateData.costo_promedio = BigInt(Math.round((totalAnterior + totalNuevo) / nuevaCantidadTotal));
        }
      }
      await tx.stockActual.update({ where: { id: existing.id }, data: updateData });
    } else {
      await tx.stockActual.create({
        data: {
          producto_id: productoId,
          sucursal_id: sucursalId,
          cantidad: delta,
          costo_promedio: costoUnitario ?? BigInt(0),
        },
      });
    }
  }

  async descontarPorVenta(
    tx: Prisma.TransactionClient,
    ventaId: number,
    items: Array<{ producto_id?: number; cantidad: number }>,
    sucursalId: number,
    usuarioId: number
  ): Promise<void> {
    for (const item of items) {
      if (!item.producto_id) continue;
      const producto = await tx.producto.findUnique({
        where: { id: item.producto_id },
        include: { recetas: { where: { activo: true }, include: { items: true } } },
      });
      if (!producto?.controla_stock) continue;

      await tx.stockMovimiento.create({
        data: {
          producto_id: item.producto_id,
          sucursal_id: sucursalId,
          tipo_movimiento: 'SALIDA',
          referencia_tipo: 'VENTA',
          referencia_id: ventaId,
          cantidad: -Math.abs(item.cantidad),
          usuario_id: usuarioId,
        },
      });
      await this.actualizarStockActual(tx, item.producto_id, sucursalId, -Math.abs(item.cantidad));

      // Descontar insumos de receta
      for (const receta of producto.recetas) {
        for (const ri of receta.items) {
          const cantInsumo = Number(ri.cantidad) * item.cantidad;
          await tx.stockMovimiento.create({
            data: {
              producto_id: ri.insumo_id,
              sucursal_id: sucursalId,
              tipo_movimiento: 'SALIDA',
              referencia_tipo: 'RECETA_VENTA',
              referencia_id: ventaId,
              cantidad: -cantInsumo,
              observacion: `Receta: ${receta.nombre}`,
              usuario_id: usuarioId,
            },
          });
          await this.actualizarStockActual(tx, ri.insumo_id, sucursalId, -cantInsumo);
        }
      }
    }
  }

  async revertirPorAnulacion(
    tx: Prisma.TransactionClient,
    ventaId: number,
    sucursalId: number,
    usuarioId: number
  ): Promise<void> {
    const movimientos = await tx.stockMovimiento.findMany({
      where: { referencia_id: ventaId, referencia_tipo: { in: ['VENTA', 'RECETA_VENTA'] } },
    });
    for (const mov of movimientos) {
      const cantReversion = -Number(mov.cantidad);
      await tx.stockMovimiento.create({
        data: {
          producto_id: mov.producto_id,
          sucursal_id: mov.sucursal_id,
          tipo_movimiento: 'AJUSTE',
          referencia_tipo: mov.referencia_tipo === 'VENTA' ? 'ANULACION_VENTA' : 'ANULACION_RECETA',
          referencia_id: ventaId,
          cantidad: cantReversion,
          observacion: `Anulación venta #${ventaId}`,
          usuario_id: usuarioId,
        },
      });
      await this.actualizarStockActual(tx, mov.producto_id, mov.sucursal_id, cantReversion);
    }
  }
}
