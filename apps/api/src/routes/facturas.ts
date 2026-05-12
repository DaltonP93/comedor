import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { registrarAuditoria } from '../lib/audit';

const router = Router();
router.use(authenticate);

// GET /facturas
router.get('/', requirePermiso('VENTAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { fecha_desde, fecha_hasta, estado, cliente_id, tipo_documento } = req.query;
    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (cliente_id) where.cliente_id = parseInt(String(cliente_id));
    if (tipo_documento) where.tipo_documento = tipo_documento;
    if (fecha_desde || fecha_hasta) {
      where.fecha = {};
      if (fecha_desde) (where.fecha as Record<string, Date>).gte = new Date(String(fecha_desde));
      if (fecha_hasta) (where.fecha as Record<string, Date>).lte = new Date(String(fecha_hasta));
    }

    const facturas = await prisma.factura.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true, ruc: true, razon_social: true } },
        venta: { select: { id: true, tipo_venta: true, total: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    res.json({ success: true, data: facturas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al listar facturas' });
  }
});

// GET /facturas/:id
router.get('/:id', requirePermiso('VENTAS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const factura = await prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        venta: {
          include: {
            items: { include: { producto: true, concepto: true } },
            pagos: true,
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

// POST /facturas (emit invoice for a sale)
router.post('/', requirePermiso('VENTAS:CREAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { venta_id, tipo_documento = 'FACTURA' } = req.body;

    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(venta_id) },
      include: { cliente: true, factura: true },
    });

    if (!venta) {
      res.status(404).json({ success: false, message: 'Venta no encontrada' });
      return;
    }

    if (venta.factura) {
      res.status(400).json({ success: false, message: 'La venta ya tiene factura emitida' });
      return;
    }

    // Get next invoice number from config
    const configNumero = await prisma.configuracion.findUnique({ where: { clave: 'NUMERO_FACTURA_ACTUAL' } });
    let numero = configNumero?.valor || '0001-001-0000001';

    // Increment invoice number
    const parts = numero.split('-');
    const seq = parseInt(parts[2] || '1') + 1;
    const nextNumero = `${parts[0]}-${parts[1]}-${String(seq).padStart(7, '0')}`;

    const factura = await prisma.factura.create({
      data: {
        venta_id: venta.id,
        cliente_id: venta.cliente_id,
        tipo_documento,
        numero,
        subtotal: venta.subtotal,
        iva_total: venta.iva_total,
        total: venta.total,
        estado: 'VIGENTE',
      },
      include: { cliente: true, venta: true },
    });

    // Update invoice number
    await prisma.configuracion.update({
      where: { clave: 'NUMERO_FACTURA_ACTUAL' },
      data: { valor: nextNumero },
    });

    // Mark sale as invoiced
    await prisma.venta.update({
      where: { id: venta.id },
      data: { facturada: true },
    });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'FACTURAS',
      accion: 'CREAR',
      registroId: factura.id,
      valorNuevo: { numero, tipo_documento, total: Number(venta.total) },
      ip: req.ip,
    });

    res.status(201).json({ success: true, data: factura });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al crear factura' });
  }
});

// POST /facturas/:id/anular
router.post('/:id/anular', requirePermiso('VENTAS:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { motivo } = req.body;

    const factura = await prisma.factura.update({
      where: { id },
      data: { estado: 'ANULADA' },
    });

    await prisma.venta.update({
      where: { id: factura.venta_id },
      data: { facturada: false },
    });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'FACTURAS',
      accion: 'ANULAR',
      registroId: id,
      valorNuevo: { motivo },
      ip: req.ip,
    });

    res.json({ success: true, data: factura });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al anular factura' });
  }
});

export default router;
