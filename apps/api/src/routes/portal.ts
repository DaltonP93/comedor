import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { handleValidation } from '../middleware/validate';

const router = Router();
const PORTAL_JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

type PortalTokenPayload = {
  clienteId: number;
  tipo: 'CLIENTE';
};

type PortalRequest = Request & {
  cliente?: PortalTokenPayload;
};

function signClienteToken(clienteId: number): string {
  return jwt.sign({ clienteId, tipo: 'CLIENTE' }, PORTAL_JWT_SECRET, { expiresIn: '7d' });
}

function publicCliente(cliente: {
  id: number;
  nombre: string;
  tipo_cliente: string;
  razon_social: string | null;
  documento_tipo: string | null;
  documento_numero: string | null;
  ruc: string | null;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  direccion: string | null;
  canal_preferido: string | null;
  estado: string;
}) {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    tipo_cliente: cliente.tipo_cliente,
    razon_social: cliente.razon_social,
    documento_tipo: cliente.documento_tipo,
    documento_numero: cliente.documento_numero,
    ruc: cliente.ruc,
    telefono: cliente.telefono,
    whatsapp: cliente.whatsapp,
    email: cliente.email,
    direccion: cliente.direccion,
    canal_preferido: cliente.canal_preferido,
    estado: cliente.estado,
  };
}

function authenticateCliente(req: PortalRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ success: false, message: 'Sesion requerida' });
    return;
  }

  try {
    const decoded = jwt.verify(token, PORTAL_JWT_SECRET) as PortalTokenPayload;
    if (decoded.tipo !== 'CLIENTE' || !decoded.clienteId) {
      res.status(401).json({ success: false, message: 'Sesion invalida' });
      return;
    }
    req.cliente = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Sesion vencida o invalida' });
  }
}

async function getClienteOrFail(req: PortalRequest, res: Response) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: req.cliente!.clienteId },
  });

  if (!cliente || cliente.estado !== 'ACTIVO') {
    res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    return null;
  }

  return cliente;
}

