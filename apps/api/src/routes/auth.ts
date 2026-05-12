import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { handleValidation } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { registrarAuditoria } from '../lib/audit';

const router = Router();

// Simple in-memory rate limiter: max 5 failed attempts per IP per 15 minutes
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

function resetRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

// POST /auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('Contraseña requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const ip = req.ip || 'unknown';
      if (!checkRateLimit(ip)) {
        res.status(429).json({ success: false, message: 'Demasiados intentos. Intente en 15 minutos.' });
        return;
      }

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

      resetRateLimit(ip);
      const token = generateToken(payload);
      const refreshToken = generateRefreshToken(payload);

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
      console.error(error);
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
    console.error(error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// POST /auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response): Promise<void> => {
  await registrarAuditoria({
    usuarioId: req.user!.userId,
    modulo: 'AUTH',
    accion: 'LOGOUT',
    ip: req.ip,
  });
  res.json({ success: true, message: 'Sesión cerrada' });
});

export default router;
