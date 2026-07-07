/**
 * Selects reutilizables para evitar exponer campos sensibles en las respuestas.
 */

/**
 * Todos los campos públicos de Cliente EXCEPTO password_hash.
 * Usar en cualquier `include: { cliente: { select: clientePublicSelect } }`
 * para no filtrar el hash de contraseña a través de relaciones.
 */
export const clientePublicSelect = {
  id: true,
  tipo_cliente: true,
  nombre: true,
  razon_social: true,
  documento_tipo: true,
  documento_numero: true,
  ruc: true,
  telefono: true,
  whatsapp: true,
  email: true,
  direccion: true,
  permite_notificaciones: true,
  canal_preferido: true,
  estado: true,
  creado_en: true,
  actualizado_en: true,
} as const;
