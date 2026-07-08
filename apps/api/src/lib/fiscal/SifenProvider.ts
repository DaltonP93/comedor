import { prisma } from '../prisma';
import { logger } from '../logger';

export interface SifenResult {
  /** Código de Control (44 dígitos) */
  cdc: string;
  /** URL del KUDE (representación visual del DE) */
  kude_url?: string;
  /** XML del Documento Electrónico */
  xml?: string;
  estado: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE';
  mensaje?: string;
}

export class SifenProvider {
  private habilitado: boolean;

  constructor(habilitado?: boolean) {
    // El caller puede inyectar el valor directamente (evita consulta asíncrona en constructor).
    // Si no se especifica, por defecto modo simulación.
    this.habilitado = habilitado ?? false;
  }

  /**
   * Carga la configuración SIFEN desde la tabla Configuracion.
   * Debe llamarse antes de usar enviarFactura / cancelarFactura si no se inyectó
   * el valor en el constructor.
   */
  static async crear(): Promise<SifenProvider> {
    try {
      const config = await prisma.configuracion.findUnique({
        where: { clave: 'SIFEN_HABILITADO' },
      });
      const habilitado = config?.valor === 'true';
      logger.info('SifenProvider creado', { habilitado });
      return new SifenProvider(habilitado);
    } catch (err) {
      logger.warn('No se pudo leer configuración SIFEN, usando modo simulación', {
        error: String(err),
      });
      return new SifenProvider(false);
    }
  }

  /**
   * Envía un Documento Electrónico a SIFEN.
   * En modo simulación retorna un CDC ficticio marcado como APROBADO.
   */
  async enviarFactura(documentoFiscalId: number): Promise<SifenResult> {
    if (!this.habilitado) {
      const cdc = `01${String(documentoFiscalId).padStart(42, '0')}`;
      logger.debug('SIFEN modo simulación: enviarFactura', { documentoFiscalId, cdc });
      return {
        cdc,
        estado: 'APROBADO',
        mensaje: 'Modo simulación SIFEN',
      };
    }

    // ── Integración real con SIFEN ────────────────────────────────────────────
    // Para activar: configurar SIFEN_URL, SIFEN_CERTIFICADO y SIFEN_PASSWORD
    // en la tabla Configuracion y establecer SIFEN_HABILITADO=true.
    logger.warn('Intento de envío real a SIFEN sin credenciales configuradas', {
      documentoFiscalId,
    });
    throw new Error(
      'SIFEN real no configurado. Configure SIFEN_URL, SIFEN_CERTIFICADO y SIFEN_PASSWORD en tabla Configuracion.'
    );
  }

  /**
   * Cancela un Documento Electrónico ya aprobado en SIFEN.
   * En modo simulación retorna éxito inmediato.
   */
  async cancelarFactura(cdc: string): Promise<SifenResult> {
    if (!this.habilitado) {
      logger.debug('SIFEN modo simulación: cancelarFactura', { cdc });
      return {
        cdc,
        estado: 'APROBADO',
        mensaje: 'Cancelación simulada',
      };
    }

    logger.warn('Intento de cancelación real en SIFEN sin credenciales configuradas', { cdc });
    throw new Error(
      'SIFEN real no configurado. Configure credenciales en tabla Configuracion.'
    );
  }

  get esModoSimulacion(): boolean {
    return !this.habilitado;
  }
}
