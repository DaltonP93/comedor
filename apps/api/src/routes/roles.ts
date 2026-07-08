import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { logger } from '../lib/logger';

const router = Router();
router.use(authenticate);

router.get('/', requirePermiso('ROLES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const roles = await prisma.rol.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        permisos: { include: { permiso: true } },
        _count: { select: { usuarios: true } },
      },
    });
    res.json({ success: true, data: roles });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener roles' });
  }
});

router.get('/permisos', requirePermiso('ROLES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const permisos = await prisma.permiso.findMany({ orderBy: [{ modulo: 'asc' }, { codigo: 'asc' }] });
    res.json({ success: true, data: permisos });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener permisos' });
  }
});

router.get('/:id', requirePermiso('ROLES:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const rol = await prisma.rol.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { permisos: { include: { permiso: true } } },
    });
    if (!rol) {
      res.status(404).json({ success: false, message: 'Rol no encontrado' });
      return;
    }
    res.json({ success: true, data: rol });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener rol' });
  }
});

router.post(
  '/',
  requirePermiso('ROLES:CREAR'),
  [
    body('nombre').notEmpty().withMessage('Nombre requerido'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { nombre, descripcion, permisos = [] } = req.body;
      const rol = await prisma.rol.create({
        data: {
          nombre,
          descripcion,
          permisos: {
            create: (permisos as number[]).map((permisoId) => ({ permiso_id: permisoId })),
          },
        },
        include: { permisos: { include: { permiso: true } } },
      });
      res.status(201).json({ success: true, message: 'Rol creado', data: rol });
    } catch (error) {
      logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, message: 'Error al crear rol' });
    }
  }
);

router.put('/:id', requirePermiso('ROLES:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { nombre, descripcion, activo, permisos } = req.body;

    const rol = await prisma.$transaction(async (tx) => {
      if (permisos !== undefined) {
        await tx.rolPermiso.deleteMany({ where: { rol_id: id } });
        await tx.rolPermiso.createMany({
          data: (permisos as number[]).map((permisoId) => ({ rol_id: id, permiso_id: permisoId })),
        });
      }

      return tx.rol.update({
        where: { id },
        data: { nombre, descripcion, activo },
        include: { permisos: { include: { permiso: true } } },
      });
    });

    res.json({ success: true, message: 'Rol actualizado', data: rol });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al actualizar rol' });
  }
});

router.delete('/:id', requirePermiso('ROLES:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const usuariosConRol = await prisma.usuario.count({ where: { rol_id: id, activo: true } });
    if (usuariosConRol > 0) {
      res.status(400).json({ success: false, message: 'No se puede eliminar un rol con usuarios activos' });
      return;
    }
    await prisma.rol.update({ where: { id }, data: { activo: false } });
    res.json({ success: true, message: 'Rol desactivado' });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al eliminar rol' });
  }
});

export default router;
