import { redisClient } from '../redis';
import { logger } from '../logger';

const QUEUE_KEY = 'notificaciones:cola';
const PROCESSING_KEY = 'notificaciones:procesando';

export interface NotificacionJob {
  id: string;
  tipo: string;
  canal: string;
  destinatario: string;
  asunto?: string;
  cuerpo: string;
  clienteId?: number;
  intentos: number;
  creadoEn: string;
}

export async function encolarNotificacion(job: Omit<NotificacionJob, 'id' | 'intentos' | 'creadoEn'>): Promise<void> {
  const notif: NotificacionJob = {
    ...job,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    intentos: 0,
    creadoEn: new Date().toISOString(),
  };
  try {
    await redisClient.lPush(QUEUE_KEY, JSON.stringify(notif));
    logger.info('Notificación encolada', { notificacionId: notif.id, tipo: notif.tipo, canal: notif.canal });
  } catch (error) {
    logger.error('Error al encolar notificación', { error: String(error) });
  }
}

export async function obtenerProximaNotificacion(): Promise<NotificacionJob | null> {
  try {
    const item = await redisClient.rPopLPush(QUEUE_KEY, PROCESSING_KEY);
    if (!item) return null;
    return JSON.parse(item) as NotificacionJob;
  } catch {
    return null;
  }
}

export async function confirmarProcesada(jobId: string): Promise<void> {
  try {
    const items = await redisClient.lRange(PROCESSING_KEY, 0, -1);
    for (const item of items) {
      const job = JSON.parse(item) as NotificacionJob;
      if (job.id === jobId) {
        await redisClient.lRem(PROCESSING_KEY, 1, item);
        break;
      }
    }
  } catch (error) {
    logger.error('Error al confirmar notificación procesada', { error: String(error), jobId });
  }
}

export async function reencolarConError(job: NotificacionJob, error: string): Promise<void> {
  const MAX_INTENTOS = 3;
  job.intentos += 1;
  try {
    const items = await redisClient.lRange(PROCESSING_KEY, 0, -1);
    for (const item of items) {
      const j = JSON.parse(item) as NotificacionJob;
      if (j.id === job.id) { await redisClient.lRem(PROCESSING_KEY, 1, item); break; }
    }
    if (job.intentos < MAX_INTENTOS) {
      await redisClient.lPush(QUEUE_KEY, JSON.stringify(job));
      logger.warn('Notificación re-encolada tras error', { jobId: job.id, intentos: job.intentos, error });
    } else {
      logger.error('Notificación descartada tras máximo de intentos', { jobId: job.id, error });
    }
  } catch (err) {
    logger.error('Error al re-encolar notificación', { error: String(err) });
  }
}
