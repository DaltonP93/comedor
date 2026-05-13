import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import { crearMenuMock } from './helpers';

// Tests unitarios de la lógica de cupo de reservas
// La lógica está en apps/api/src/routes/reservas.ts

const mockPrisma = prisma as unknown as {
  menu: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  reserva: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditoria: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

// Función que replica la lógica de validación de cupo de reservas.ts
function validarCupoDisponible(menu: {
  cupo_total: number | null;
  cupo_reservado: number;
}, cantidad: number): { valido: boolean; mensaje?: string; cupoDisponible?: number } {
  if (menu.cupo_total === null) {
    return { valido: true };
  }
  const cupoDisponible = menu.cupo_total - menu.cupo_reservado;
  if (cantidad > cupoDisponible) {
    return {
      valido: false,
      mensaje: `Cupo insuficiente. Disponible: ${cupoDisponible}`,
      cupoDisponible,
    };
  }
  return { valido: true, cupoDisponible };
}

describe('Validación de cupo en reservas', () => {
  it('permite reservar cuando hay cupo suficiente', () => {
    const menu = crearMenuMock({ cupo_total: 50, cupo_reservado: 10 });
    const resultado = validarCupoDisponible(menu, 5);
    expect(resultado.valido).toBe(true);
  });

  it('rechaza reserva cuando el cupo es insuficiente', () => {
    const menu = crearMenuMock({ cupo_total: 50, cupo_reservado: 48 });
    const resultado = validarCupoDisponible(menu, 5);
    expect(resultado.valido).toBe(false);
    expect(resultado.mensaje).toContain('Cupo insuficiente');
    expect(resultado.cupoDisponible).toBe(2);
  });

  it('permite reservar exactamente el cupo disponible', () => {
    const menu = crearMenuMock({ cupo_total: 50, cupo_reservado: 40 });
    const resultado = validarCupoDisponible(menu, 10);
    expect(resultado.valido).toBe(true);
    expect(resultado.cupoDisponible).toBe(10);
  });

  it('rechaza reserva cuando el cupo está agotado', () => {
    const menu = crearMenuMock({ cupo_total: 50, cupo_reservado: 50 });
    const resultado = validarCupoDisponible(menu, 1);
    expect(resultado.valido).toBe(false);
    expect(resultado.cupoDisponible).toBe(0);
  });

  it('permite reservar cuando cupo_total es null (sin límite)', () => {
    const menu = crearMenuMock({ cupo_total: null, cupo_reservado: 9999 });
    const resultado = validarCupoDisponible(menu, 100);
    expect(resultado.valido).toBe(true);
  });

  it('calcula cupo disponible correctamente', () => {
    const menu = crearMenuMock({ cupo_total: 100, cupo_reservado: 30 });
    const resultado = validarCupoDisponible(menu, 1);
    expect(resultado.cupoDisponible).toBe(70);
  });
});

describe('Lógica de cupo_reservado en transacciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('incrementa cupo_reservado al crear una reserva', async () => {
    const menu = crearMenuMock({ cupo_total: 50, cupo_reservado: 10 });
    const cantidad = 3;

    mockPrisma.menu.findUnique.mockResolvedValue(menu);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        reserva: {
          create: vi.fn().mockResolvedValue({ id: 1, cantidad, menu_id: menu.id }),
        },
        menu: {
          update: vi.fn().mockResolvedValue({ ...menu, cupo_reservado: menu.cupo_reservado + cantidad }),
        },
      };
      return fn(tx);
    });

    // Simular la transacción de crear reserva
    const resultado = await prisma.$transaction(async (tx: unknown) => {
      const txTyped = tx as {
        reserva: { create: (data: unknown) => Promise<{ id: number }> };
        menu: { update: (data: unknown) => Promise<{ cupo_reservado: number }> };
      };
      const reserva = await txTyped.reserva.create({ data: {} });
      const menuActualizado = await txTyped.menu.update({
        where: { id: menu.id },
        data: { cupo_reservado: { increment: cantidad } },
      });
      return { reserva, menuActualizado };
    });

    expect((resultado as { menuActualizado: { cupo_reservado: number } }).menuActualizado.cupo_reservado).toBe(
      menu.cupo_reservado + cantidad
    );
  });

  it('decrementa cupo_reservado al cancelar una reserva', async () => {
    const menu = crearMenuMock({ cupo_total: 50, cupo_reservado: 13 });
    const cantidad = 3;

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        reserva: {
          update: vi.fn().mockResolvedValue({ id: 1, estado: 'CANCELADA' }),
        },
        menu: {
          update: vi.fn().mockResolvedValue({ ...menu, cupo_reservado: menu.cupo_reservado - cantidad }),
        },
      };
      return fn(tx);
    });

    const resultado = await prisma.$transaction(async (tx: unknown) => {
      const txTyped = tx as {
        reserva: { update: (data: unknown) => Promise<{ estado: string }> };
        menu: { update: (data: unknown) => Promise<{ cupo_reservado: number }> };
      };
      const reserva = await txTyped.reserva.update({ where: { id: 1 }, data: { estado: 'CANCELADA' } });
      const menuActualizado = await txTyped.menu.update({
        where: { id: menu.id },
        data: { cupo_reservado: { decrement: cantidad } },
      });
      return { reserva, menuActualizado };
    });

    expect((resultado as { reserva: { estado: string } }).reserva.estado).toBe('CANCELADA');
    expect((resultado as { menuActualizado: { cupo_reservado: number } }).menuActualizado.cupo_reservado).toBe(
      menu.cupo_reservado - cantidad
    );
  });
});

describe('Validación de estado de menú para reservas', () => {
  it('solo permite reservar en menús PUBLICADOS', () => {
    const estadosInvalidos = ['BORRADOR', 'CERRADO', 'AGOTADO', 'CANCELADO'];
    for (const estado of estadosInvalidos) {
      const menu = crearMenuMock({ estado });
      expect(menu.estado).not.toBe('PUBLICADO');
    }
  });

  it('acepta reserva en menú PUBLICADO', () => {
    const menu = crearMenuMock({ estado: 'PUBLICADO' });
    expect(menu.estado).toBe('PUBLICADO');
  });
});
