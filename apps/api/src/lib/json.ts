import type { Prisma } from '@prisma/client';

/**
 * Convierte un valor arbitrario en un `Prisma.InputJsonValue` seguro para columnas Json.
 * Serializa vía JSON para normalizar BigInt (con el `BigInt.toJSON` global de index.ts),
 * descartar `undefined` y evitar referencias no serializables.
 * Centraliza el idioma `JSON.parse(JSON.stringify(...))` con tipado correcto.
 */
export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}
