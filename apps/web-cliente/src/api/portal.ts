import apiClient from './client';

// ── Registro ──────────────────────────────────────────────────────────────────
export interface RegistroPayload {
  nombre: string;
  email: string;
  password: string;
  ci: string;
  telefono?: string;
}

export const registroApi = {
  registrar: (data: RegistroPayload) => apiClient.post('/portal/registro', data),
};

// ── Perfil ────────────────────────────────────────────────────────────────────
export interface PerfilData {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  ci: string;
  telefono: string | null;
  estado: string;
  ruc: string | null;
  razon_social: string | null;
}

export interface ActualizarPerfilPayload {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  ruc?: string;
  razon_social?: string;
}

export interface CambiarPasswordPayload {
  password_actual: string;
  password_nueva: string;
}

export const perfilApi = {
  obtener: () => apiClient.get<{ data: PerfilData }>('/portal/perfil'),
  actualizar: (data: ActualizarPerfilPayload) => apiClient.put('/portal/perfil', data),
  cambiarPassword: (data: CambiarPasswordPayload) => apiClient.put('/portal/password', data),
};

// ── Recuperar contraseña ──────────────────────────────────────────────────────
export const recuperarPasswordApi = {
  solicitar: (email: string) => apiClient.post('/portal/recuperar-password', { email }),
};

// ── Facturas ──────────────────────────────────────────────────────────────────
export interface FacturaCliente {
  id: number;
  numero: string;
  fecha: string;
  total: string;
  estado: string;
  venta_id: number;
}

export const facturasClienteApi = {
  listar: () => apiClient.get<{ data: FacturaCliente[] }>('/portal/facturas'),
  descargarPdf: (id: number) =>
    apiClient.get(`/portal/facturas/${id}/pdf`, { responseType: 'blob' }),
};

// ── Notificaciones ────────────────────────────────────────────────────────────
export interface PreferenciasNotificaciones {
  canal_whatsapp: boolean;
  canal_email: boolean;
  canal_sms: boolean;
  tipo_menu_publicado: boolean;
  tipo_reserva_confirmada: boolean;
  tipo_libreta_vencida: boolean;
  tipo_pago_confirmado: boolean;
}

export interface Notificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
}

export const notificacionesClienteApi = {
  obtenerPreferencias: () =>
    apiClient.get<{ data: PreferenciasNotificaciones }>('/portal/notificaciones/preferencias'),
  guardarPreferencias: (data: PreferenciasNotificaciones) =>
    apiClient.put('/portal/notificaciones/preferencias', data),
  listarRecientes: () =>
    apiClient.get<{ data: Notificacion[] }>('/portal/notificaciones'),
};
