import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

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

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API corriendo en http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;
