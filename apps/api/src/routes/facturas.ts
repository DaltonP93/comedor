import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';
import { generarFacturaPDF } from '../lib/facturaPdf';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errorHandler';
import { obtenerSiguienteNumero, formatearNumeroFactura } from '../lib/fiscal/SecuenciaService';
import { SifenProvider } from '../lib/fiscal/SifenProvider';

type PrismaTx = Prisma.TransactionClient;

const router = Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// GET /facturas
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  requirePermiso('FACTURAS:VER'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        estado,
        fecha_desde,
        fecha_hasta,
        cliente_id,
        venta_id,
        numero,
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
      if (numero) where.numero = { contains: String(numero) };
      if (fecha_desde || fecha_hasta) {
        where.fecha = {};
        if (fecha_desde)
          (where.fecha as Record<string, Date>).gte = new Date(String(fecha_desde));
        if (fecha_hasta)
          (where.fecha as Record<string, Date>).lte = new Date(
            String(fecha_hasta) + 'T23:59:59'
          );
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
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      logger.error('Error al obtener facturas', { error: String(error) });
      throw error;
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /facturas/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/:id',
  requirePermiso('FACTURAS:VER'),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError(400, 'ID de factura inválido');

    const factura = await prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        venta: {
          include: {
            items: { include: { producto: true, concepto: true } },
          },
        },
      },
    });

    if (!factura) throw new AppError(404, 'Factura no encontrada');

    // Cargar DocumentoFiscal si existe para esta venta
    const documentoFiscal = factura.venta_id
      ? await prisma.documentoFiscal.findUnique({
          where: { venta_id: factura.venta_id },
          include: { eventos: { orderBy: { creado_en: 'asc' } } },
        })
      : null;

    res.json({ success: true, data: { ...factura, documento_fiscal: documentoFiscal } });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /facturas — emitir factura para una venta
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/',
  requirePermiso('FACTURAS:CREAR'),
  [
    body('venta_id').isInt({ min: 1 }).withMessage('Venta requerida'),
    body('tipo_documento')
      .optional()
      .isIn(['FACTURA', 'BOLETA'])
      .withMessage('Tipo de documento inválido. Use FACTURA o BOLETA'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    const { venta_id, tipo_documento = 'FACTURA' } = req.body as {
      venta_id: number;
      tipo_documento?: string;
    };

    // ── Verificar que la venta existe y no está facturada ─────────────────────
    const venta = await prisma.venta.findUnique({
      where: { id: venta_id },
      include: {
        items: { include: { producto: true } },
        cliente: true,
      },
    });

    if (!venta) throw new AppError(404, 'Venta no encontrada');
    if (venta.facturada) throw new AppError(400, 'La venta ya fue facturada');
    if (venta.estado === 'ANULADA') throw new AppError(400, 'No se puede facturar una venta anulada');

    // ── Leer configuración fiscal ─────────────────────────────────────────────
    const clavesFiscales = [
      'ESTABLECIMIENTO',
      'PUNTO_EXPEDICION',
      'RUC_EMISOR',
      'RAZON_SOCIAL',
      'TIMBRADO_NUMERO',
      'TIMBRADO_VIGENCIA',
      'SIFEN_HABILITADO',
      'DIRECCION_FISCAL',
      'TIMBRADO',
      'FACTURA_ESTABLECIMIENTO',
      'FACTURA_PUNTO_EXPEDICION',
    ];

    const configuraciones = await prisma.configuracion.findMany({
      where: { clave: { in: clavesFiscales } },
    });

    const config: Record<string, string> = {};
    for (const c of configuraciones) config[c.clave] = c.valor;

    // ESTABLECIMIENTO y PUNTO_EXPEDICION pueden tener distintos nombres en la BD
    const establecimiento = config['ESTABLECIMIENTO'] ?? config['FACTURA_ESTABLECIMIENTO'] ?? '001';
    const puntoExpedicion = config['PUNTO_EXPEDICION'] ?? config['FACTURA_PUNTO_EXPEDICION'] ?? '001';
    const timbrado = config['TIMBRADO_NUMERO'] ?? config['TIMBRADO'] ?? '0';
    const sifenHabilitado = config['SIFEN_HABILITADO'] === 'true';

    // ── Calcular IVA desagregado ───────────────────────────────────────────────
    let subtotal = BigInt(0);
    let iva5 = BigInt(0);
    let iva10 = BigInt(0);
    let exento = BigInt(0);

    for (const item of venta.items) {
      const ivaPct = Number(item.iva_porcentaje);
      if (ivaPct === 10) {
        const ivaItem = (item.subtotal * BigInt(10)) / BigInt(110);
        iva10 += ivaItem;
        subtotal += item.subtotal - ivaItem;
      } else if (ivaPct === 5) {
        const ivaItem = (item.subtotal * BigInt(5)) / BigInt(105);
        iva5 += ivaItem;
        subtotal += item.subtotal - ivaItem;
      } else {
        exento += item.subtotal;
        subtotal += item.subtotal;
      }
    }

    const ivaTotal = iva5 + iva10;

    // ── Ejecutar todo en una sola transacción ─────────────────────────────────
    const resultado = await prisma.$transaction(async (tx: PrismaTx) => {
      // Obtener número de secuencia con bloqueo de fila
      const numero = await obtenerSiguienteNumero(tx, establecimiento, puntoExpedicion, tipo_documento);
      const numeroFormateado = formatearNumeroFactura(establecimiento, puntoExpedicion, numero);

      // Crear DocumentoFiscal
      const documentoFiscal = await tx.documentoFiscal.create({
        data: {
          venta_id,
          cliente_id: venta.cliente_id ?? undefined,
          tipo_documento,
          condicion: venta.condicion_pago,
          establecimiento,
          punto_expedicion: puntoExpedicion,
          numero,
          numero_formateado: numeroFormateado,
          timbrado,
          subtotal,
          iva_5: iva5,
          iva_10: iva10,
          iva_total: ivaTotal,
          exento,
          total: venta.total,
          estado: 'EMITIDA',
          estado_sifen: sifenHabilitado ? 'PENDIENTE' : null,
        },
      });

      // Registrar evento de emisión
      await tx.documentoFiscalEvento.create({
        data: {
          documento_fiscal_id: documentoFiscal.id,
          tipo_evento: 'EMISION',
          estado_anterior: 'BORRADOR',
          estado_nuevo: 'EMITIDA',
          mensaje: `Factura emitida por usuario ${req.user!.userId}`,
        },
      });

      // Crear/actualizar Factura legacy (mantiene compatibilidad con el resto del sistema)
      const facturaExistente = await tx.factura.findUnique({ where: { venta_id } });
      let factura;
      if (facturaExistente) {
        factura = await tx.factura.update({
          where: { venta_id },
          data: {
            numero: numeroFormateado,
            tipo_documento,
            subtotal,
            iva_total: ivaTotal,
            total: venta.total,
            estado: 'VIGENTE',
          },
        });
      } else {
        factura = await tx.factura.create({
          data: {
            venta_id,
            cliente_id: venta.cliente_id ?? undefined,
            tipo_documento,
            numero: numeroFormateado,
            subtotal,
            iva_total: ivaTotal,
            total: venta.total,
            estado: 'VIGENTE',
          },
          include: {
            cliente: true,
            venta: { include: { items: true } },
          },
        });
      }

      // Marcar la venta como facturada
      await tx.venta.update({
        where: { id: venta_id },
        data: { facturada: true },
      });

      return { factura, documentoFiscal };
    });

    // ── Intentar envío a SIFEN (fuera de la transacción para no bloquearla) ────
    if (sifenHabilitado) {
      try {
        const sifen = new SifenProvider(true);
        const sifenResult = await sifen.enviarFactura(resultado.documentoFiscal.id);

        await prisma.documentoFiscal.update({
          where: { id: resultado.documentoFiscal.id },
          data: {
            cdc: sifenResult.cdc,
            kude_url: sifenResult.kude_url ?? null,
            xml: sifenResult.xml ?? null,
            estado_sifen: sifenResult.estado,
            estado: sifenResult.estado === 'APROBADO' ? 'EMITIDA' : 'ERROR_SIFEN',
          },
        });

        await prisma.documentoFiscalEvento.create({
          data: {
            documento_fiscal_id: resultado.documentoFiscal.id,
            tipo_evento: 'ENVIO_SIFEN',
            estado_anterior: 'PENDIENTE',
            estado_nuevo: sifenResult.estado,
            respuesta: { cdc: sifenResult.cdc, mensaje: sifenResult.mensaje } as Record<string, unknown>,
            mensaje: sifenResult.mensaje,
          },
        });

        // Actualizar CDC en la factura legacy
        if (sifenResult.cdc) {
          await prisma.factura.update({
            where: { id: resultado.factura.id },
            data: { cdc: sifenResult.cdc },
          });
        }

        logger.info('Factura enviada a SIFEN', {
          documentoFiscalId: resultado.documentoFiscal.id,
          estado: sifenResult.estado,
        });
      } catch (sifenError) {
        logger.error('Error al enviar factura a SIFEN', {
          documentoFiscalId: resultado.documentoFiscal.id,
          error: String(sifenError),
        });
        // No lanzar error — la factura ya fue creada localmente
      }
    }

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'FACTURAS',
      accion: 'EMITIR',
      registroId: resultado.factura.id,
      valorNuevo: {
        venta_id,
        numero: resultado.documentoFiscal.numero_formateado,
        tipo_documento,
        documento_fiscal_id: resultado.documentoFiscal.id,
        sifen_habilitado: sifenHabilitado,
      },
      ip: req.ip,
    });

    // Recargar con relaciones completas
    const facturaCompleta = await prisma.factura.findUnique({
      where: { id: resultado.factura.id },
      include: {
        cliente: true,
        venta: { include: { items: { include: { producto: true } } } },
      },
    });

    const documentoFiscalCompleto = await prisma.documentoFiscal.findUnique({
      where: { id: resultado.documentoFiscal.id },
      include: { eventos: { orderBy: { creado_en: 'asc' } } },
    });

    res.status(201).json({
      success: true,
      message: 'Factura emitida correctamente',
      data: { ...facturaCompleta, documento_fiscal: documentoFiscalCompleto },
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /facturas/:id/pdf
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/:id/pdf',
  requirePermiso('FACTURAS:VER'),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError(400, 'ID de factura inválido');

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

    if (!factura) throw new AppError(404, 'Factura no encontrada');

    // Leer configuración fiscal para el PDF
    const [configRazonSocial, configRuc, configDireccion, configTimbrado, configEstablecimiento, configPunto] =
      await Promise.all([
        prisma.configuracion.findUnique({ where: { clave: 'RAZON_SOCIAL' } }),
        prisma.configuracion.findUnique({ where: { clave: 'RUC_EMISOR' } }),
        prisma.configuracion.findUnique({ where: { clave: 'DIRECCION_FISCAL' } }),
        prisma.configuracion.findUnique({ where: { clave: 'TIMBRADO_NUMERO' } })
          .then(async (r: { valor: string } | null) => r ?? prisma.configuracion.findUnique({ where: { clave: 'TIMBRADO' } })),
        prisma.configuracion.findUnique({ where: { clave: 'ESTABLECIMIENTO' } })
          .then(async (r: { valor: string } | null) => r ?? prisma.configuracion.findUnique({ where: { clave: 'FACTURA_ESTABLECIMIENTO' } })),
        prisma.configuracion.findUnique({ where: { clave: 'PUNTO_EXPEDICION' } })
          .then(async (r: { valor: string } | null) => r ?? prisma.configuracion.findUnique({ where: { clave: 'FACTURA_PUNTO_EXPEDICION' } })),
      ]);

    const items = factura.venta.items.map((item: {
      descripcion: string;
      cantidad: unknown;
      precio_unitario: bigint;
      iva_porcentaje: unknown;
      subtotal: bigint;
    }) => ({
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
        razon_social: configRazonSocial?.valor ?? 'COMEDOR',
        ruc: configRuc?.valor ?? '-',
        direccion: configDireccion?.valor ?? '-',
        timbrado: configTimbrado?.valor ?? '-',
        establecimiento: configEstablecimiento?.valor ?? '001',
        punto_expedicion: configPunto?.valor ?? '001',
      },
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="factura-${factura.numero}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /facturas/:id/anular
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:id/anular',
  requirePermiso('FACTURAS:ANULAR'),
  [
    body('motivo').trim().notEmpty().withMessage('El motivo de anulación es requerido'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError(400, 'ID de factura inválido');

    const { motivo } = req.body as { motivo: string };

    const factura = await prisma.factura.findUnique({
      where: { id },
      include: { venta: { select: { id: true } } },
    });

    if (!factura) throw new AppError(404, 'Factura no encontrada');
    if (factura.estado === 'ANULADA') throw new AppError(400, 'La factura ya está anulada');
    if (factura.tipo_documento === 'NOTA_CREDITO')
      throw new AppError(400, 'No se puede anular una nota de crédito');

    // Cargar DocumentoFiscal vinculado
    const documentoFiscal = factura.venta_id
      ? await prisma.documentoFiscal.findUnique({ where: { venta_id: factura.venta_id } })
      : null;

    // ── Si SIFEN habilitado, cancelar en SIFEN primero ────────────────────────
    if (documentoFiscal?.cdc && documentoFiscal.estado_sifen === 'APROBADO') {
      const sifenConfig = await prisma.configuracion.findUnique({
        where: { clave: 'SIFEN_HABILITADO' },
      });
      if (sifenConfig?.valor === 'true') {
        try {
          const sifen = new SifenProvider(true);
          await sifen.cancelarFactura(documentoFiscal.cdc);
          logger.info('Factura cancelada en SIFEN', { cdc: documentoFiscal.cdc });
        } catch (sifenError) {
          logger.error('Error al cancelar en SIFEN', {
            cdc: documentoFiscal.cdc,
            error: String(sifenError),
          });
          throw new AppError(
            502,
            `Error al comunicarse con SIFEN: ${String(sifenError)}`,
            'SIFEN_ERROR'
          );
        }
      }
    }

    // ── Transacción de anulación ──────────────────────────────────────────────
    await prisma.$transaction(async (tx: PrismaTx) => {
      // Anular factura legacy
      await tx.factura.update({
        where: { id },
        data: { estado: 'ANULADA' },
      });

      // Anular DocumentoFiscal si existe
      if (documentoFiscal) {
        await tx.documentoFiscal.update({
          where: { id: documentoFiscal.id },
          data: {
            estado: 'ANULADA',
            estado_sifen: documentoFiscal.estado_sifen === 'APROBADO' ? 'APROBADO' : documentoFiscal.estado_sifen,
            motivo_anulacion: motivo,
          },
        });

        await tx.documentoFiscalEvento.create({
          data: {
            documento_fiscal_id: documentoFiscal.id,
            tipo_evento: 'ANULACION',
            estado_anterior: documentoFiscal.estado,
            estado_nuevo: 'ANULADA',
            payload: { motivo } as Record<string, unknown>,
            mensaje: motivo,
          },
        });
      }
    });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'FACTURAS',
      accion: 'ANULAR',
      registroId: id,
      valorAnterior: { estado: factura.estado },
      valorNuevo: { estado: 'ANULADA', motivo, documento_fiscal_id: documentoFiscal?.id },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Factura anulada correctamente',
      data: { factura_id: id, estado: 'ANULADA', motivo },
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /facturas/:id/reenviar-sifen
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:id/reenviar-sifen',
  requirePermiso('FACTURAS:EDITAR'),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError(400, 'ID de factura inválido');

    const factura = await prisma.factura.findUnique({ where: { id } });
    if (!factura) throw new AppError(404, 'Factura no encontrada');
    if (factura.estado === 'ANULADA') throw new AppError(400, 'No se puede reenviar una factura anulada');

    if (!factura.venta_id) throw new AppError(400, 'La factura no tiene venta asociada');

    const documentoFiscal = await prisma.documentoFiscal.findUnique({
      where: { venta_id: factura.venta_id },
    });

    if (!documentoFiscal) {
      throw new AppError(
        404,
        'No existe DocumentoFiscal para esta factura. Emita nuevamente.',
        'DOC_FISCAL_NO_ENCONTRADO'
      );
    }

    if (documentoFiscal.estado_sifen === 'APROBADO') {
      throw new AppError(400, 'El documento ya fue aprobado por SIFEN', 'YA_APROBADO');
    }

    const sifenConfig = await prisma.configuracion.findUnique({
      where: { clave: 'SIFEN_HABILITADO' },
    });

    const sifen = new SifenProvider(sifenConfig?.valor === 'true');

    let sifenResult;
    try {
      sifenResult = await sifen.enviarFactura(documentoFiscal.id);
    } catch (sifenError) {
      logger.error('Error al reenviar a SIFEN', {
        documentoFiscalId: documentoFiscal.id,
        error: String(sifenError),
      });
      throw new AppError(502, `Error SIFEN: ${String(sifenError)}`, 'SIFEN_ERROR');
    }

    await prisma.documentoFiscal.update({
      where: { id: documentoFiscal.id },
      data: {
        cdc: sifenResult.cdc,
        kude_url: sifenResult.kude_url ?? null,
        xml: sifenResult.xml ?? null,
        estado_sifen: sifenResult.estado,
        estado: sifenResult.estado === 'APROBADO' ? 'EMITIDA' : 'ERROR_SIFEN',
      },
    });

    await prisma.documentoFiscalEvento.create({
      data: {
        documento_fiscal_id: documentoFiscal.id,
        tipo_evento: 'REENVIO_SIFEN',
        estado_anterior: documentoFiscal.estado_sifen ?? 'PENDIENTE',
        estado_nuevo: sifenResult.estado,
        respuesta: { cdc: sifenResult.cdc, mensaje: sifenResult.mensaje } as Record<string, unknown>,
        mensaje: sifenResult.mensaje,
      },
    });

    if (sifenResult.cdc) {
      await prisma.factura.update({
        where: { id },
        data: { cdc: sifenResult.cdc },
      });
    }

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'FACTURAS',
      accion: 'REENVIAR_SIFEN',
      registroId: id,
      valorNuevo: {
        documento_fiscal_id: documentoFiscal.id,
        estado_sifen: sifenResult.estado,
        cdc: sifenResult.cdc,
        modo_simulacion: sifen.esModoSimulacion,
      },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: sifen.esModoSimulacion
        ? 'Reenvío simulado a SIFEN (modo prueba)'
        : 'Factura reenviada a SIFEN',
      data: {
        factura_id: id,
        documento_fiscal_id: documentoFiscal.id,
        estado_sifen: sifenResult.estado,
        cdc: sifenResult.cdc,
        kude_url: sifenResult.kude_url,
        modo_simulacion: sifen.esModoSimulacion,
      },
    });
  }
);

export default router;
