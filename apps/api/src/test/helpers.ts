import { vi } from 'vitest';
import jwt from 'jsonwebtoken';

export function crearTokenTest(usuarioId = 1, permisos: string[] = ['*']) {
  return jwt.sign(
    { userId: usuarioId, email: 'admin@test.com', rolNombre: 'ADMIN', sucursalId: null, permisos },
    process.env.JWT_SECRET || 'test-secret-key-for-testing',
    { expiresIn: '1h' }
  );
}

export function crearUsuarioMock(overrides = {}) {
  return {
    id: 1,
    nombre: 'Admin',
    apellido: 'Test',
    email: 'admin@test.com',
    password_hash: '$2a$10$hashedpassword',
    activo: true,
    sucursal_id: null,
    sucursal: null,
    rol: {
      nombre: 'SUPERADMIN',
      permisos: [{ permiso: { codigo: '*' } }],
    },
    ...overrides,
  };
}

export function crearVentaMock(overrides = {}) {
  return {
    id: 1,
    total: BigInt(100000),
    estado: 'PENDIENTE',
    items: [],
    pagos: [],
    cliente: { id: 1, nombre: 'Cliente Test' },
    ...overrides,
  };
}

export function crearMenuMock(overrides = {}) {
  return {
    id: 1,
    titulo: 'Almuerzo del día',
    precio: BigInt(25000),
    estado: 'PUBLICADO',
    cupo_total: 50,
    cupo_reservado: 10,
    sucursal_id: 1,
    hora_limite_reserva: null,
    ...overrides,
  };
}

export function resetMocks(...mocks: ReturnType<typeof vi.fn>[]) {
  mocks.forEach((m) => m.mockReset());
}
