import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { handleValidation } from '../middleware/validate';
import { registrarAuditoria } from '../lib/audit';
import { clientePublicSelect } from '../lib/selects';

const router = Router();
router.use(authenticate);

// GET /menus
router.get('/', requirePermiso('MENUS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { fecha, estado, sucursal_id, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (sucursal_id) where.sucursal_id = parseInt(String(sucursal_id));
    if (fecha) {
      const fechaDate = new Date(String(fecha));
      const fechaFin = new Date(fechaDate);
      fechaFin.setDate(fechaFin.getDate() + 1);
      where.fecha = { gte: fechaDate, lt: fechaFin };
    }

    const [menus, total] = await Promise.all([
      prisma.menu.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { fecha: 'desc' },
        include: {
          items: { include: { producto: true } },
          sucursal: true,
          _count: { select: { reservas: true } },
        },
      }),
      prisma.menu.count({ where }),
    ]);

    res.json({
      success: true,
      data: menus,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener menús' });
  }
});

// GET /menus/:id
router.get('/:id', requirePermiso('MENUS:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const menu = await prisma.menu.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        items: { include: { producto: true } },
        sucursal: true,
        reservas: {
          include: { cliente: { select: clientePublicSelect } },
          orderBy: { creado_en: 'desc' },
        },
      },
    });

    if (!menu) {
      res.status(404).json({ success: false, message: 'Menú no encontrado' });
      return;
    }

    res.json({ success: true, data: menu });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener menú' });
  }
});

// POST /menus
router.post(
  '/',
  requirePermiso('MENUS:CREAR'),
  [
    body('fecha').isISO8601().withMessage('Fecha inválida'),
    body('titulo').notEmpty().withMessage('Título requerido'),
    body('sucursal_id').isInt().withMessage('Sucursal requerida'),
    body('precio').isInt({ min: 0 }).withMessage('Precio inválido'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { items, ...menuData } = req.body;

      const menu = await prisma.menu.create({
        data: {
          ...menuData,
          precio: BigInt(menuData.precio ?? 0),
          precio_convenio: menuData.precio_convenio ? BigInt(menuData.precio_convenio) : undefined,
          precio_libreta: menuData.precio_libreta ? BigInt(menuData.precio_libreta) : undefined,
          creado_por: req.user!.userId,
          items: items
            ? {
                create: items.map((item: { producto_id?: number; descripcion?: string; tipo?: string }) => ({
                  producto_id: item.producto_id,
                  descripcion: item.descripcion,
                  tipo: item.tipo || 'PRINCIPAL',
                })),
              }
            : undefined,
        },
        include: { items: { include: { producto: true } }, sucursal: true },
      });

      await registrarAuditoria({
        usuarioId: req.user!.userId,
        modulo: 'MENUS',
        accion: 'CREAR',
        registroId: menu.id,
        ip: req.ip,
      });

      res.status(201).json({ success: true, message: 'Menú creado', data: menu });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear menú' });
    }
  }
);

// PUT /menus/:id
router.put('/:id', requirePermiso('MENUS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { items, ...menuData } = req.body;

    const existing = await prisma.menu.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Menú no encontrado' });
      return;
    }
    if (existing.estado === 'PUBLICADO') {
      res.status(400).json({ success: false, message: 'No se puede editar un menú publicado' });
      return;
    }

    const data: Record<string, unknown> = { ...menuData };
    if (menuData.precio !== undefined) data.precio = BigInt(menuData.precio);
    if (menuData.precio_convenio !== undefined) data.precio_convenio = BigInt(menuData.precio_convenio);
    if (menuData.precio_libreta !== undefined) data.precio_libreta = BigInt(menuData.precio_libreta);

    // Update items if provided
    if (items) {
      await prisma.menuItem.deleteMany({ where: { menu_id: id } });
      await prisma.menuItem.createMany({
        data: items.map((item: { producto_id?: number; descripcion?: string; tipo?: string }) => ({
          menu_id: id,
          producto_id: item.producto_id,
          descripcion: item.descripcion,
          tipo: item.tipo || 'PRINCIPAL',
        })),
      });
    }

    const menu = await prisma.menu.update({
      where: { id },
      data,
      include: { items: { include: { producto: true } }, sucursal: true },
    });

    res.json({ success: true, message: 'Menú actualizado', data: menu });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar menú' });
  }
});

// POST /menus/:id/publicar
router.post('/:id/publicar', requirePermiso('MENUS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const menu = await prisma.menu.findUnique({ where: { id } });

    if (!menu) {
      res.status(404).json({ success: false, message: 'Menú no encontrado' });
      return;
    }
    if (menu.estado !== 'BORRADOR') {
      res.status(400).json({ success: false, message: 'Solo se pueden publicar menús en estado BORRADOR' });
      return;
    }

    const menuPublicado = await prisma.menu.update({
      where: { id },
      data: { estado: 'PUBLICADO', publicado_en: new Date() },
    });

    await registrarAuditoria({
      usuarioId: req.user!.userId,
      modulo: 'MENUS',
      accion: 'PUBLICAR',
      registroId: id,
      ip: req.ip,
    });

    res.json({ success: true, message: 'Menú publicado', data: menuPublicado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al publicar menú' });
  }
});

// POST /menus/:id/cerrar
router.post('/:id/cerrar', requirePermiso('MENUS:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const menu = await prisma.menu.findUnique({ where: { id } });

    if (!menu) {
      res.status(404).json({ success: false, message: 'Menú no encontrado' });
      return;
    }

    const menuCerrado = await prisma.menu.update({
      where: { id },
      data: { estado: 'CERRADO' },
    });

    res.json({ success: true, message: 'Menú cerrado', data: menuCerrado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al cerrar menú' });
  }
});

// DELETE /menus/:id
router.delete('/:id', requirePermiso('MENUS:ELIMINAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const menu = await prisma.menu.findUnique({ where: { id } });
    if (!menu) {
      res.status(404).json({ success: false, message: 'Menú no encontrado' });
      return;
    }
    if (menu.estado === 'PUBLICADO' && menu.cupo_reservado > 0) {
      res.status(400).json({ success: false, message: 'No se puede eliminar un menú con reservas' });
      return;
    }
    await prisma.menu.delete({ where: { id } });
    res.json({ success: true, message: 'Menú eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al eliminar menú' });
  }
});

export default router;
