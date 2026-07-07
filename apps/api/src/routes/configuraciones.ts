import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermiso } from '../middleware/auth';
import { logger } from '../lib/logger';

const router = Router();
router.use(authenticate);

// Claves editables por esta vía. Las de numeración fiscal y credenciales de
// pasarelas se gestionan por procesos internos y NO deben editarse por API.
const CLAVES_EDITABLES = new Set<string>([
  'NOMBRE_COMERCIO',
  'RUC_COMERCIO',
  'DIRECCION_COMERCIO',
  'TELEFONO_COMERCIO',
  'EMAIL_COMERCIO',
  'MONEDA',
  'IVA_INCLUIDO',
  'DIAS_VENCIMIENTO_LIBRETA',
  'LIMITE_CREDITO_DEFAULT',
  'ESTABLECIMIENTO',
  'PUNTO_EXPEDICION',
  'TIMBRADO',
]);

const CLAVES_PROTEGIDAS = new Set<string>([
  'FACTURA_ULTIMO_NUMERO',
  'SIFEN_HABILITADO',
]);

router.get('/', requirePermiso('CONFIGURACION:VER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const configuraciones = await prisma.configuracion.findMany({ orderBy: { clave: 'asc' } });
    // Convert to key-value map
    const configMap = configuraciones.reduce(
      (acc, c) => ({ ...acc, [c.clave]: { valor: c.valor, descripcion: c.descripcion, id: c.id } }),
      {} as Record<string, { valor: string; descripcion: string | null; id: number }>
    );
    res.json({ success: true, data: configMap, list: configuraciones });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al obtener configuraciones' });
  }
});

router.put('/:clave', requirePermiso('CONFIGURACION:EDITAR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { clave } = req.params;
    const { valor, descripcion } = req.body;

    if (CLAVES_PROTEGIDAS.has(clave)) {
      res.status(403).json({ success: false, message: `La clave ${clave} no puede editarse por esta vía (gestión interna).` });
      return;
    }
    if (!CLAVES_EDITABLES.has(clave)) {
      res.status(400).json({ success: false, message: `Clave de configuración no permitida: ${clave}` });
      return;
    }
    if (typeof valor !== 'string') {
      res.status(400).json({ success: false, message: 'El valor debe ser una cadena de texto' });
      return;
    }

    const config = await prisma.configuracion.upsert({
      where: { clave },
      update: { valor, ...(descripcion && { descripcion }) },
      create: { clave, valor, descripcion },
    });

    res.json({ success: true, message: 'Configuración actualizada', data: config });
  } catch (error) {
    logger.error('Error en ruta', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, message: 'Error al actualizar configuración' });
  }
});

export default router;
