import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Solo se acepta un x-request-id entrante si tiene forma segura (evita inyección
// en logs y confusión de correlación). En cualquier otro caso se genera uno nuevo.
const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

export function requestId(req: Request, res: Response, next: NextFunction) {
  const entrante = req.headers['x-request-id'];
  const id = typeof entrante === 'string' && SAFE_ID.test(entrante) ? entrante : randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
}
