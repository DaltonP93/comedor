import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { handleValidation } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { registrarAuditoria } from '../lib/audit';
import { logger } from '../lib/logger';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

const loginRateLimit = rateLimitMiddleware({
  keyPrefix: 'login',
  windowSeconds: 900,
  maxAttempts: 5,
  message: 'Demasiados intentos de login. Intente en 15 minutos.',
});

// POST /auth/login
router.post(
  '/login',
  loginRateLimit,
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('Contraseña requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      const usuario = await prisma.usuario.findUnique({
        where: { email, activo: true },
        include: {
          rol: true,
          sucursal: true,
        },
      });

      if (!usuario) {
        res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        return;
      }

      const passwordValido = await bcrypt.compare(password, usuario.password_hash);
      if (!passwordValido) {
        res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        return;
      }

      const payload = {
        userId: usuario.id,
        email: usuario.email,
        rolNombre: usuario.rol.nombre,
        sucursalId: usuario.sucursal_id,
      };

      const token = generateToken(payload);
      const refreshToken = generateRefreshToken(payload);

      const hash = createHash('sha256').update(refreshToken).digest('hex');
      await prisma.userSession.create({
        data: {
          usuario_id: usuario.id,
          refresh_token_hash: hash,
          ip: req.ip,
          user_agent: req.headers['user-agent'],
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await registrarAuditoria({
        usuarioId: usuario.id,
        modulo: 'AUTH',
        accion: 'LOGIN',
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Login exitoso',
        data: {
          token,
          refreshToken,
          usuario: {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            rol: usuario.rol.nombre,
            sucursal: usuario.sucursal ? { id: usuario.sucursal.id, nombre: usuario.sucursal.nombre } : null,
          },
        },
      });
    } catch (error) {
      logger.error('Error en login', { message: (error as Error).message });
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }
);

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, message: 'Refresh token requerido' });
      return;
    }

    const decoded = verifyRefreshToken(refreshToken);

    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const session = await prisma.userSession.findFirst({
      where: {
        refresh_token_hash: hash,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
    });

    if (!session) {
      res.status(401).json({ success: false, message: 'Sesión inválida o expirada' });
      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.userId, activo: true },
      include: { rol: true },
    });

    if (!usuario) {
      res.status(401).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    const payload = {
      userId: usuario.id,
      email: usuario.email,
      rolNombre: usuario.rol.nombre,
      sucursalId: usuario.sucursal_id,
    };

    const token = generateToken(payload);
    const newRefreshToken = generateRefreshToken(payload);
    const newHash = createHash('sha256').update(newRefreshToken).digest('hex');

    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        refresh_token_hash: newHash,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      success: true,
      data: { token, refreshToken: newRefreshToken },
    });
  } catch {
    res.status(401).json({ success: false, message: 'Refresh token inválido' });
  }
});

// GET /auth/me
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user!.userId },
      include: {
        rol: {
          include: {
            permisos: { include: { permiso: true } },
          },
        },
        sucursal: true,
      },
    });

    if (!usuario) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    const permisos = usuario.rol.permisos.map((rp) => rp.permiso.codigo);

    res.json({
      success: true,
      data: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol.nombre,
        permisos,
        sucursal: usuario.sucursal ? { id: usuario.sucursal.id, nombre: usuario.sucursal.nombre } : null,
      },
    });
  } catch (error) {
    logger.error('Error en /me', { message: (error as Error).message });
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// POST /auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    await prisma.userSession.updateMany({
      where: { refresh_token_hash: hash, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  } else {
    await prisma.userSession.updateMany({
      where: { usuario_id: req.user!.userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  await registrarAuditoria({
    usuarioId: req.user!.userId,
    modulo: 'AUTH',
    accion: 'LOGOUT',
    ip: req.ip,
  });
  res.json({ success: true, message: 'Sesión cerrada' });
});

export default router;
