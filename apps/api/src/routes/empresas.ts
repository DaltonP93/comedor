import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { registrarAuditoria } from '../lib/audit';

const router = Router();
router.use(authenticate);

// GET /empresas
router.get('/', requirePermiso('CLIENTES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { activo, search } = req.query;
    const where: Record<string, unknown> = {};
    if (activo !== undefined) where.activo = activo === 'true';
    if (search) {
      where.OR = [
        { nombre: { contains: String(search), mode: 'insensitive' } },
        { ruc: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const empresas = await prisma.empresa.findMany({
      where,
      include: {
        _count: { select: { clientes: true, libretas: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    res.json({ success: true, data: empresas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al listar empresas' });
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
          include: { cliente: { select: { id: true, nombre: true, documento_numero: true, telefono: true } } },
        },
        libretas: {
          include: { cliente: { select: { id: true, nombre: true } } },
        },
      },
    });

    if (!empresa) {
      res.status(404).json({ success: false, message: 'Empresa no encontrada' });
      return;
    }

    res.json({ success: true, data: empresa });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener empresa' });
  }
});

// POST /empresas
router.post('/', requirePermiso('CLIENTES:CREAR'), async (req: Request, res: Response): Promise<void> => {
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
      valorNuevo: { nombre, ruc },
      ip: req.ip,
    });

    res.status(201).json({ success: true, data: empresa });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al crear empresa' });
  }
});

// PUT /empresas/:id
router.put('/:id', requirePermiso('CLIENTES:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { nombre, ruc, telefono, email, direccion, activo } = req.body;

    const empresa = await prisma.empresa.update({
      where: { id },
      data: { nombre, ruc, telefono, email, direccion, activo },
    });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'EMPRESAS',
      accion: 'EDITAR',
      registroId: empresa.id,
      ip: req.ip,
    });

    res.json({ success: true, data: empresa });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar empresa' });
  }
});

// DELETE /empresas/:id
router.delete('/:id', requirePermiso('CLIENTES:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.empresa.update({ where: { id }, data: { activo: false } });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'EMPRESAS',
      accion: 'ELIMINAR',
      registroId: id,
      ip: req.ip,
    });

    res.json({ success: true, message: 'Empresa desactivada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al eliminar empresa' });
  }
});

export default router;
