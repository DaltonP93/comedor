import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';

const router = Router();
router.use(authenticate);

interface VentaItem {
  producto_id?: number;
  concepto_id?: number;
  descripcion: string;
  cantidad: number;
  unidad_medida?: string;
  precio_unitario: number;
  iva_porcentaje?: number;
}

// GET /ventas
router.get('/', requirePermiso('VENTAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { estado, tipo_venta, cliente_id, sucursal_id, fecha_desde, fecha_hasta, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (tipo_venta) where.tipo_venta = tipo_venta;
    if (cliente_id) where.cliente_id = parseInt(String(cliente_id));
    if (sucursal_id) where.sucursal_id = parseInt(String(sucursal_id));
    if (fecha_desde || fecha_hasta) {
      where.creado_en = {};
      if (fecha_desde) (where.creado_en as Record<string, Date>).gte = new Date(String(fecha_desde));
      if (fecha_hasta) (where.creado_en as Record<string, Date>).lte = new Date(String(fecha_hasta));
    }

    const [ventas, total] = await Promise.all([
      prisma.venta.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { creado_en: 'desc' },
        include: {
          cliente: true,
          usuario: { select: { nombre: true, apellido: true } },
          sucursal: true,
          _count: { select: { items: true } },
        },
      }),
      prisma.venta.count({ where }),
    ]);

    res.json({
      success: true,
      data: ventas,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener ventas' });
  }
});

// GET /ventas/:id
router.get('/:id', requirePermiso('VENTAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        items: { include: { producto: true, concepto: true } },
        cliente: true,
        usuario: { select: { nombre: true, apellido: true } },
        sucursal: true,
        pagos: true,
        factura: true,
      },
    });
    if (!venta) {
      res.status(404).json({ success: false, message: 'Venta no encontrada' });
      return;
    }
    res.json({ success: true, data: venta });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener venta' });
  }
});

// POST /ventas
router.post(
  '/',
  requirePermiso('VENTAS:CREAR'),
  [
    body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un item'),
    body('sucursal_id').isInt().withMessage('Sucursal requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        sucursal_id,
        caja_id,
        cliente_id,
        tipo_venta = 'MOSTRADOR',
        condicion_pago = 'CONTADO',
        descuento = 0,
        items,
        forma_pago,
      } = req.body;

      // Calculate totals
      let subtotal = BigInt(0);
      let ivaTotal = BigInt(0);

      const itemsCalculados = (items as VentaItem[]).map((item) => {
        const cantidad = Number(item.cantidad);
        const precioUnitario = BigInt(item.precio_unitario);
        const ivaPct = Number(item.iva_porcentaje ?? 10);
        const itemSubtotal = precioUnitario * BigInt(Math.round(cantidad * 1000)) / BigInt(1000);
        const ivaItem = (itemSubtotal * BigInt(ivaPct)) / BigInt(100 + ivaPct);

        subtotal += itemSubtotal;
        ivaTotal += ivaItem;

        return {
          producto_id: item.producto_id || undefined,
          concepto_id: item.concepto_id || undefined,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad_medida: item.unidad_medida || 'UNIDAD',
          precio_unitario: precioUnitario,
          iva_porcentaje: ivaPct,
          subtotal: itemSubtotal,
          total: itemSubtotal,
        };
      });

      const descuentoBigInt = BigInt(descuento);
      const total = subtotal - descuentoBigInt;
      const esCreditoLibreta = condicion_pago === 'CREDITO' || forma_pago === 'LIBRETA';

      // Check libreta if needed
      if (esCreditoLibreta && cliente_id) {
        const libreta = await prisma.libreta.findFirst({
          where: { cliente_id, estado: 'ACTIVA' },
        });
        if (!libreta) {
          res.status(400).json({ success: false, message: 'El cliente no tiene libreta activa' });
          return;
        }
        if (libreta.saldo_actual + total > libreta.limite_credito) {
          res.status(400).json({ success: false, message: 'Límite de crédito excedido' });
          return;
        }
      }

      const venta = await prisma.$transaction(async (tx) => {
        const v = await tx.venta.create({
          data: {
            sucursal_id,
            caja_id: caja_id || undefined,
            cliente_id: cliente_id || undefined,
            usuario_id: req.user!.userId,
            tipo_venta,
            estado: 'COMPLETADA',
            condicion_pago: esCreditoLibreta ? 'CREDITO' : 'CONTADO',
            subtotal,
            descuento: descuentoBigInt,
            iva_total: ivaTotal,
            total,
            cargada_libreta: esCreditoLibreta,
            items: { create: itemsCalculados },
          },
          include: { items: true },
        });

        // Create stock movements for items that affect stock
        for (const item of items as VentaItem[]) {
          if (item.producto_id) {
            const producto = await tx.producto.findUnique({ where: { id: item.producto_id } });
            if (producto?.controla_stock) {
              await tx.stockMovimiento.create({
                data: {
                  producto_id: item.producto_id,
                  sucursal_id,
                  tipo_movimiento: 'SALIDA',
                  referencia_tipo: 'VENTA',
                  referencia_id: v.id,
                  cantidad: -Math.abs(Number(item.cantidad)),
                  usuario_id: req.user!.userId,
                },
              });
            }
          }
        }

        // Handle libreta
        if (esCreditoLibreta && cliente_id) {
          const libreta = await tx.libreta.findFirst({
            where: { cliente_id, estado: 'ACTIVA' },
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
                descripcion: 'Cargo por venta',
                monto_debe: total,
                monto_haber: BigInt(0),
                saldo_resultante: nuevoSaldo,
                usuario_id: req.user!.userId,
              },
            });
          }
        }

        // Create payment if contado
        if (!esCreditoLibreta) {
          await tx.pago.create({
            data: {
              venta_id: v.id,
              cliente_id: cliente_id || undefined,
              forma_pago: forma_pago || 'EFECTIVO',
              monto: total,
              estado: 'CONFIRMADO',
            },
          });
        }

        return v;
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'VENTAS',
        accion: 'CREAR',
        registroId: venta.id,
        ip: req.ip,
      });

      res.status(201).json({ success: true, message: 'Venta creada', data: venta });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear venta' });
    }
  }
);

