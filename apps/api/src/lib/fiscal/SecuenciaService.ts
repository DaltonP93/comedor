import type { Prisma } from '@prisma/client';
import { logger } from '../logger';

/** Alias del cliente de transacción de Prisma */
type PrismaTx = Prisma.TransactionClient;

/**
 * Obtiene el siguiente número de secuencia fiscal de forma transaccional.
 * Usa SQL con UPDATE ... RETURNING para atomicidad sin SELECT FOR UPDATE explícito.
 * Si no existe la secuencia para la combinación dada, la crea con ultimo_numero = 1.
 *
 * IMPORTANTE: Debe llamarse siempre dentro de una transacción Prisma activa (tx).
 */
export async function obtenerSiguienteNumero(
  tx: PrismaTx,
  establecimiento: string,
  puntoExpedicion: string,
  tipoDocumento: string
): Promise<number> {
  // Intentar actualizar la fila existente — el UPDATE es atómico en PostgreSQL
  const resultado = await tx.$queryRaw<{ ultimo_numero: number }[]>`
    UPDATE secuencias_fiscales
    SET ultimo_numero = ultimo_numero + 1,
        actualizado_en = NOW()
    WHERE establecimiento = ${establecimiento}
      AND punto_expedicion = ${puntoExpedicion}
      AND tipo_documento = ${tipoDocumento}
      AND activo = true
    RETURNING ultimo_numero
  `;

  if (resultado.length > 0) {
    const numero = Number(resultado[0].ultimo_numero);
    logger.debug('Secuencia fiscal incrementada', {
      establecimiento,
      puntoExpedicion,
      tipoDocumento,
      numero,
    });
    return numero;
  }

  // No existe la secuencia — crearla con ultimo_numero = 1
  logger.info('Creando nueva secuencia fiscal', {
    establecimiento,
    puntoExpedicion,
    tipoDocumento,
  });

  await tx.$executeRaw`
    INSERT INTO secuencias_fiscales
      (establecimiento, punto_expedicion, tipo_documento, ultimo_numero, activo, actualizado_en)
    VALUES
      (${establecimiento}, ${puntoExpedicion}, ${tipoDocumento}, 1, true, NOW())
    ON CONFLICT (establecimiento, punto_expedicion, tipo_documento) DO UPDATE
      SET ultimo_numero = secuencias_fiscales.ultimo_numero + 1,
          actualizado_en = NOW()
  `;

  // Leer el valor resultante del upsert
  const nuevo = await tx.$queryRaw<{ ultimo_numero: number }[]>`
    SELECT ultimo_numero FROM secuencias_fiscales
    WHERE establecimiento = ${establecimiento}
      AND punto_expedicion = ${puntoExpedicion}
      AND tipo_documento = ${tipoDocumento}
  `;

  if (nuevo.length === 0) {
    throw new Error(
      `No se pudo obtener secuencia fiscal para ${establecimiento}-${puntoExpedicion}-${tipoDocumento}`
    );
  }

  return Number(nuevo[0].ultimo_numero);
}

/**
 * Formatea el número de factura al estándar paraguayo.
 * @example formatearNumeroFactura('001', '001', 1) // '001-001-0000001'
 */
export function formatearNumeroFactura(
  establecimiento: string,
  puntoExpedicion: string,
  numero: number
): string {
  return `${establecimiento}-${puntoExpedicion}-${String(numero).padStart(7, '0')}`;
}
