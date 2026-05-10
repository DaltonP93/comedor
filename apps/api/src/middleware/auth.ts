import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../lib/jwt';
import { prisma } from '../lib/prisma';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { permisos: string[] };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Token no proporcionado' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Get user with permissions
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.userId, activo: true },
      include: {
        rol: {
          include: {
            permisos: {
              include: { permiso: true },
            },
          },
        },
      },
    });

    if (!usuario) {
      res.status(401).json({ success: false, message: 'Usuario no encontrado o inactivo' });
      return;
    }

    const permisos = usuario.rol.permisos.map((rp) => rp.permiso.codigo);

    req.user = {
      ...decoded,
      permisos,
    };

    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }
}

export function requirePermiso(permiso: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    if (!req.user.permisos.includes(permiso)) {
      res.status(403).json({ success: false, message: `Sin permiso: ${permiso}` });
      return;
    }

    next();
  };
}
