import { prisma } from './prisma';

interface AuditParams {
  usuarioId?: number;
  modulo: string;
  accion: string;
  registroId?: string | number;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
  ip?: string;
}

export async function registrarAuditoria(params: AuditParams): Promise<void> {
  try {
    await prisma.auditoria.create({
      data: {
        usuario_id: params.usuarioId,
        modulo: params.modulo,
        accion: params.accion,
        registro_id: params.registroId ? String(params.registroId) : undefined,
        valor_anterior: params.valorAnterior !== undefined
          ? (params.valorAnterior as Record<string, unknown>)
          : undefined,
        valor_nuevo: params.valorNuevo !== undefined
          ? (params.valorNuevo as Record<string, unknown>)
          : undefined,
        ip: params.ip,
      },
    });
  } catch (error) {
    console.error('Error al registrar auditoría:', error);
  }
}
