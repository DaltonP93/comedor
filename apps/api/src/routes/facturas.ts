import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';
import { generarFacturaPDF } from '../lib/facturaPdf';

const router = Router();
router.use(authenticate);

// GET /facturas
router.get('/', requirePermiso('VENTAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      estado,
      fecha_desde,
      fecha_hasta,
      cliente_id,
      venta_id,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (cliente_id) where.cliente_id = parseInt(String(cliente_id));
    if (venta_id) where.venta_id = parseInt(String(venta_id));
    if (fecha_desde || fecha_hasta) {
      where.fecha = {};
      if (fecha_desde) (where.fecha as Record<string, Date>).gte = new Date(String(fecha_desde));
      if (fecha_hasta) (where.fecha as Record<string, Date>).lte = new Date(String(fecha_hasta) + 'T23:59:59');
    }

    const [facturas, total] = await Promise.all([
      prisma.factura.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { creado_en: 'desc' },
        include: {
          cliente: { select: { id: true, nombre: true, ruc: true } },
          venta: { select: { id: true, total: true, estado: true } },
        },
      }),
      prisma.factura.count({ where }),
    ]);

    res.json({
      success: true,
      data: facturas,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener facturas' });
  }
});

// GET /facturas/:id
router.get('/:id', requirePermiso('VENTAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const factura = await prisma.factura.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        cliente: true,
        venta: {
          include: {
            items: { include: { producto: true, concepto: true } },
          },
        },
      },
    });

    if (!factura) {
      res.status(404).json({ success: false, message: 'Factura no encontrada' });
      return;
    }

    res.json({ success: true, data: factura });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener factura' });
  }
});

// POST /facturas — emitir factura para una venta
router.post(
  '/',
  requirePermiso('VENTAS:CREAR'),
  [
    body('venta_id').isInt().withMessage('Venta requerida'),
    body('tipo_documento')
      .isIn(['FACTURA', 'TICKET'])
      .withMessage('Tipo de documento inválido'),
    body('condicion')
      .isIn(['CONTADO', 'CREDITO'])
      .withMessage('Condición inválida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        venta_id,
        cliente_id,
        tipo_documento,
        condicion,
      } = req.body as {
        venta_id: number;
        cliente_id?: number;
        tipo_documento: string;
        condicion: string;
      };

      // Verificar que la venta existe
      const venta = await prisma.venta.findUnique({
        where: { id: venta_id },
        include: {
          items: { include: { producto: true } },
          cliente: true,
        },
      });

      if (!venta) {
        res.status(404).json({ success: false, message: 'Venta no encontrada' });
        return;
      }

      if (venta.facturada) {
        res.status(400).json({ success: false, message: 'La venta ya fue facturada' });
        return;
      }

      // Determinar cliente a facturar
      const clienteId = cliente_id || venta.cliente_id || undefined;

      // Calcular IVA desagregado
      let subtotal = BigInt(0);
      let ivaTotal = BigInt(0);

      for (const item of venta.items) {
        const ivaPct = Number(item.iva_porcentaje);
        if (ivaPct > 0) {
          const ivaItem = (item.subtotal * BigInt(ivaPct)) / BigInt(100 + ivaPct);
          ivaTotal += ivaItem;
          subtotal += item.subtotal - ivaItem;
        } else {
          subtotal += item.subtotal;
        }
      }

      // Verificar si SIFEN está habilitado
      const sifenConfig = await prisma.configuracion.findUnique({
        where: { clave: 'SIFEN_HABILITADO' },
      });
      const sifenHabilitado = sifenConfig?.valor === 'true';

      // Generar número secuencial
      const ultimaFactura = await prisma.factura.findFirst({
        where: { tipo_documento: { not: 'NOTA_CREDITO' } },
        orderBy: { id: 'desc' },
      });

      let proximoNumero = 1;
      if (ultimaFactura?.numero) {
        const partes = ultimaFactura.numero.split('-');
        const ultimoNum = parseInt(partes[partes.length - 1] || '0');
        proximoNumero = ultimoNum + 1;
      }

      // Leer configuración de establecimiento y punto
      const [configEstablecimiento, configPunto] = await Promise.all([
        prisma.configuracion.findUnique({ where: { clave: 'FACTURA_ESTABLECIMIENTO' } }),
        prisma.configuracion.findUnique({ where: { clave: 'FACTURA_PUNTO_EXPEDICION' } }),
      ]);

      const estab = configEstablecimiento?.valor || '001';
      const punto = configPunto?.valor || '001';
      const numero = `${estab}-${punto}-${String(proximoNumero).padStart(7, '0')}`;

      const estadoFactura = sifenHabilitado ? 'PENDIENTE_SIFEN' : 'EMITIDA';

      const factura = await prisma.$transaction(async (tx) => {
        const f = await tx.factura.create({
          data: {
            venta_id,
            cliente_id: clienteId,
            tipo_documento,
            numero,
            subtotal,
            iva_total: ivaTotal,
            total: venta.total,
            estado: estadoFactura,
          },
          include: {
            cliente: true,
            venta: { include: { items: true } },
          },
        });

        await tx.venta.update({
          where: { id: venta_id },
          data: { facturada: true },
        });

        return f;
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'FACTURAS',
        accion: 'EMITIR',
        registroId: factura.id,
        valorNuevo: { venta_id, numero, tipo_documento, condicion, estado: estadoFactura },
        ip: req.ip,
      });

      res.status(201).json({ success: true, message: 'Factura emitida', data: factura });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al emitir factura' });
    }
  }
);

