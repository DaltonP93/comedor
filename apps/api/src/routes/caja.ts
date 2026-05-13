import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// GET /caja/aperturas — listar aperturas
router.get('/aperturas', requirePermiso('CAJA:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { caja_id, estado, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;
    const where: Record<string, unknown> = {};
    if (caja_id) where.caja_id = parseInt(String(caja_id));
    if (estado) where.estado = estado;

    const [aperturas, total] = await Promise.all([
      prisma.cajaApertura.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { fecha_apertura: 'desc' },
        include: {
          caja: true,
          usuario: { select: { nombre: true, apellido: true } },
          sucursal: true,
        },
      }),
      prisma.cajaApertura.count({ where }),
    ]);

    res.json({
      success: true,
      data: aperturas,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener aperturas' });
  }
});

// POST /caja/:cajaId/abrir
router.post(
  '/:cajaId/abrir',
  requirePermiso('CAJA:ABRIR'),
  [body('monto_inicial').isNumeric().withMessage('Monto inicial requerido'), handleValidation],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const cajaId = parseInt(req.params.cajaId);
      const { monto_inicial = 0, observacion } = req.body;

      const caja = await prisma.caja.findUnique({ where: { id: cajaId } });
      if (!caja) {
        res.status(404).json({ success: false, message: 'Caja no encontrada' });
        return;
      }

      const abierta = await prisma.cajaApertura.findFirst({ where: { caja_id: cajaId, estado: 'ABIERTA' } });
      if (abierta) {
        res.status(400).json({ success: false, message: 'La caja ya está abierta' });
        return;
      }

      const apertura = await prisma.cajaApertura.create({
        data: {
          caja_id: cajaId,
          usuario_id: req.user!.userId,
          sucursal_id: caja.sucursal_id,
          monto_inicial: BigInt(monto_inicial),
          estado: 'ABIERTA',
          observacion,
        },
      });

      await prisma.caja.update({ where: { id: cajaId }, data: { estado: 'ABIERTA' } });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'CAJA',
        accion: 'ABRIR',
        registroId: apertura.id,
        ip: req.ip,
      });

      res.status(201).json({ success: true, message: 'Caja abierta', data: apertura });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al abrir caja' });
    }
  }
);

// POST /caja/aperturas/:id/cerrar
router.post(
  '/aperturas/:id/cerrar',
  requirePermiso('CAJA:CERRAR'),
  [body('monto_declarado').isNumeric().withMessage('Monto declarado requerido'), handleValidation],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const { monto_declarado, observacion } = req.body;

      const apertura = await prisma.cajaApertura.findUnique({
        where: { id },
        include: { caja: true },
      });
      if (!apertura) {
        res.status(404).json({ success: false, message: 'Apertura no encontrada' });
        return;
      }
      if (apertura.estado !== 'ABIERTA') {
        res.status(400).json({ success: false, message: 'La caja no está abierta' });
        return;
      }

      // Calcular total del sistema a partir de las ventas desde la apertura
      const ventas = await prisma.venta.findMany({
        where: {
          caja_id: apertura.caja_id,
          estado: 'COMPLETADA',
          creado_en: { gte: apertura.fecha_apertura },
        },
        include: { pagos: true },
      });

      const montoSistema = ventas.reduce(
        (sum, v) =>
          sum +
          v.pagos
            .filter((p) => p.estado === 'CONFIRMADO')
            .reduce((s, p) => s + Number(p.monto), 0),
        0
      );
      const montoDeclarado = Number(monto_declarado);
      const diferencia = montoDeclarado - montoSistema;

      const updated = await prisma.cajaApertura.update({
        where: { id },
        data: {
          estado: 'CERRADA',
          fecha_cierre: new Date(),
          usuario_cierre_id: req.user!.userId,
          monto_sistema: BigInt(Math.round(montoSistema)),
          monto_declarado: BigInt(montoDeclarado),
          diferencia: BigInt(Math.round(diferencia)),
          observacion: observacion || apertura.observacion,
        },
      });

      await prisma.caja.update({ where: { id: apertura.caja_id }, data: { estado: 'CERRADA' } });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'CAJA',
        accion: 'CERRAR',
        registroId: id,
        valorNuevo: { monto_sistema: montoSistema, monto_declarado: montoDeclarado, diferencia },
        ip: req.ip,
      });

      res.json({ success: true, message: 'Caja cerrada', data: updated });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al cerrar caja' });
    }
  }
);