// POST /ventas/:id/pagar
router.post('/:id/pagar', requirePermiso('VENTAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { forma_pago, monto, referencia_externa, voucher } = req.body;

    const venta = await prisma.venta.findUnique({ where: { id } });
    if (!venta) {
      res.status(404).json({ success: false, message: 'Venta no encontrada' });
      return;
    }

    const pago = await prisma.pago.create({
      data: {
        venta_id: id,
        cliente_id: venta.cliente_id || undefined,
        forma_pago: forma_pago || 'EFECTIVO',
        monto: BigInt(monto ?? venta.total),
        estado: 'CONFIRMADO',
        referencia_externa,
        voucher,
      },
    });

    res.json({ success: true, message: 'Pago registrado', data: pago });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al registrar pago' });
  }
});

// POST /ventas/:id/anular
router.post('/:id/anular', requirePermiso('VENTAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { motivo } = req.body;

    const venta = await prisma.venta.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!venta) {
      res.status(404).json({ success: false, message: 'Venta no encontrada' });
      return;
    }
    if (venta.estado === 'ANULADA') {
      res.status(400).json({ success: false, message: 'Venta ya anulada' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Anular venta
      await tx.venta.update({ where: { id }, data: { estado: 'ANULADA' } });

      // Reverse stock movements
      const stockMovs = await tx.stockMovimiento.findMany({
        where: { referencia_tipo: 'VENTA', referencia_id: id },
      });

      for (const mov of stockMovs) {
        await tx.stockMovimiento.create({
          data: {
            producto_id: mov.producto_id,
            sucursal_id: mov.sucursal_id,
            tipo_movimiento: 'AJUSTE',
            referencia_tipo: 'ANULACION_VENTA',
            referencia_id: id,
            cantidad: -Number(mov.cantidad), // reverse
            observacion: `Anulación de venta #${id}. ${motivo || ''}`,
            usuario_id: req.user!.userId,
          },
        });
      }

      // Reverse libreta if applicable
      if (venta.cargada_libreta && venta.cliente_id) {
        const libreta = await tx.libreta.findFirst({
          where: { cliente_id: venta.cliente_id, estado: 'ACTIVA' },
        });
        if (libreta) {
          const nuevoSaldo = libreta.saldo_actual - venta.total;
          await tx.libreta.update({
            where: { id: libreta.id },
            data: { saldo_actual: nuevoSaldo < BigInt(0) ? BigInt(0) : nuevoSaldo },
          });
          await tx.libretaMovimiento.create({
            data: {
              libreta_id: libreta.id,
              venta_id: id,
              tipo_movimiento: 'ABONO',
              descripcion: `Anulación de venta #${id}`,
              monto_debe: BigInt(0),
              monto_haber: venta.total,
              saldo_resultante: nuevoSaldo < BigInt(0) ? BigInt(0) : nuevoSaldo,
              usuario_id: req.user!.userId,
            },
          });
        }
      }
    });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'VENTAS',
      accion: 'ANULAR',
      registroId: id,
      valorNuevo: { motivo },
      ip: req.ip,
    });

    res.json({ success: true, message: 'Venta anulada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al anular venta' });
  }
});

