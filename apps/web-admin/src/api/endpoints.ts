import apiClient from './client';

// Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<ApiResponse<{ token: string; refreshToken: string; usuario: Record<string, unknown> }>>('/auth/login', { email, password }),
  logout: () => apiClient.post('/auth/logout'),
  me: () => apiClient.get('/auth/me'),
  refresh: (refreshToken: string) => apiClient.post('/auth/refresh', { refreshToken }),
};

// Clientes
export const clientesApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/clientes', { params }),
  obtener: (id: number) => apiClient.get(`/clientes/${id}`),
  estadoCuenta: (id: number) => apiClient.get(`/clientes/${id}/estado-cuenta`),
  reservas: (id: number) => apiClient.get(`/clientes/${id}/reservas`),
  ventas: (id: number) => apiClient.get(`/clientes/${id}/ventas`),
  crear: (data: Record<string, unknown>) => apiClient.post('/clientes', data),
  actualizar: (id: number, data: Record<string, unknown>) => apiClient.put(`/clientes/${id}`, data),
  eliminar: (id: number) => apiClient.delete(`/clientes/${id}`),
};

// Productos
export const productosApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/productos', { params }),
  obtener: (id: number) => apiClient.get(`/productos/${id}`),
  crear: (data: Record<string, unknown>) => apiClient.post('/productos', data),
  actualizar: (id: number, data: Record<string, unknown>) => apiClient.put(`/productos/${id}`, data),
  eliminar: (id: number) => apiClient.delete(`/productos/${id}`),
};

// Categorias
export const categoriasApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/categorias', { params }),
  obtener: (id: number) => apiClient.get(`/categorias/${id}`),
  crear: (data: Record<string, unknown>) => apiClient.post('/categorias', data),
  actualizar: (id: number, data: Record<string, unknown>) => apiClient.put(`/categorias/${id}`, data),
  eliminar: (id: number) => apiClient.delete(`/categorias/${id}`),
};

// Conceptos
export const conceptosApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/conceptos', { params }),
  obtener: (id: number) => apiClient.get(`/conceptos/${id}`),
  crear: (data: Record<string, unknown>) => apiClient.post('/conceptos', data),
  actualizar: (id: number, data: Record<string, unknown>) => apiClient.put(`/conceptos/${id}`, data),
  eliminar: (id: number) => apiClient.delete(`/conceptos/${id}`),
};

// Menus
export const menusApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/menus', { params }),
  obtener: (id: number) => apiClient.get(`/menus/${id}`),
  crear: (data: Record<string, unknown>) => apiClient.post('/menus', data),
  actualizar: (id: number, data: Record<string, unknown>) => apiClient.put(`/menus/${id}`, data),
  publicar: (id: number) => apiClient.post(`/menus/${id}/publicar`),
  cerrar: (id: number) => apiClient.post(`/menus/${id}/cerrar`),
  eliminar: (id: number) => apiClient.delete(`/menus/${id}`),
};

// Reservas
export const reservasApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/reservas', { params }),
  obtener: (id: number) => apiClient.get(`/reservas/${id}`),
  crear: (data: Record<string, unknown>) => apiClient.post('/reservas', data),
  actualizarEstado: (id: number, estado: string) => apiClient.put(`/reservas/${id}/estado`, { estado }),
  cancelar: (id: number) => apiClient.post(`/reservas/${id}/cancelar`),
  convertirVenta: (id: number, data: Record<string, unknown>) => apiClient.post(`/reservas/${id}/convertir-venta`, data),
};

// Ventas
export const ventasApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/ventas', { params }),
  obtener: (id: number) => apiClient.get(`/ventas/${id}`),
  crear: (data: Record<string, unknown>) => apiClient.post('/ventas', data),
  pagar: (id: number, data: Record<string, unknown>) => apiClient.post(`/ventas/${id}/pagar`, data),
  anular: (id: number, motivo: string) => apiClient.post(`/ventas/${id}/anular`, { motivo }),
  porKilo: (data: Record<string, unknown>) => apiClient.post('/ventas/por-kilo', data),
  cargarLibreta: (data: Record<string, unknown>) => apiClient.post('/ventas/cargar-libreta', data),
};

