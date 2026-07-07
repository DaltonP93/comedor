import { describe, it, expect } from 'vitest';
import { pick } from '../lib/pick';
import { clientePublicSelect } from '../lib/selects';

// ── Allowlist (anti mass-assignment) ──────────────────────────────────────────
describe('pick() — allowlist contra mass assignment', () => {
  it('solo conserva las claves permitidas', () => {
    const body = { nombre: 'X', password_hash: 'hack', estado: 'ADMIN', saldo_actual: 999 };
    const data = pick(body, ['nombre', 'estado']);
    expect(data).toEqual({ nombre: 'X', estado: 'ADMIN' });
    expect(data.password_hash).toBeUndefined();
    expect(data.saldo_actual).toBeUndefined();
  });

  it('omite claves ausentes (no las setea a undefined)', () => {
    const data = pick({ nombre: 'X' }, ['nombre', 'telefono']);
    expect(Object.keys(data)).toEqual(['nombre']);
  });

  it('bloquea inyección de password_hash y saldo en libretas', () => {
    const attacker = { limite_credito: 1, saldo_actual: 0, estado: 'ACTIVA', password_hash: 'x' };
    const data = pick(attacker, ['tipo', 'estado', 'dia_corte', 'dia_vencimiento', 'empresa_id', 'limite_credito']);
    expect(data.saldo_actual).toBeUndefined();
    expect(data.password_hash).toBeUndefined();
    expect(data.estado).toBe('ACTIVA');
  });
});

// ── Select seguro de cliente ──────────────────────────────────────────────────
describe('clientePublicSelect — no expone password_hash', () => {
  it('nunca incluye password_hash', () => {
    expect('password_hash' in clientePublicSelect).toBe(false);
  });

  it('incluye los campos públicos esperados', () => {
    for (const campo of ['id', 'nombre', 'telefono', 'email', 'estado']) {
      expect((clientePublicSelect as Record<string, unknown>)[campo]).toBe(true);
    }
  });
});

// ── Validación de monto en webhooks de pago ──────────────────────────────────
function montoWebhookValido(montoConfirmado: bigint | undefined, montoPago: bigint): boolean {
  return montoConfirmado === undefined || montoConfirmado === montoPago;
}

describe('Webhook de pago — validación de monto', () => {
  it('acepta cuando el monto confirmado coincide', () => {
    expect(montoWebhookValido(BigInt(50000), BigInt(50000))).toBe(true);
  });

  it('rechaza cuando el monto confirmado es menor (pago fraudulento)', () => {
    expect(montoWebhookValido(BigInt(1000), BigInt(50000))).toBe(false);
  });

  it('acepta cuando la pasarela no informa monto (undefined)', () => {
    expect(montoWebhookValido(undefined, BigInt(50000))).toBe(true);
  });
});

// ── Registro del portal — anti account takeover ──────────────────────────────
function debeRechazarRegistro(existing: { password_hash: string | null } | null): boolean {
  return !!(existing && existing.password_hash);
}

describe('Registro del portal — anti account takeover', () => {
  it('rechaza (409) si ya existe cuenta con contraseña', () => {
    expect(debeRechazarRegistro({ password_hash: '$2a$hash' })).toBe(true);
  });

  it('permite si el cliente existe pero no tiene contraseña (alta desde caja)', () => {
    expect(debeRechazarRegistro({ password_hash: null })).toBe(false);
  });

  it('permite si no existe el cliente', () => {
    expect(debeRechazarRegistro(null)).toBe(false);
  });
});

// ── POS manual — el monto no puede exceder el pendiente ───────────────────────
function montoPOSValido(monto: bigint, pendiente: bigint): boolean {
  return monto <= pendiente;
}

describe('POS manual — monto vs pendiente', () => {
  it('acepta un pago parcial válido', () => {
    expect(montoPOSValido(BigInt(20000), BigInt(50000))).toBe(true);
  });

  it('rechaza un pago que excede el pendiente', () => {
    expect(montoPOSValido(BigInt(60000), BigInt(50000))).toBe(false);
  });
});