// POST /ventas/por-kilo
router.post(
  '/por-kilo',
  requirePermiso('VENTAS:CREAR'),
  [
    body('producto_id').isInt().withMessage('Producto requerido'),
    body('peso_kg').isFloat({ min: 0.001 }).withMessage('Peso inválido'),
    body('sucursal_id').isInt().withMessage('Sucursal requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { producto_id, peso_kg, sucursal_id, caja_id, cliente_id, forma_pago, descuento = 0 } = req.body;

      const producto = await prisma.producto.findUnique({ where: { id: producto_id } });
      if (!producto || !producto.precio_por_kg) {
        res.status(400).json({ success: false, message: 'Producto sin precio por kg' });
        return;
      }

      const total = BigInt(Math.round(Number(producto.precio_por_kg) * peso_kg)) - BigInt(descuento);

      const venta = await prisma.$transaction(async (tx) => {
        const v = await tx.venta.create({
          data: {
            sucursal_id,
            caja_id: caja_id || undefined,
            cliente_id: cliente_id || undefined,
            usuario_id: req.user!.userId,
            tipo_venta: 'KILO',
            estado: 'COMPLETADA',
            condicion_pago: 'CONTADO',
            subtotal: total,
            descuento: BigInt(descuento),
            iva_total: BigInt(0),
            total,
            items: {
              create: [
                {
                  producto_id,
                  descripcion: `${producto.nombre} - ${peso_kg}kg`,
                  cantidad: peso_kg,
                  unidad_medida: 'KG',
                  precio_unitario: producto.precio_por_kg,
                  iva_porcentaje: Number(producto.iva_porcentaje),
                  subtotal: total,
                  total,
                },
              ],
            },
          },
        });

        if (producto.controla_stock) {
          await tx.stockMovimiento.create({
            data: {
              producto_id,
              sucursal_id,
              tipo_movimiento: 'SALIDA',
              referencia_tipo: 'VENTA_KILO',
              referencia_id: v.id,
              cantidad: -peso_kg,
              usuario_id: req.user!.userId,
            },
          });
        }

        await tx.pago.create({
          data: {
            venta_id: v.id,
            cliente_id: cliente_id || undefined,
            forma_pago: forma_pago || 'EFECTIVO',
            monto: total,
            estado: 'CONFIRMADO',
          },
        });

        return v;
      });

      res.status(201).json({ success: true, message: 'Venta por kilo creada', data: venta });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear venta por kilo' });
    }
  }
);

// POST /ventas/cargar-libreta
router.post(
  '/cargar-libreta',
  requirePermiso('VENTAS:CREAR'),
  [
    body('cliente_id').isInt().withMessage('Cliente requerido'),
    body('items').isArray({ min: 1 }).withMessage('Items requeridos'),
    body('sucursal_id').isInt().withMessage('Sucursal requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { cliente_id, sucursal_id, caja_id, items, descuento = 0 } = req.body;

      const libreta = await prisma.libreta.findFirst({
        where: { cliente_id, estado: 'ACTIVA' },
      });
      if (!libreta) {
        res.status(400).json({ success: false, message: 'El cliente no tiene libreta activa' });
        return;
      }

      let total = BigInt(0);
      const itemsCalculados = (items as VentaItem[]).map((item) => {
        const itemTotal = BigInt(item.precio_unitario) * BigInt(Math.round(Number(item.cantidad) * 1000)) / BigInt(1000);
        total += itemTotal;
        return {
          producto_id: item.producto_id || undefined,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad_medida: item.unidad_medida || 'UNIDAD',
          precio_unitario: BigInt(item.precio_unitario),
          iva_porcentaje: item.iva_porcentaje ?? 10,
          subtotal: itemTotal,
          total: itemTotal,
        };
      });

      const descuentoBigInt = BigInt(descuento);
      total -= descuentoBigInt;

      if (libreta.saldo_actual + total > libreta.limite_credito) {
        res.status(400).json({ success: false, message: 'Límite de crédito excedido' });
        return;
      }

      const venta = await prisma.$transaction(async (tx) => {
        const v = await tx.venta.create({
          data: {
            sucursal_id,
            caja_id: caja_id || undefined,
            cliente_id,
            usuario_id: req.user!.userId,
            tipo_venta: 'LIBRETA',
            estado: 'COMPLETADA',
            condicion_pago: 'CREDITO',
            subtotal: total,
            descuento: descuentoBigInt,
            iva_total: BigInt(0),
            total,
            cargada_libreta: true,
            items: { create: itemsCalculados },
          },
        });

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
            descripcion: 'Cargo a libreta',
            monto_debe: total,
            monto_haber: BigInt(0),
            saldo_resultante: nuevoSaldo,
            usuario_id: req.user!.userId,
          },
        });

        return v;
      });

      res.status(201).json({ success: true, message: 'Carga a libreta exitosa', data: venta });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al cargar a libreta' });
    }
  }
);

export default router;
