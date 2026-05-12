import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'productos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({ storage });

const router = Router();
router.use(authenticate);

// GET /productos
router.get('/', requirePermiso('PRODUCTOS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { buscar, categoria_id, activo, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (activo !== undefined) where.activo = activo === 'true';
    if (categoria_id) where.categoria_id = parseInt(String(categoria_id));
    if (buscar) {
      where.OR = [
        { nombre: { contains: String(buscar), mode: 'insensitive' } },
        { codigo: { contains: String(buscar), mode: 'insensitive' } },
        { codigo_barra: { contains: String(buscar), mode: 'insensitive' } },
      ];
    }

    const [productos, total] = await Promise.all([
      prisma.producto.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { nombre: 'asc' },
        include: { categoria: true },
      }),
      prisma.producto.count({ where }),
    ]);

    // Calculate stock for each product
    const productosConStock = await Promise.all(
      productos.map(async (prod) => {
        const stockResult = await prisma.stockMovimiento.aggregate({
          where: { producto_id: prod.id },
          _sum: { cantidad: true },
        });
        const stockActual = Number(stockResult._sum.cantidad ?? 0);
        return { ...prod, stock_actual: stockActual };
      })
    );

    res.json({
      success: true,
      data: productosConStock,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener productos' });
  }
});

// GET /productos/:id
router.get('/:id', requirePermiso('PRODUCTOS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { categoria: true, recetas: { include: { items: { include: { insumo: true } } } } },
    });

    if (!producto) {
      res.status(404).json({ success: false, message: 'Producto no encontrado' });
      return;
    }

    const stockResult = await prisma.stockMovimiento.aggregate({
      where: { producto_id: producto.id },
      _sum: { cantidad: true },
    });
    const stockActual = Number(stockResult._sum.cantidad ?? 0);

    res.json({ success: true, data: { ...producto, stock_actual: stockActual } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener producto' });
  }
});

// POST /productos
router.post(
  '/',
  requirePermiso('PRODUCTOS:CREAR'),
  [
    body('nombre').notEmpty().withMessage('Nombre requerido'),
    body('precio_venta').isInt({ min: 0 }).withMessage('Precio inválido'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = {
        ...req.body,
        precio_venta: BigInt(req.body.precio_venta ?? 0),
        precio_por_kg: req.body.precio_por_kg ? BigInt(req.body.precio_por_kg) : undefined,
        costo_promedio: BigInt(req.body.costo_promedio ?? 0),
      };

      const producto = await prisma.producto.create({ data, include: { categoria: true } });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'PRODUCTOS',
        accion: 'CREAR',
        registroId: producto.id,
        ip: req.ip,
      });

      res.status(201).json({ success: true, message: 'Producto creado', data: producto });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear producto' });
    }
  }
);

// PUT /productos/:id
router.put('/:id', requirePermiso('PRODUCTOS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const data = {
      ...req.body,
      precio_venta: req.body.precio_venta !== undefined ? BigInt(req.body.precio_venta) : undefined,
      precio_por_kg: req.body.precio_por_kg ? BigInt(req.body.precio_por_kg) : undefined,
      costo_promedio: req.body.costo_promedio !== undefined ? BigInt(req.body.costo_promedio) : undefined,
    };

    const producto = await prisma.producto.update({ where: { id }, data, include: { categoria: true } });
    res.json({ success: true, message: 'Producto actualizado', data: producto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar producto' });
  }
});

// POST /productos/:id/imagen
router.post('/:id/imagen', requirePermiso('PRODUCTOS:EDITAR'), upload.single('imagen'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No se envió ninguna imagen' });
      return;
    }

    const imagen_url = `/uploads/productos/${req.file.filename}`;
    const producto = await prisma.producto.update({
      where: { id },
      data: { imagen_url },
    });

    res.json({ success: true, message: 'Imagen subida', data: producto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al subir imagen' });
  }
});

// DELETE /productos/:id
router.delete('/:id', requirePermiso('PRODUCTOS:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.producto.update({ where: { id }, data: { activo: false } });
    res.json({ success: true, message: 'Producto desactivado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al eliminar producto' });
  }
});

export default router;