// Libretas
export const libretasApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/libretas', { params }),
  obtener: (id: number) => apiClient.get(`/libretas/${id}`),
  movimientos: (id: number, params?: Record<string, unknown>) => apiClient.get(`/libretas/${id}/movimientos`, { params }),
  crear: (data: Record<string, unknown>) => apiClient.post('/libretas', data),
  actualizar: (id: number, data: Record<string, unknown>) => apiClient.put(`/libretas/${id}`, data),
  pago: (id: number, data: Record<string, unknown>) => apiClient.post(`/libretas/${id}/pago`, data),
  ajuste: (id: number, data: Record<string, unknown>) => apiClient.post(`/libretas/${id}/ajuste`, data),
};

// Stock
export const stockApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/stock', { params }),
  kardex: (productoId: number, params?: Record<string, unknown>) => apiClient.get(`/stock/kardex/${productoId}`, { params }),
  entrada: (data: Record<string, unknown>) => apiClient.post('/stock/entrada', data),
  ajuste: (data: Record<string, unknown>) => apiClient.post('/stock/ajuste', data),
};

// Compras
export const comprasApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/compras', { params }),
  obtener: (id: number) => apiClient.get(`/compras/${id}`),
  crear: (data: Record<string, unknown>) => apiClient.post('/compras', data),
  actualizar: (id: number, data: Record<string, unknown>) => apiClient.put(`/compras/${id}`, data),
  eliminar: (id: number) => apiClient.delete(`/compras/${id}`),
};

// Proveedores
export const proveedoresApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/proveedores', { params }),
  obtener: (id: number) => apiClient.get(`/proveedores/${id}`),
  crear: (data: Record<string, unknown>) => apiClient.post('/proveedores', data),
  actualizar: (id: number, data: Record<string, unknown>) => apiClient.put(`/proveedores/${id}`, data),
  eliminar: (id: number) => apiClient.delete(`/proveedores/${id}`),
};

// Usuarios
export const usuariosApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/usuarios', { params }),
  obtener: (id: number) => apiClient.get(`/usuarios/${id}`),
  crear: (data: Record<string, unknown>) => apiClient.post('/usuarios', data),
  actualizar: (id: number, data: Record<string, unknown>) => apiClient.put(`/usuarios/${id}`, data),
  eliminar: (id: number) => apiClient.delete(`/usuarios/${id}`),
};

// Roles
export const rolesApi = {
  listar: () => apiClient.get('/roles'),
  permisos: () => apiClient.get('/roles/permisos'),
  obtener: (id: number) => apiClient.get(`/roles/${id}`),
  crear: (data: Record<string, unknown>) => apiClient.post('/roles', data),
  actualizar: (id: number, data: Record<string, unknown>) => apiClient.put(`/roles/${id}`, data),
  eliminar: (id: number) => apiClient.delete(`/roles/${id}`),
};

// Sucursales
export const sucursalesApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/sucursales', { params }),
  obtener: (id: number) => apiClient.get(`/sucursales/${id}`),
  crear: (data: Record<string, unknown>) => apiClient.post('/sucursales', data),
  actualizar: (id: number, data: Record<string, unknown>) => apiClient.put(`/sucursales/${id}`, data),
  eliminar: (id: number) => apiClient.delete(`/sucursales/${id}`),
};

// Cajas
export const cajasApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/cajas', { params }),
  obtener: (id: number) => apiClient.get(`/cajas/${id}`),
  crear: (data: Record<string, unknown>) => apiClient.post('/cajas', data),
  actualizar: (id: number, data: Record<string, unknown>) => apiClient.put(`/cajas/${id}`, data),
  abrir: (id: number) => apiClient.post(`/cajas/${id}/abrir`),
  cerrar: (id: number) => apiClient.post(`/cajas/${id}/cerrar`),
  eliminar: (id: number) => apiClient.delete(`/cajas/${id}`),
};

// Reportes
export const reportesApi = {
  dashboard: () => apiClient.get('/reportes/dashboard'),
  ventas: (params?: Record<string, unknown>) => apiClient.get('/reportes/ventas', { params }),
  stock: (params?: Record<string, unknown>) => apiClient.get('/reportes/stock', { params }),
  libreta: (params?: Record<string, unknown>) => apiClient.get('/reportes/libreta', { params }),
  cocina: (params?: Record<string, unknown>) => apiClient.get('/reportes/cocina', { params }),
};

// Configuraciones
export const configuracionesApi = {
  listar: () => apiClient.get('/configuraciones'),
  actualizar: (clave: string, valor: string) => apiClient.put(`/configuraciones/${clave}`, { valor }),
};

// Auditoria
export const auditoriaApi = {
  listar: (params?: Record<string, unknown>) => apiClient.get('/auditoria', { params }),
};
