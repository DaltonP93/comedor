import { Request, Response, NextFunction } from 'express';

// Almacén en memoria como fallback si Redis no está disponible
const memoryStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimitMiddleware(options: {
  keyPrefix: string;
  windowSeconds?: number;
  maxAttempts?: number;
  message?: string;
}) {
  const {
    keyPrefix,
    windowSeconds = 900,
    maxAttempts = 5,
    message = 'Demasiados intentos. Intente más tarde.',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    try {
      // Intentar con Redis primero
      const { getRedisClient } = await import('../lib/redis');
      const redis = await getRedisClient();
      const multi = redis.multi();
      multi.incr(key);
      multi.expire(key, windowSeconds);
      const results = await multi.exec();
      const count = results?.[0] as number;

      if (count > maxAttempts) {
        res.status(429).json({ success: false, message });
        return;
      }
      next();
    } catch {
      // Fallback a memoria
      const entry = memoryStore.get(key);
      if (!entry || now > entry.resetAt) {
        memoryStore.set(key, { count: 1, resetAt: now + windowMs });
        next();
        return;
      }
      entry.count++;
      if (entry.count > maxAttempts) {
        res.status(429).json({ success: false, message });
        return;
      }
      next();
    }
  };
}