router.post(
  '/auth/register',
  [
    body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
    body('telefono').trim().notEmpty().withMessage('Telefono requerido'),
    body('password').isLength({ min: 6 }).withMessage('La contrasena debe tener al menos 6 caracteres'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { nombre, telefono, email, password } = req.body;
      const passwordHash = await bcrypt.hash(password, 10);
      const existing = await prisma.cliente.findFirst({
        where: {
          OR: [{ telefono }, { whatsapp: telefono }, ...(email ? [{ email }] : [])],
        },
      });

      const cliente = existing
        ? await prisma.cliente.update({
            where: { id: existing.id },
            data: {
              nombre,
              telefono,
              whatsapp: telefono,
              email: email || existing.email,
              password_hash: passwordHash,
              estado: 'ACTIVO',
              canal_preferido: 'WHATSAPP',
            },
          })
        : await prisma.cliente.create({
            data: {
              nombre,
              telefono,
              whatsapp: telefono,
              email: email || undefined,
              password_hash: passwordHash,
              tipo_cliente: 'INDIVIDUAL',
              canal_preferido: 'WHATSAPP',
            },
          });

      const libreta = await prisma.libreta.findFirst({ where: { cliente_id: cliente.id, tipo: 'PERSONAL' } });
      if (!libreta) {
        await prisma.libreta.create({
          data: {
            cliente_id: cliente.id,
            tipo: 'PERSONAL',
            limite_credito: BigInt(500000),
            saldo_actual: BigInt(0),
            estado: 'ACTIVA',
          },
        });
      }

      res.status(201).json({
        success: true,
        message: 'Cuenta creada',
        data: { token: signClienteToken(cliente.id), cliente: publicCliente(cliente) },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear cuenta' });
    }
  }
);

router.post(
  '/auth/login',
  [
    body('identificador').trim().notEmpty().withMessage('Email o telefono requerido'),
    body('password').notEmpty().withMessage('Contrasena requerida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { identificador, password } = req.body;
      const cliente = await prisma.cliente.findFirst({
        where: {
          estado: 'ACTIVO',
          OR: [{ email: identificador }, { telefono: identificador }, { whatsapp: identificador }],
        },
      });

      if (!cliente || !cliente.password_hash) {
        res.status(401).json({ success: false, message: 'Credenciales invalidas' });
        return;
      }

      const ok = await bcrypt.compare(password, cliente.password_hash);
      if (!ok) {
        res.status(401).json({ success: false, message: 'Credenciales invalidas' });
        return;
      }

      res.json({
        success: true,
        message: 'Login exitoso',
        data: { token: signClienteToken(cliente.id), cliente: publicCliente(cliente) },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al iniciar sesion' });
    }
  }
);

router.get('/me', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const cliente = await getClienteOrFail(req, res);
    if (!cliente) return;
    res.json({ success: true, data: publicCliente(cliente) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener perfil' });
  }
});

router.put('/me', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const cliente = await getClienteOrFail(req, res);
    if (!cliente) return;

    const { nombre, email, telefono, direccion, documento_numero, ruc, password } = req.body;
    const updated = await prisma.cliente.update({
      where: { id: cliente.id },
      data: {
        nombre: nombre || cliente.nombre,
        email: email ?? cliente.email,
        telefono: telefono ?? cliente.telefono,
        whatsapp: telefono ?? cliente.whatsapp,
        direccion: direccion ?? cliente.direccion,
        documento_numero: documento_numero ?? cliente.documento_numero,
        ruc: ruc ?? cliente.ruc,
        password_hash: password ? await bcrypt.hash(password, 10) : cliente.password_hash,
      },
    });

    res.json({ success: true, message: 'Perfil actualizado', data: publicCliente(updated) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar perfil' });
  }
});

router.get('/menus', async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const menus = await prisma.menu.findMany({
      where: {
        estado: 'PUBLICADO',
        fecha: { gte: today },
      },
      orderBy: { fecha: 'asc' },
      take: 14,
      include: {
        sucursal: true,
        items: { include: { producto: true } },
      },
    });

    res.json({ success: true, data: menus });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener menus publicados' });
  }
});

router.get('/dashboard', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const cliente = await getClienteOrFail(req, res);
    if (!cliente) return;
    const clienteId = cliente.id;

    const [reservasPendientes, ventas, libretas, pagos] = await Promise.all([
      prisma.reserva.count({ where: { cliente_id: clienteId, estado: { in: ['PENDIENTE', 'CONFIRMADA', 'EN_COCINA', 'PREPARADA'] } } }),
      prisma.venta.findMany({
        where: { cliente_id: clienteId, estado: { not: 'ANULADA' } },
        orderBy: { creado_en: 'desc' },
        take: 5,
        include: { items: true, pagos: true },
      }),
      prisma.libreta.findMany({ where: { cliente_id: clienteId } }),
      prisma.pago.findMany({ where: { cliente_id: clienteId }, orderBy: { fecha_pago: 'desc' }, take: 5 }),
    ]);

    const totalCompras = ventas.reduce((sum, venta) => sum + Number(venta.total), 0);
    const saldoLibreta = libretas.reduce((sum, libreta) => sum + Number(libreta.saldo_actual), 0);

    res.json({
      success: true,
      data: {
        cliente: publicCliente(cliente),
        metricas: {
          reservasPendientes,
          comprasRecientes: ventas.length,
          totalCompras,
          saldoLibreta,
          pagosRecientes: pagos.length,
        },
        ventas,
        pagos,
        libretas,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener resumen' });
  }
});

router.get('/reservas/mias', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const reservas = await prisma.reserva.findMany({
      where: { cliente_id: req.cliente!.clienteId },
      orderBy: { creado_en: 'desc' },
      take: 50,
      include: {
        menu: { include: { sucursal: true, items: { include: { producto: true } } } },
        venta: true,
      },
    });
    res.json({ success: true, data: reservas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener reservas' });
  }
});

router.get('/reservas', async (req: Request, res: Response): Promise<void> => {
  try {
    const telefono = String(req.query.telefono || '').trim();

    if (!telefono) {
      res.status(400).json({ success: false, message: 'Telefono requerido' });
      return;
    }

    const reservas = await prisma.reserva.findMany({
      where: {
        cliente: { OR: [{ telefono }, { whatsapp: telefono }] },
      },
      orderBy: { creado_en: 'desc' },
      take: 20,
      include: {
        cliente: { select: { nombre: true, telefono: true, email: true } },
        menu: { include: { sucursal: true, items: { include: { producto: true } } } },
      },
    });

    res.json({ success: true, data: reservas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener reservas' });
  }
});

router.post(
  '/reservas',
  [
    body('menu_id').isInt({ min: 1 }).withMessage('Menu requerido'),
    body('cantidad').isInt({ min: 1, max: 20 }).withMessage('Cantidad invalida'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      let authClienteId: number | null = null;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(authHeader.slice(7), PORTAL_JWT_SECRET) as PortalTokenPayload;
          authClienteId = decoded.tipo === 'CLIENTE' ? decoded.clienteId : null;
        } catch {
          authClienteId = null;
        }
      }

      const { menu_id, nombre, telefono, email, cantidad, tipo_entrega, observacion } = req.body;
      const cantidadNum = Number(cantidad);

      const result = await prisma.$transaction(async (tx) => {
        const menu = await tx.menu.findFirst({
          where: { id: Number(menu_id), estado: 'PUBLICADO' },
        });

        if (!menu) throw new Error('MENU_NO_DISPONIBLE');
        if (menu.cupo_total !== null && menu.cupo_reservado + cantidadNum > menu.cupo_total) {
          throw new Error('CUPO_AGOTADO');
        }

        const cliente = authClienteId
          ? await tx.cliente.findUniqueOrThrow({ where: { id: authClienteId } })
          : await (async () => {
              if (!nombre || !telefono) throw new Error('DATOS_CLIENTE_REQUERIDOS');
              const existing = await tx.cliente.findFirst({ where: { OR: [{ telefono }, { whatsapp: telefono }] } });
              return existing
                ? tx.cliente.update({
                    where: { id: existing.id },
                    data: { nombre, telefono, whatsapp: telefono, email: email || undefined },
                  })
                : tx.cliente.create({
                    data: {
                      nombre,
                      telefono,
                      whatsapp: telefono,
                      email: email || undefined,
                      tipo_cliente: 'INDIVIDUAL',
                      canal_preferido: 'WHATSAPP',
                    },
                  });
            })();

        const reserva = await tx.reserva.create({
          data: {
            cliente_id: cliente.id,
            menu_id: menu.id,
            sucursal_id: menu.sucursal_id,
            cantidad: cantidadNum,
            tipo_entrega: tipo_entrega || 'LOCAL',
            observacion: observacion || undefined,
            forma_pago_prevista: 'EFECTIVO',
            total: BigInt(Number(menu.precio) * cantidadNum),
          },
          include: {
            menu: { include: { sucursal: true, items: { include: { producto: true } } } },
            cliente: true,
          },
        });

        await tx.menu.update({
          where: { id: menu.id },
          data: { cupo_reservado: { increment: cantidadNum } },
        });

        return reserva;
      });

      res.status(201).json({ success: true, message: 'Reserva registrada', data: result });
    } catch (error) {
      const message =
        error instanceof Error && error.message === 'CUPO_AGOTADO'
          ? 'No hay cupo disponible para esa cantidad'
          : error instanceof Error && error.message === 'MENU_NO_DISPONIBLE'
            ? 'Menu no disponible'
            : error instanceof Error && error.message === 'DATOS_CLIENTE_REQUERIDOS'
              ? 'Nombre y telefono requeridos'
              : 'Error al registrar reserva';
      const status = message === 'Error al registrar reserva' ? 500 : 400;
      if (status === 500) console.error(error);
      res.status(status).json({ success: false, message });
    }
  }
);

router.get('/ventas', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const ventas = await prisma.venta.findMany({
      where: { cliente_id: req.cliente!.clienteId, estado: { not: 'ANULADA' } },
      orderBy: { creado_en: 'desc' },
      take: 80,
      include: { items: true, pagos: true, factura: true },
    });
    res.json({ success: true, data: ventas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener compras' });
  }
});

router.get('/libretas', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const libretas = await prisma.libreta.findMany({
      where: { cliente_id: req.cliente!.clienteId },
      include: {
        empresa: true,
        movimientos: { orderBy: { fecha_movimiento: 'desc' }, take: 50, include: { venta: true, pago: true } },
        pagos: { orderBy: { fecha_pago: 'desc' }, take: 20 },
      },
    });
    res.json({ success: true, data: libretas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener libreta' });
  }
});

router.get('/pagos', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const pagos = await prisma.pago.findMany({
      where: { cliente_id: req.cliente!.clienteId },
      orderBy: { fecha_pago: 'desc' },
      take: 80,
      include: { venta: true, libreta: true },
    });

    const usados = Array.from(new Set(pagos.map((p) => p.forma_pago)));
    const disponibles = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'QR', 'LIBRETA'];

    res.json({ success: true, data: { disponibles, usados, pagos } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener pagos' });
  }
});

// ── Alias routes (frontend uses /portal/registro, /portal/perfil, etc.) ───────

router.post(
  '/registro',
  [
    body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
    body('telefono').trim().notEmpty().withMessage('Telefono requerido'),
    body('password').isLength({ min: 6 }).withMessage('La contrasena debe tener al menos 6 caracteres'),
    handleValidation,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { nombre, telefono, email, password } = req.body;
      const passwordHash = await bcrypt.hash(password, 10);
      const existing = await prisma.cliente.findFirst({
        where: {
          OR: [{ telefono }, { whatsapp: telefono }, ...(email ? [{ email }] : [])],
        },
      });

      const cliente = existing
        ? await prisma.cliente.update({
            where: { id: existing.id },
            data: { nombre, telefono, whatsapp: telefono, email: email || existing.email, password_hash: passwordHash, estado: 'ACTIVO', canal_preferido: 'WHATSAPP' },
          })
        : await prisma.cliente.create({
            data: { nombre, telefono, whatsapp: telefono, email: email || undefined, password_hash: passwordHash, tipo_cliente: 'INDIVIDUAL', canal_preferido: 'WHATSAPP' },
          });

      const libreta = await prisma.libreta.findFirst({ where: { cliente_id: cliente.id, tipo: 'PERSONAL' } });
      if (!libreta) {
        await prisma.libreta.create({
          data: { cliente_id: cliente.id, tipo: 'PERSONAL', limite_credito: BigInt(500000), saldo_actual: BigInt(0), estado: 'ACTIVA' },
        });
      }

      res.status(201).json({ success: true, message: 'Cuenta creada', data: { token: signClienteToken(cliente.id), cliente: publicCliente(cliente) } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al crear cuenta' });
    }
  }
);

router.get('/perfil', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const cliente = await getClienteOrFail(req, res);
    if (!cliente) return;
    res.json({ success: true, data: publicCliente(cliente) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener perfil' });
  }
});

router.put('/perfil', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const cliente = await getClienteOrFail(req, res);
    if (!cliente) return;

    const { nombre, email, telefono, direccion, documento_numero, ruc } = req.body;
    const updated = await prisma.cliente.update({
      where: { id: cliente.id },
      data: {
        nombre: nombre || cliente.nombre,
        email: email ?? cliente.email,
        telefono: telefono ?? cliente.telefono,
        whatsapp: telefono ?? cliente.whatsapp,
        direccion: direccion ?? cliente.direccion,
        documento_numero: documento_numero ?? cliente.documento_numero,
        ruc: ruc ?? cliente.ruc,
      },
    });

    res.json({ success: true, message: 'Perfil actualizado', data: publicCliente(updated) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar perfil' });
  }
});

router.put(
  '/password',
  authenticateCliente,
  [
    body('password_actual').notEmpty().withMessage('Contrasena actual requerida'),
    body('password_nueva').isLength({ min: 6 }).withMessage('Nueva contrasena debe tener al menos 6 caracteres'),
    handleValidation,
  ],
  async (req: PortalRequest, res: Response): Promise<void> => {
    try {
      const cliente = await getClienteOrFail(req, res);
      if (!cliente) return;

      const { password_actual, password_nueva } = req.body;
      if (!cliente.password_hash || !(await bcrypt.compare(password_actual, cliente.password_hash))) {
        res.status(401).json({ success: false, message: 'Contrasena actual incorrecta' });
        return;
      }

      await prisma.cliente.update({
        where: { id: cliente.id },
        data: { password_hash: await bcrypt.hash(password_nueva, 10) },
      });

      res.json({ success: true, message: 'Contrasena actualizada' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error al cambiar contrasena' });
    }
  }
);

router.post('/recuperar-password', async (req: Request, res: Response): Promise<void> => {
  // Placeholder: en producción enviar email con link de reset
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ success: false, message: 'Email requerido' });
    return;
  }
  // Siempre responder OK para no exponer si el email existe
  res.json({ success: true, message: 'Si existe una cuenta con ese email, recibirás instrucciones en breve' });
});

router.get('/facturas', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const facturas = await prisma.factura.findMany({
      where: { venta: { cliente_id: req.cliente!.clienteId } },
      orderBy: { fecha: 'desc' },
      take: 80,
      include: { venta: { select: { id: true, total: true, creado_en: true } } },
    });

    res.json({ success: true, data: facturas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener facturas' });
  }
});

router.get('/facturas/:id/pdf', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const facturaId = Number(req.params.id);
    const factura = await prisma.factura.findFirst({
      where: { id: facturaId, venta: { cliente_id: req.cliente!.clienteId } },
      include: {
        venta: { include: { items: { include: { producto: true } }, cliente: true } },
      },
    });

    if (!factura) {
      res.status(404).json({ success: false, message: 'Factura no encontrada' });
      return;
    }

    // Redirigir a la ruta existente de generación de PDF
    res.redirect(`/api/facturas/${facturaId}/pdf`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener factura' });
  }
});

router.get('/notificaciones', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const notificaciones = await prisma.notificacion.findMany({
      where: { cliente_id: req.cliente!.clienteId },
      orderBy: { creado_en: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: notificaciones });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener notificaciones' });
  }
});

