import 'dotenv/config';

// BigInt JSON serialization support
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redisClient } from './lib/redis';

import authRouter from './routes/auth';
import clientesRouter from './routes/clientes';
import productosRouter from './routes/productos';
import categoriasRouter from './routes/categorias';
import conceptosRouter from './routes/conceptos';
import menusRouter from './routes/menus';
import reservasRouter from './routes/reservas';
import ventasRouter from './routes/ventas';
import libretasRouter from './routes/libretas';
import stockRouter from './routes/stock';
import comprasRouter from './routes/compras';
import proveedoresRouter from './routes/proveedores';
import usuariosRouter from './routes/usuarios';
import rolesRouter from './routes/roles';
import sucursalesRouter from './routes/sucursales';
import cajasRouter from './routes/cajas';
import reportesRouter from './routes/reportes';
import configuracionesRouter from './routes/configuraciones';
import auditoriaRouter from './routes/auditoria';
import recetasRouter from './routes/recetas';
import empresasRouter from './routes/empresas';
import notificacionesRouter from './routes/notificaciones';
import pagosRouter from './routes/pagos';
import facturasRouter from './routes/facturas';
import cajaRouter from './routes/caja';
import portalRouter from './routes/portal';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(requestId);

function corsOrigin(): string | string[] {
  const raw = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length <= 1 ? parts[0] || 'http://localhost:3000' : parts;
}

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin: corsOrigin(),
    credentials: true,
  })
);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Health check DB
app.get('/health/db', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// Health check Redis
app.get('/health/redis', async (_req: Request, res: Response) => {
  try {
    await redisClient.ping?.() ?? redisClient.set('health', '1');
    res.json({ status: 'ok', redis: 'connected' });
  } catch {
    res.status(503).json({ status: 'ok', redis: 'unavailable (not critical)' });
  }
});

// Health check completo
app.get('/health/full', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};
  try { await prisma.$queryRaw`SELECT 1`; checks.database = 'ok'; } catch { checks.database = 'error'; }
  try { await redisClient.set('health_check', '1'); checks.redis = 'ok'; } catch { checks.redis = 'unavailable'; }
  const allOk = checks.database === 'ok';
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() });
});

// Serve static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/productos', productosRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/conceptos', conceptosRouter);
app.use('/api/menus', menusRouter);
app.use('/api/reservas', reservasRouter);
app.use('/api/ventas', ventasRouter);
app.use('/api/libretas', libretasRouter);
app.use('/api/stock', stockRouter);
app.use('/api/compras', comprasRouter);
app.use('/api/proveedores', proveedoresRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/sucursales', sucursalesRouter);
app.use('/api/cajas', cajasRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/configuraciones', configuracionesRouter);
app.use('/api/auditoria', auditoriaRouter);
app.use('/api/recetas', recetasRouter);
app.use('/api/empresas', empresasRouter);
app.use('/api/notificaciones', notificacionesRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/facturas', facturasRouter);
app.use('/api/caja', cajaRouter);
app.use('/api/portal', portalRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API corriendo en http://localhost:${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

export default app;
