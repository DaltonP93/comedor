import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';
import { logger } from '../lib/logger';

const router = Router();
router.use(authenticate);

// GET /empresas
router.get('/', requirePermiso('CLIENTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { buscar, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { activo: true };
    if (buscar) {
      where.OR = [
        { nombre: { contains: String(buscar), mode: 'insensitive' } },
        { ruc: { contains: String(buscar), mode: 'insensitive' } },
      ];
    }

    const [empresas, total] = await Promise.all([
      prisma.empresa.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { nombre: 'asc' },
        include: {
          _count: {
            select: { clientes: true },
          },
          libretas: {
            where: { estado: 'ACTIVA' },
            select: { id: true },
          },
        },
      }),
      prisma.empresa.count({ where }),
    ]);

    const data = empresas.map((e) => ({
      ...e,
      total_clientes: e._count.clientes,
      total_libretas_activas: e.libretas.length,
    }));

    res.json({
      success: true,
      data,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener empresas' });
  }
});

// GET /empresas/:id
router.get('/:id', requirePermiso('CLIENTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const empresa = await prisma.empresa.findUnique({
      where: { id },
      include: {
        clientes: {
          include: {
            cliente: {
              select: {
                id: true,
                nombre: true,
                telefono: true,
                email: true,
                estado: true,
                documento_numero: true,
              },
            },
          },
        },
        libretas: {
          include: {
            cliente: {
              select: { id: true, nombre: true },
            },
          },
          orderBy: { creado_en: 'desc' },
        },
      },
    });

    if (!empresa || !empresa.activo) {
      res.status(404).json({ success: false, message: 'Empresa no encontrada' });
      return;
    }

    res.json({ success: true, data: empresa });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener empresa' });
  }
});

// POST /empresas
router.post(
  '/',
  requirePermiso('CLIENTES:CREAR'),
  [
    body('nombre').notEmpty().withMessage('Nombre requerido'),
    body('email').optional({ nullable: true }).isEmail().withMessage('Email inválido'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { nombre, ruc, telefono, email, direccion } = req.body;

      const empresa = await prisma.empresa.create({
        data: { nombre, ruc, telefono, email, direccion },
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'EMPRESAS',
        accion: 'CREAR',
        registroId: empresa.id,
        valorNuevo: { nombre, ruc, telefono, email, direccion },
        ip: req.ip,
      });

      res.status(201).json({ success: true, message: 'Empresa creada', data: empresa });
    } catch (error) {
      logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al crear empresa' });
    }
  }
);

// PUT /empresas/:id
router.put(
  '/:id',
  requirePermiso('CLIENTES:EDITAR'),
  [
    body('nombre').optional().notEmpty().withMessage('Nombre no puede estar vacío'),
    body('email').optional({ nullable: true }).isEmail().withMessage('Email inválido'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const anterior = await prisma.empresa.findUnique({ where: { id } });

      if (!anterior || !anterior.activo) {
        res.status(404).json({ success: false, message: 'Empresa no encontrada' });
        return;
      }

      const { nombre, ruc, telefono, email, direccion } = req.body;
      const empresa = await prisma.empresa.update({
        where: { id },
        data: { nombre, ruc, telefono, email, direccion },
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'EMPRESAS',
        accion: 'EDITAR',
        registroId: id,
        valorAnterior: anterior as unknown as Record<string, unknown>,
        valorNuevo: req.body,
        ip: req.ip,
      });

      res.json({ success: true, message: 'Empresa actualizada', data: empresa });
    } catch (error) {
      logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al actualizar empresa' });
    }
  }
);

// DELETE /empresas/:id
router.delete('/:id', requirePermiso('CLIENTES:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const empresa = await prisma.empresa.findUnique({ where: { id } });

    if (!empresa || !empresa.activo) {
      res.status(404).json({ success: false, message: 'Empresa no encontrada' });
      return;
    }

    const libretasActivas = await prisma.libreta.count({
      where: { empresa_id: id, estado: 'ACTIVA' },
    });

    if (libretasActivas > 0) {
      res.status(400).json({
        success: false,
        message: `No se puede eliminar la empresa porque tiene ${libretasActivas} libreta(s) activa(s)`,
      });
      return;
    }

    await prisma.empresa.update({ where: { id }, data: { activo: false } });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'EMPRESAS',
      accion: 'ELIMINAR',
      registroId: id,
      valorAnterior: empresa as unknown as Record<string, unknown>,
      ip: req.ip,
    });

    res.json({ success: true, message: 'Empresa eliminada' });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al eliminar empresa' });
  }
});

export default router;