// GET /caja/aperturas/:id/resumen
router.get('/aperturas/:id/resumen', requirePermiso('CAJA:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const apertura = await prisma.cajaApertura.findUnique({
      where: { id },
      include: {
        caja: true,
        usuario: { select: { nombre: true, apellido: true } },
      },
    });
    if (!apertura) {
      res.status(404).json({ success: false, message: 'Apertura no encontrada' });
      return;
    }

    const ventas = await prisma.venta.findMany({
      where: {
        caja_id: apertura.caja_id,
        estado: 'COMPLETADA',
        creado_en: {
          gte: apertura.fecha_apertura,
          ...(apertura.fecha_cierre ? { lte: apertura.fecha_cierre } : {}),
        },
      },
      include: { pagos: { where: { estado: 'CONFIRMADO' } } },
    });

    const resumenPorFormaPago: Record<string, number> = {};
    let totalVentas = 0;

    for (const venta of ventas) {
      for (const pago of venta.pagos) {
        resumenPorFormaPago[pago.forma_pago] = (resumenPorFormaPago[pago.forma_pago] || 0) + Number(pago.monto);
        totalVentas += Number(pago.monto);
      }
    }

    res.json({
      success: true,
      data: {
        apertura,
        ventas_count: ventas.length,
        total_ventas: totalVentas,
        resumen_por_forma_pago: resumenPorFormaPago,
        monto_inicial: Number(apertura.monto_inicial),
        monto_sistema: Number(apertura.monto_sistema),
        monto_declarado: Number(apertura.monto_declarado),
        diferencia: Number(apertura.diferencia),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener resumen de apertura' });
  }
});

// POST /caja/aperturas/:id/retiro
router.post(
  '/aperturas/:id/retiro',
  requirePermiso('CAJA:AJUSTAR'),
  [
    body('monto').isNumeric({ no_symbols: false }).withMessage('Monto requerido'),
    body('descripcion').notEmpty().withMessage('Descripción requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const { monto, descripcion } = req.body;

      const apertura = await prisma.cajaApertura.findUnique({ where: { id } });
      if (!apertura || apertura.estado !== 'ABIERTA') {
        res.status(400).json({ success: false, message: 'Apertura no válida' });
        return;
      }

      const mov = await prisma.cajaMovimiento.create({
        data: {
          apertura_id: id,
          tipo_movimiento: 'RETIRO',
          monto: BigInt(monto),
          descripcion,
          usuario_id: req.user!.userId,
        },
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'CAJA',
        accion: 'RETIRO',
        registroId: id,
        valorNuevo: { monto, descripcion },
        ip: req.ip,
      });

      res.status(201).json({ success: true, message: 'Retiro registrado', data: mov });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al registrar retiro' });
    }
  }
);

// GET /caja/:cajaId/estado
router.get('/:cajaId/estado', requirePermiso('CAJA:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const cajaId = parseInt(req.params.cajaId);

    const caja = await prisma.caja.findUnique({ where: { id: cajaId } });
    if (!caja) {
      res.status(404).json({ success: false, message: 'Caja no encontrada' });
      return;
    }

    const apertura = await prisma.cajaApertura.findFirst({
      where: { caja_id: cajaId, estado: 'ABIERTA' },
      orderBy: { fecha_apertura: 'desc' },
    });

    res.json({ success: true, data: { caja, apertura_activa: apertura } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener estado de caja' });
  }
});

export default router;
