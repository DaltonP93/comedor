import { beforeAll, afterAll, vi } from 'vitest';

// Mock Prisma para evitar conexiones reales a DB en tests unitarios
vi.mock('../lib/prisma', () => ({
  prisma: {
    usuario: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    userSession: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    venta: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    ventaItem: { findMany: vi.fn() },
    libreta: { findFirst: vi.fn(), update: vi.fn() },
    libretaMovimiento: { create: vi.fn() },
    producto: { findUnique: vi.fn() },
    pago: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    pagoIntento: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    webhookEvento: { findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    stockActual: { findUnique: vi.fn(), upsert: vi.fn() },
    stockMovimiento: { create: vi.fn(), findMany: vi.fn() },
    auditoria: { create: vi.fn() },
    configuracion: { findUnique: vi.fn() },
    menu: { findUnique: vi.fn(), update: vi.fn() },
    reserva: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
    $queryRaw: vi.fn(),
  },
}));

// Mock Redis
vi.mock('../lib/redis', () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
  },
  getRedisClient: vi.fn().mockRejectedValue(new Error('Redis no disponible en tests')),
}));

// Mock rate limit para evitar dependencia de Redis en tests de auth
vi.mock('../middleware/rateLimit', () => ({
  rateLimitMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing';
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  vi.clearAllMocks();
});