// POST /facturas/:id/anular — anular factura y crear nota de crédito
router.post('/:id/anular', requirePermiso('VENTAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const factura = await prisma.factura.findUnique({
      where: { id },
      include: { venta: { include: { items: true } } },
    });

    if (!factura) {
      res.status(404).json({ success: false, message: 'Factura no encontrada' });
      return;
    }

    if (factura.estado === 'ANULADA') {
      res.status(400).json({ success: false, message: 'Factura ya anulada' });
      return;
    }

    if (factura.tipo_documento === 'NOTA_CREDITO') {
      res.status(400).json({ success: false, message: 'No se puede anular una nota de crédito' });
      return;
    }

    // Número para la nota de crédito
    const ultimaNC = await prisma.factura.findFirst({
      where: { tipo_documento: 'NOTA_CREDITO' },
      orderBy: { id: 'desc' },
    });

    let proximoNC = 1;
    if (ultimaNC?.numero) {
      const partes = ultimaNC.numero.split('-');
      const ultimoNum = parseInt(partes[partes.length - 1] || '0');
      proximoNC = ultimoNum + 1;
    }

    const [configEstablecimiento, configPunto] = await Promise.all([
      prisma.configuracion.findUnique({ where: { clave: 'FACTURA_ESTABLECIMIENTO' } }),
      prisma.configuracion.findUnique({ where: { clave: 'FACTURA_PUNTO_EXPEDICION' } }),
    ]);

    const estab = configEstablecimiento?.valor || '001';
    const punto = configPunto?.valor || '001';
    const numeroNC = `NC-${estab}-${punto}-${String(proximoNC).padStart(7, '0')}`;

    const resultado = await prisma.$transaction(async (tx) => {
      // Anular factura original
      await tx.factura.update({
        where: { id },
        data: { estado: 'ANULADA' },
      });

      // Crear nota de crédito — nota: venta_id es unique en Factura, así que
      // la nota de crédito no puede referirse al mismo venta_id.
      // Se registra como log de auditoría con referencia al id de la factura original.
      return { anulada: id, nota_credito_numero: numeroNC };
    });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'FACTURAS',
      accion: 'ANULAR',
      registroId: id,
      valorNuevo: { nota_credito_numero: numeroNC, factura_original_id: id },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Factura anulada. Nota de crédito registrada en auditoría.',
      data: resultado,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al anular factura' });
  }
});

// POST /facturas/:id/reenviar-sifen — reenviar a SIFEN (placeholder)
router.post('/:id/reenviar-sifen', requirePermiso('VENTAS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const factura = await prisma.factura.findUnique({ where: { id } });
    if (!factura) {
      res.status(404).json({ success: false, message: 'Factura no encontrada' });
      return;
    }

    // Verificar configuración SIFEN
    const sifenToken = await prisma.configuracion.findUnique({ where: { clave: 'SIFEN_TOKEN' } });
    if (!sifenToken?.valor) {
      res.json({
        success: false,
        message: 'Integración SIFEN pendiente de configuración',
      });
      return;
    }

    await prisma.factura.update({
      where: { id },
      data: { estado: 'ENVIANDO_SIFEN' },
    });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'FACTURAS',
      accion: 'REENVIAR_SIFEN',
      registroId: id,
      ip: req.ip,
    });

    // TODO: implementar llamada real a SIFEN/DNIT con credenciales configuradas
    res.json({
      success: true,
      message: 'Integración SIFEN pendiente de configuración',
      data: { factura_id: id, estado: 'ENVIANDO_SIFEN' },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al reenviar a SIFEN' });
  }
});

// GET /facturas/:id/pdf — generar PDF de la factura
router.get('/:id/pdf', requirePermiso('VENTAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const factura = await prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        venta: {
          include: {
            items: { include: { producto: true } },
          },
        },
      },
    });

    if (!factura) {
      res.status(404).json({ success: false, message: 'Factura no encontrada' });
      return;
    }

    // Leer configuración fiscal
    const [configRazonSocial, configRuc, configDireccion, configTimbrado, configEstablecimiento, configPunto] =
      await Promise.all([
        prisma.configuracion.findUnique({ where: { clave: 'RAZON_SOCIAL' } }),
        prisma.configuracion.findUnique({ where: { clave: 'RUC_EMISOR' } }),
        prisma.configuracion.findUnique({ where: { clave: 'DIRECCION_FISCAL' } }),
        prisma.configuracion.findUnique({ where: { clave: 'TIMBRADO' } }),
        prisma.configuracion.findUnique({ where: { clave: 'FACTURA_ESTABLECIMIENTO' } }),
        prisma.configuracion.findUnique({ where: { clave: 'FACTURA_PUNTO_EXPEDICION' } }),
      ]);

    const items = factura.venta.items.map((item) => ({
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      iva_porcentaje: Number(item.iva_porcentaje),
      subtotal: item.subtotal,
    }));

    const pdfBuffer = await generarFacturaPDF({
      factura: {
        id: factura.id,
        numero: factura.numero,
        tipo_documento: factura.tipo_documento,
        fecha: factura.fecha,
        estado: factura.estado,
        subtotal: factura.subtotal,
        iva_total: factura.iva_total,
        total: factura.total,
      },
      cliente: factura.cliente,
      condicion: factura.venta.condicion_pago,
      items,
      config: {
        razon_social: configRazonSocial?.valor || 'COMEDOR',
        ruc: configRuc?.valor || '-',
        direccion: configDireccion?.valor || '-',
        timbrado: configTimbrado?.valor || '-',
        establecimiento: configEstablecimiento?.valor || '001',
        punto_expedicion: configPunto?.valor || '001',
      },
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="factura-${factura.numero}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al generar PDF' });
  }
});

export default router;
