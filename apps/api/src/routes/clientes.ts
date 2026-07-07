import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

// GET /clientes
router.get('/', requirePermiso('CLIENTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { buscar, estado, tipo_cliente, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (tipo_cliente) where.tipo_cliente = tipo_cliente;
    if (buscar) {
      where.OR = [
        { nombre: { contains: String(buscar), mode: 'insensitive' } },
        { documento_numero: { contains: String(buscar), mode: 'insensitive' } },
        { ruc: { contains: String(buscar), mode: 'insensitive' } },
        { email: { contains: String(buscar), mode: 'insensitive' } },
        { telefono: { contains: String(buscar), mode: 'insensitive' } },
      ];
    }

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { nombre: 'asc' },
        include: {
          libretas: { select: { id: true, saldo_actual: true, estado: true } },
          _count: { select: { reservas: true, ventas: true } },
        },
      }),
      prisma.cliente.count({ where }),
    ]);

    res.json({
      success: true,
      data: clientes,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener clientes' });
  }
});

// GET /clientes/:id
router.get('/:id', requirePermiso('CLIENTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        empresas: { include: { empresa: true } },
        libretas: { include: { empresa: true } },
      },
    });

    if (!cliente) {
      res.status(404).json({ success: false, message: 'Cliente no encontrado' });
      return;
    }

    res.json({ success: true, data: cliente });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener cliente' });
  }
});

// GET /clientes/:id/estado-cuenta
router.get('/:id/estado-cuenta', requirePermiso('CLIENTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const clienteId = parseInt(req.params.id);
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      include: { libretas: true },
    });

    if (!cliente) {
      res.status(404).json({ success: false, message: 'Cliente no encontrado' });
      return;
    }

    const ventas = await prisma.venta.findMany({
      where: { cliente_id: clienteId, estado: { not: 'ANULADA' } },
      orderBy: { creado_en: 'desc' },
      take: 50,
      include: { items: true, pagos: true },
    });

    const movimientos = await prisma.libretaMovimiento.findMany({
      where: { libreta: { cliente_id: clienteId } },
      orderBy: { fecha_movimiento: 'desc' },
      take: 50,
      include: { venta: true },
    });

    res.json({
      success: true,
      data: { cliente, ventas, movimientos },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener estado de cuenta' });
  }
});

// GET /clientes/:id/reservas
router.get('/:id/reservas', requirePermiso('CLIENTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const clienteId = parseInt(req.params.id);
    const reservas = await prisma.reserva.findMany({
      where: { cliente_id: clienteId },
      orderBy: { creado_en: 'desc' },
      include: { menu: true, sucursal: true },
    });
    res.json({ success: true, data: reservas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener reservas' });
  }
});

// GET /clientes/:id/ventas
router.get('/:id/ventas', requirePermiso('CLIENTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const clienteId = parseInt(req.params.id);
    const ventas = await prisma.venta.findMany({
      where: { cliente_id: clienteId, estado: { not: 'ANULADA' } },
      orderBy: { creado_en: 'desc' },
      include: { items: true },
    });
    res.json({ success: true, data: ventas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener ventas' });
  }
});

// POST /clientes
router.post(
  '/',
  requirePermiso('CLIENTES:CREAR'),
  [
    body('nombre').notEmpty().withMessage('Nombre requerido'),
    body('tipo_cliente').isIn(['INDIVIDUAL', 'EMPRESA']).withMessage('Tipo inválido'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Allowlist explícita: evita inyección de password_hash, saldo u otros campos.
      const b = req.body;
      const data = {
        nombre: b.nombre,
        tipo_cliente: b.tipo_cliente,
        razon_social: b.razon_social ?? undefined,
        documento_tipo: b.documento_tipo ?? undefined,
        documento_numero: b.documento_numero ?? undefined,
        ruc: b.ruc ?? undefined,
        telefono: b.telefono ?? undefined,
        whatsapp: b.whatsapp ?? undefined,
        email: b.email ?? undefined,
        direccion: b.direccion ?? undefined,
        canal_preferido: b.canal_preferido ?? undefined,
        ...(b.password ? { password_hash: await bcrypt.hash(b.password, 10) } : {}),
      };
      const cliente = await prisma.cliente.create({ data });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'CLIENTES',
        accion: 'CREAR',
        registroId: cliente.id,
        valorNuevo: { ...data, password_hash: data.password_hash ? '***' : undefined },
        ip: req.ip,
      });

      res.status(201).json({ success: true, message: 'Cliente creado', data: cliente });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear cliente' });
    }
  }
);

// PUT /clientes/:id
router.put(
  '/:id',
  requirePermiso('CLIENTES:EDITAR'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const anterior = await prisma.cliente.findUnique({ where: { id } });

      if (!anterior) {
        res.status(404).json({ success: false, message: 'Cliente no encontrado' });
        return;
      }

      const { password, ...resto } = req.body;
      const data = { ...resto };
      if (password) {
        data.password_hash = await bcrypt.hash(password, 10);
      }

      const cliente = await prisma.cliente.update({ where: { id }, data });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'CLIENTES',
        accion: 'EDITAR',
        registroId: id,
        valorAnterior: anterior as unknown as Record<string, unknown>,
        valorNuevo: req.body,
        ip: req.ip,
      });

      res.json({ success: true, message: 'Cliente actualizado', data: cliente });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al actualizar cliente' });
    }
  }
);

// DELETE /clientes/:id
router.delete('/:id', requirePermiso('CLIENTES:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.cliente.update({ where: { id }, data: { estado: 'INACTIVO' } });
    res.json({ success: true, message: 'Cliente desactivado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al eliminar cliente' });
  }
});

export default router;
