import { describe, it, expect } from 'vitest';
import { calcularTotalesVenta } from '../lib/calculos';

describe('calcularTotalesVenta', () => {
  it('calcula IVA 10% incluido correctamente', () => {
    const items = [{ precio_unitario: 110000, cantidad: 1, iva_porcentaje: 10 as const }];
    const result = calcularTotalesVenta(items);
    // IVA 10% incluido: 110000 * 10 / 110 = 10000
    expect(result.iva10).toBe(BigInt(10000));
    expect(result.gravado10).toBe(BigInt(100000));
    expect(result.total).toBe(BigInt(110000));
  });

  it('calcula IVA 5% incluido correctamente', () => {
    const items = [{ precio_unitario: 105000, cantidad: 1, iva_porcentaje: 5 as const }];
    const result = calcularTotalesVenta(items);
    // IVA 5% incluido: 105000 * 5 / 105 = 5000
    expect(result.iva5).toBe(BigInt(5000));
    expect(result.gravado5).toBe(BigInt(100000));
    expect(result.total).toBe(BigInt(105000));
  });

  it('maneja productos exentos', () => {
    const items = [{ precio_unitario: 50000, cantidad: 1, iva_porcentaje: 0 as const }];
    const result = calcularTotalesVenta(items);
    expect(result.exento).toBe(BigInt(50000));
    expect(result.iva_total).toBe(BigInt(0));
    expect(result.total).toBe(BigInt(50000));
  });

  it('aplica descuento global', () => {
    const items = [{ precio_unitario: 110000, cantidad: 1, iva_porcentaje: 10 as const }];
    const result = calcularTotalesVenta(items, 10000);
    expect(result.total).toBe(BigInt(100000));
    expect(result.descuento).toBe(BigInt(10000));
  });

  it('suma múltiples items', () => {
    const items = [
      { precio_unitario: 110000, cantidad: 2, iva_porcentaje: 10 as const },
      { precio_unitario: 50000, cantidad: 1, iva_porcentaje: 0 as const },
    ];
    const result = calcularTotalesVenta(items);
    expect(result.total).toBe(BigInt(270000));
    expect(result.iva10).toBe(BigInt(20000));
    expect(result.exento).toBe(BigInt(50000));
  });

  it('calcula subtotal antes del descuento global', () => {
    const items = [
      { precio_unitario: 110000, cantidad: 1, iva_porcentaje: 10 as const },
      { precio_unitario: 50000, cantidad: 1, iva_porcentaje: 0 as const },
    ];
    const result = calcularTotalesVenta(items, 5000);
    expect(result.subtotal).toBe(BigInt(160000));
    expect(result.total).toBe(BigInt(155000));
    expect(result.descuento).toBe(BigInt(5000));
  });

  it('aplica descuento por item', () => {
    const items = [
      { precio_unitario: 110000, cantidad: 1, iva_porcentaje: 10 as const, descuento_item: 10000 },
    ];
    const result = calcularTotalesVenta(items);
    // Neto = 110000 - 10000 = 100000
    expect(result.subtotal).toBe(BigInt(100000));
    expect(result.total).toBe(BigInt(100000));
  });

  it('devuelve cero IVA cuando no hay items', () => {
    const result = calcularTotalesVenta([]);
    expect(result.iva_total).toBe(BigInt(0));
    expect(result.total).toBe(BigInt(0));
    expect(result.subtotal).toBe(BigInt(0));
  });

  it('combina IVA 5%, IVA 10% y exento en el mismo pedido', () => {
    const items = [
      { precio_unitario: 110000, cantidad: 1, iva_porcentaje: 10 as const },
      { precio_unitario: 105000, cantidad: 1, iva_porcentaje: 5 as const },
      { precio_unitario: 30000, cantidad: 1, iva_porcentaje: 0 as const },
    ];
    const result = calcularTotalesVenta(items);
    expect(result.iva10).toBe(BigInt(10000));
    expect(result.iva5).toBe(BigInt(5000));
    expect(result.exento).toBe(BigInt(30000));
    expect(result.iva_total).toBe(BigInt(15000));
    expect(result.total).toBe(BigInt(245000));
  });
});