router.get('/notificaciones/preferencias', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const clienteId = req.cliente!.clienteId;
    const consentimientos = await prisma.clienteConsentimiento.findMany({
      where: { cliente_id: clienteId },
    });

    const getAcepta = (canal: string) =>
      consentimientos.find((c) => c.canal === canal)?.aceptado ?? true;

    res.json({
      success: true,
      data: {
        canal_whatsapp: getAcepta('whatsapp'),
        canal_email: getAcepta('email'),
        canal_sms: consentimientos.find((c) => c.canal === 'sms')?.aceptado ?? false,
        tipo_menu_publicado: true,
        tipo_reserva_confirmada: true,
        tipo_libreta_vencida: true,
        tipo_pago_confirmado: true,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al obtener preferencias' });
  }
});

router.put('/notificaciones/preferencias', authenticateCliente, async (req: PortalRequest, res: Response): Promise<void> => {
  try {
    const clienteId = req.cliente!.clienteId;
    const { canal_whatsapp, canal_email, canal_sms } = req.body;
    const ip = req.ip || '0.0.0.0';

    // Borrar y recrear (schema no tiene unique en cliente_id, usa múltiples filas por canal)
    await prisma.clienteConsentimiento.deleteMany({ where: { cliente_id: clienteId } });
    await prisma.clienteConsentimiento.createMany({
      data: [
        { cliente_id: clienteId, tipo: 'MARKETING', canal: 'whatsapp', aceptado: canal_whatsapp ?? true, ip },
        { cliente_id: clienteId, tipo: 'MARKETING', canal: 'email', aceptado: canal_email ?? true, ip },
        { cliente_id: clienteId, tipo: 'MARKETING', canal: 'sms', aceptado: canal_sms ?? false, ip },
      ],
    });

    res.json({ success: true, message: 'Preferencias guardadas' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al guardar preferencias' });
  }
});

export default router;
