# Guía de Testing

## Stack de testing

- **Vitest** — framework de tests (compatible con Jest API)
- **Supertest** — tests de integración HTTP
- **Mocks de Prisma y Redis** — no requiere base de datos real

---

## Ejecutar tests

```bash
# Todos los tests
npm test --workspace=apps/api

# En modo watch (desarrollo)
npm run test:watch --workspace=apps/api

# Con cobertura
npm run test:coverage --workspace=apps/api
```

Resultado esperado: **27 tests passing** sin necesidad de DB ni Redis.

---

## Estructura de tests

```
apps/api/src/test/
  setup.ts          — mocks globales (Prisma, Redis, rateLimitMiddleware)
  helpers.ts        — utilidades (crearTokenTest, crearUsuarioMock, etc.)
  calculos.test.ts  — tests unitarios de cálculo de IVA
  auth.test.ts      — tests de endpoints de autenticación
  reservas.test.ts  — tests de lógica de cupo de reservas
```

---

## Cómo escribir nuevos tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma'; // ya mockeado en setup.ts

describe('Mi módulo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hace algo correctamente', async () => {
    // Configurar mock
    vi.mocked(prisma.venta.findUnique).mockResolvedValueOnce({
      id: 1, total: BigInt(100000), estado: 'PENDIENTE'
    } as any);

    // Ejecutar
    const resultado = await miFuncion(1);

    // Verificar
    expect(resultado.total).toBe(BigInt(100000));
  });
});
```

---

## CI/CD — GitHub Actions

Archivo: `.github/workflows/ci.yml`

Se ejecuta automáticamente en:
- Push a `main`
- Push a ramas `claude/**`
- Pull Requests a `main`

### Jobs

| Job | Descripción | Duración aprox. |
|-----|-------------|-----------------|
| `test` | Vitest (27 tests, sin DB) | ~30s |
| `typecheck` | tsc --noEmit en API y admin | ~45s |
| `lint` | ESLint en web-admin | ~20s |
| `docker-build` | Build de las 3 imágenes Docker | ~3-5 min |

---

## Cobertura

Áreas cubiertas actualmente:
- ✅ Cálculo de IVA 5%/10%/exento (9 tests)
- ✅ Login y refresh de auth (8 tests)
- ✅ Validación de cupo en reservas (10 tests)

Áreas para ampliar:
- Flujo completo de venta (StockService + LibretaService)
- Webhooks de pago (idempotencia)
- Facturación y secuencia fiscal
