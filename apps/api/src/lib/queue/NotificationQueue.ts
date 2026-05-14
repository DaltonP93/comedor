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
    await redisClient.lpush(QUEUE_KEY, JSON.stringify(notif));
    logger.info({ notificacionId: notif.id, tipo: notif.tipo, canal: notif.canal }, 'Notificación encolada');
  } catch (error) {
    logger.error({ error, notif }, 'Error al encolar notificación');
  }
}

export async function obtenerProximaNotificacion(): Promise<NotificacionJob | null> {
  try {
    const item = await redisClient.rpoplpush(QUEUE_KEY, PROCESSING_KEY);
    if (!item) return null;
    return JSON.parse(item) as NotificacionJob;
  } catch {
    return null;
  }
}

export async function confirmarProcesada(jobId: string): Promise<void> {
  try {
    const items = await redisClient.lrange(PROCESSING_KEY, 0, -1);
    for (const item of items) {
      const job = JSON.parse(item) as NotificacionJob;
      if (job.id === jobId) {
        await redisClient.lrem(PROCESSING_KEY, 1, item);
        break;
      }
    }
  } catch (error) {
    logger.error({ error, jobId }, 'Error al confirmar notificación procesada');
  }
}

export async function reencolarConError(job: NotificacionJob, error: string): Promise<void> {
  const MAX_INTENTOS = 3;
  job.intentos += 1;
  try {
    const items = await redisClient.lrange(PROCESSING_KEY, 0, -1);
    for (const item of items) {
      const j = JSON.parse(item) as NotificacionJob;
      if (j.id === job.id) { await redisClient.lrem(PROCESSING_KEY, 1, item); break; }
    }
    if (job.intentos < MAX_INTENTOS) {
      await redisClient.lpush(QUEUE_KEY, JSON.stringify(job));
      logger.warn({ jobId: job.id, intentos: job.intentos, error }, 'Notificación re-encolada tras error');
    } else {
      logger.error({ jobId: job.id, error }, 'Notificación descartada tras máximo de intentos');
    }
  } catch (err) {
    logger.error({ err }, 'Error al re-encolar notificación');
  }
}
