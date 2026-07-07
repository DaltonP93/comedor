/**
 * Devuelve un objeto solo con las claves permitidas (allowlist) presentes en el
 * origen. Evita mass assignment al construir `data` para Prisma a partir de req.body.
 * Retorna `any` para no romper los tipos de entrada de Prisma (igual que req.body).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pick(obj: Record<string, unknown>, keys: readonly string[]): any {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (obj?.[k] !== undefined) out[k] = obj[k];
  }
  return out;
}
