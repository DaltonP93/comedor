// Tipos de IVA Paraguay
export type TasaIVA = 0 | 5 | 10;

export interface ItemCalculo {
  precio_unitario: number | bigint;
  cantidad: number;
  iva_porcentaje: TasaIVA;
  descuento_item?: number | bigint;
}

export interface TotalesVenta {
  subtotal: bigint;
  gravado5: bigint;
  gravado10: bigint;
  exento: bigint;
  iva5: bigint;
  iva10: bigint;
  iva_total: bigint;
  descuento: bigint;
  total: bigint;
}

export function calcularTotalesVenta(items: ItemCalculo[], descuento = 0): TotalesVenta {
  let subtotal = BigInt(0);
  let gravado5 = BigInt(0);
  let gravado10 = BigInt(0);
  let exento = BigInt(0);
  let iva5 = BigInt(0);
  let iva10 = BigInt(0);

  for (const item of items) {
    const precio = BigInt(Math.round(Number(item.precio_unitario)));
    const cant = BigInt(Math.round(item.cantidad * 1000));
    const itemTotal = (precio * cant) / BigInt(1000);
    const descItem = BigInt(Math.round(Number(item.descuento_item ?? 0)));
    const neto = itemTotal - descItem;

    subtotal += neto;

    if (item.iva_porcentaje === 10) {
      // IVA incluido: IVA = neto - neto / 1.10 = neto * 10 / 110
      const iva = (neto * BigInt(10)) / BigInt(110);
      iva10 += iva;
      gravado10 += neto - iva;
    } else if (item.iva_porcentaje === 5) {
      const iva = (neto * BigInt(5)) / BigInt(105);
      iva5 += iva;
      gravado5 += neto - iva;
    } else {
      exento += neto;
    }
  }

  const descuentoBigInt = BigInt(Math.round(Number(descuento)));
  const total = subtotal - descuentoBigInt;
  const iva_total = iva5 + iva10;

  return { subtotal, gravado5, gravado10, exento, iva5, iva10, iva_total, descuento: descuentoBigInt, total };
}
