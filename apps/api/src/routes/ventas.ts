import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';
import { calcularTotalesVenta } from '../lib/calculos';
import { StockService } from '../services/StockService';
import { LibretaService } from '../services/LibretaService';
import { AppError } from '../middleware/errorHandler';
import { clientePublicSelect } from '../lib/selects';

const router = Router();
router.use(authenticate);

const stockService = new StockService(prisma);
const libretaService = new LibretaService(prisma);

interface VentaItem {
  producto_id?: number;
  concepto_id?: number;
  descripcion: string;
  cantidad: number;
  unidad_medida?: string;
  precio_unitario: number;
  iva_porcentaje?: number;
  descuento_item?: number;
}

interface EntradaPago {
  forma_pago: string;
  monto: number;
  voucher?: string;
  autorizacion?: string;
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
          cliente: { select: clientePublicSelect },
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
        cliente: { select: clientePublicSelect },
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
        pagos: pagosEntrada,
      } = req.body;

      // Validar pagos mixtos si se proveen
      const tienePagosArray = Array.isArray(pagosEntrada) && pagosEntrada.length > 0;

      // Calcular totales con helper
      const itemsCalculo = (items as VentaItem[]).map((item) => ({
        precio_unitario: item.precio_unitario,
        cantidad: item.cantidad,
        iva_porcentaje: (item.iva_porcentaje ?? 10) as 0 | 5 | 10,
        descuento_item: item.descuento_item,
      }));

      const totales = calcularTotalesVenta(itemsCalculo, descuento);

      const itemsCalculados = (items as VentaItem[]).map((item) => {
        const precio = BigInt(Math.round(Number(item.precio_unitario)));
        const cant = BigInt(Math.round(item.cantidad * 1000));
        const itemTotal = (precio * cant) / BigInt(1000);
        const descItem = BigInt(Math.round(Number(item.descuento_item ?? 0)));
        const neto = itemTotal - descItem;
        return {
          producto_id: item.producto_id || undefined,
          concepto_id: item.concepto_id || undefined,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad_medida: item.unidad_medida || 'UNIDAD',
          precio_unitario: precio,
          iva_porcentaje: item.iva_porcentaje ?? 10,
          subtotal: neto,
          total: neto,
        };
      });

      const esCreditoLibreta = condicion_pago === 'CREDITO' || forma_pago === 'LIBRETA';

      // Validar pagos mixtos: suma debe igualar el total
      if (tienePagosArray && !esCreditoLibreta) {
        const sumaPagos = (pagosEntrada as EntradaPago[]).reduce((s, p) => s + Number(p.monto), 0);
        if (Math.abs(sumaPagos - Number(totales.total)) > 1) {
          res.status(400).json({ success: false, message: `La suma de pagos (${sumaPagos}) no coincide con el total (${totales.total})` });
          return;
        }
      }

      // Validar crédito en libreta antes de la transacción
      if (esCreditoLibreta && cliente_id) {
        try {
          await libretaService.validarCredito(cliente_id, totales.total);
        } catch (err) {
          if (err instanceof AppError) {
            res.status(err.statusCode).json({ success: false, message: err.message });
            return;
          }
          throw err;
        }
      }

      // Validar stock antes de la transacción
      await stockService.validarDisponibilidad(items as VentaItem[], sucursal_id);

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
            subtotal: totales.subtotal,
            descuento: totales.descuento,
            iva_total: totales.iva_total,
            total: totales.total,
            cargada_libreta: esCreditoLibreta,
            items: { create: itemsCalculados },
          },
          include: { items: true },
        });

        // Descontar stock usando el servicio
        await stockService.descontarPorVenta(tx, v.id, items as VentaItem[], sucursal_id, req.user!.userId);

        // Manejar libreta usando el servicio
        if (esCreditoLibreta && cliente_id) {
          const libreta = await tx.libreta.findFirst({
            where: { cliente_id, estado: 'ACTIVA' },
          });
          if (libreta) {
            await libretaService.cargarConsumo(tx, libreta.id, v.id, totales.total, req.user!.userId);
          }
        }

        // Crear pagos si es contado
        if (!esCreditoLibreta) {
          if (tienePagosArray) {
            // Pagos mixtos: uno por entrada
            for (const entrada of pagosEntrada as EntradaPago[]) {
              await tx.pago.create({
                data: {
                  venta_id: v.id,
                  cliente_id: cliente_id || undefined,
                  forma_pago: entrada.forma_pago,
                  monto: BigInt(Math.round(Number(entrada.monto))),
                  estado: 'CONFIRMADO',
                  voucher: entrada.voucher,
                  autorizacion: entrada.autorizacion,
                },
              });
            }
          } else {
            await tx.pago.create({
              data: {
                venta_id: v.id,
                cliente_id: cliente_id || undefined,
                forma_pago: forma_pago || 'EFECTIVO',
                monto: totales.total,
                estado: 'CONFIRMADO',
              },
            });
          }
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
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
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

    if (!motivo || String(motivo).trim() === '') {
      res.status(400).json({ success: false, message: 'El motivo de anulación es requerido' });
      return;
    }

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
      await tx.venta.update({ where: { id }, data: { estado: 'ANULADA' } });

      // Revertir stock usando el servicio
      await stockService.revertirPorAnulacion(tx, id, venta.sucursal_id, req.user!.userId);

      // Revertir libreta si aplica usando el servicio
      if (venta.cargada_libreta && venta.cliente_id) {
        const libreta = await tx.libreta.findFirst({
          where: { cliente_id: venta.cliente_id, estado: { in: ['ACTIVA', 'BLOQUEADA'] } },
        });
        if (libreta) {
          await libretaService.revertirCargo(tx, libreta.id, id, venta.total, req.user!.userId);
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
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
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
      if (!producto || producto.precio_por_kg === null) {
        res.status(400).json({ success: false, message: 'Producto sin precio por kg' });
        return;
      }

      const precioPorKg = producto.precio_por_kg;
      const total = BigInt(Math.round(Number(precioPorKg) * peso_kg)) - BigInt(descuento);

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
                  precio_unitario: precioPorKg,
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

        // Descontar ingredientes por receta si existe
        const recetaKilo = await tx.receta.findFirst({
          where: { producto_id, activo: true },
          include: { items: true },
        });
        if (recetaKilo) {
          for (const recetaItem of recetaKilo.items) {
            await tx.stockMovimiento.create({
              data: {
                producto_id: recetaItem.insumo_id,
                sucursal_id,
                tipo_movimiento: 'SALIDA',
                referencia_tipo: 'RECETA_VENTA',
                referencia_id: v.id,
                cantidad: -(Number(recetaItem.cantidad) * peso_kg),
                observacion: `Consumo por receta: ${recetaKilo.nombre}`,
                usuario_id: req.user!.userId,
              },
            });
          }
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

      // Validar crédito con el servicio
      const itemsCalculo = (items as VentaItem[]).map((item) => ({
        precio_unitario: item.precio_unitario,
        cantidad: item.cantidad,
        iva_porcentaje: (item.iva_porcentaje ?? 10) as 0 | 5 | 10,
        descuento_item: item.descuento_item,
      }));
      const totales = calcularTotalesVenta(itemsCalculo, descuento);

      try {
        await libretaService.validarCredito(cliente_id, totales.total);
      } catch (err) {
        if (err instanceof AppError) {
          res.status(err.statusCode).json({ success: false, message: err.message });
          return;
        }
        throw err;
      }

      // Validar stock
      await stockService.validarDisponibilidad(items as VentaItem[], sucursal_id);

      const itemsCalculados = (items as VentaItem[]).map((item) => {
        const precio = BigInt(Math.round(Number(item.precio_unitario)));
        const cant = BigInt(Math.round(item.cantidad * 1000));
        const itemTotal = (precio * cant) / BigInt(1000);
        const descItem = BigInt(Math.round(Number(item.descuento_item ?? 0)));
        const neto = itemTotal - descItem;
        return {
          producto_id: item.producto_id || undefined,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad_medida: item.unidad_medida || 'UNIDAD',
          precio_unitario: precio,
          iva_porcentaje: item.iva_porcentaje ?? 10,
          subtotal: neto,
          total: neto,
        };
      });

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
            subtotal: totales.subtotal,
            descuento: totales.descuento,
            iva_total: totales.iva_total,
            total: totales.total,
            cargada_libreta: true,
            items: { create: itemsCalculados },
          },
        });

        // Descontar stock usando el servicio
        await stockService.descontarPorVenta(tx, v.id, items as VentaItem[], sucursal_id, req.user!.userId);

        // Cargar en libreta usando el servicio
        const libreta = await tx.libreta.findFirst({
          where: { cliente_id, estado: 'ACTIVA' },
        });
        if (libreta) {
          await libretaService.cargarConsumo(tx, libreta.id, v.id, totales.total, req.user!.userId);
        }

        return v;
      });

      res.status(201).json({ success: true, message: 'Carga a libreta exitosa', data: venta });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al cargar a libreta' });
    }
  }
);

export default router;
