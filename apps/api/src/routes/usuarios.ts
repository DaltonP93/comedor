import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';

const router = Router();
router.use(authenticate);

router.get('/', requirePermiso('USUARIOS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { activo, rol_id, sucursal_id } = req.query;
    const where: Record<string, unknown> = {};
    if (activo !== undefined) where.activo = activo === 'true';
    if (rol_id) where.rol_id = parseInt(String(rol_id));
    if (sucursal_id) where.sucursal_id = parseInt(String(sucursal_id));

    const usuarios = await prisma.usuario.findMany({
      where,
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        activo: true,
        creado_en: true,
        actualizado_en: true,
        rol: true,
        sucursal: true,
      },
    });
    res.json({ success: true, data: usuarios });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener usuarios' });
  }
});

router.get('/:id', requirePermiso('USUARIOS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        activo: true,
        creado_en: true,
        actualizado_en: true,
        rol: { include: { permisos: { include: { permiso: true } } } },
        sucursal: true,
      },
    });
    if (!usuario) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }
    res.json({ success: true, data: usuario });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener usuario' });
  }
});

router.post(
  '/',
  requirePermiso('USUARIOS:CREAR'),
  [
    body('nombre').notEmpty().withMessage('Nombre requerido'),
    body('apellido').notEmpty().withMessage('Apellido requerido'),
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('Contraseña mínimo 6 caracteres'),
    body('rol_id').isInt().withMessage('Rol requerido'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { nombre, apellido, email, password, rol_id, sucursal_id } = req.body;

      const existe = await prisma.usuario.findUnique({ where: { email } });
      if (existe) {
        res.status(400).json({ success: false, message: 'El email ya está en uso' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const usuario = await prisma.usuario.create({
        data: {
          nombre,
          apellido,
          email,
          password_hash: passwordHash,
          rol_id,
          sucursal_id: sucursal_id || undefined,
        },
        select: { id: true, nombre: true, apellido: true, email: true, activo: true, rol: true, sucursal: true },
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'USUARIOS',
        accion: 'CREAR',
        registroId: usuario.id,
        ip: req.ip,
      });

      res.status(201).json({ success: true, message: 'Usuario creado', data: usuario });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear usuario' });
    }
  }
);

router.put('/:id', requirePermiso('USUARIOS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { password, ...rest } = req.body;

    const data: Record<string, unknown> = { ...rest };
    if (password) {
      data.password_hash = await bcrypt.hash(password, 10);
    }

    const usuario = await prisma.usuario.update({
      where: { id },
      data,
      select: { id: true, nombre: true, apellido: true, email: true, activo: true, rol: true, sucursal: true },
    });

    res.json({ success: true, message: 'Usuario actualizado', data: usuario });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
  }
});

router.delete('/:id', requirePermiso('USUARIOS:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user!.userId) {
      res.status(400).json({ success: false, message: 'No puedes eliminar tu propio usuario' });
      return;
    }
    await prisma.usuario.update({ where: { id }, data: { activo: false } });
    res.json({ success: true, message: 'Usuario desactivado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
  }
});

export default router;
