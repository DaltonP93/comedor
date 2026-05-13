import PDFDocument from 'pdfkit';

function formatGs(monto: bigint | number): string {
  const num = typeof monto === 'bigint' ? Number(monto) : monto;
  return `Gs. ${num.toLocaleString('es-PY', { maximumFractionDigits: 0 })}`;
}

function formatFecha(date: Date): string {
  return date.toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

interface FacturaPDFItem {
  descripcion: string;
  cantidad: number | string;
  precio_unitario: bigint;
  iva_porcentaje: number;
  subtotal: bigint;
}

interface FacturaPDFData {
  factura: {
    id: number;
    numero: string;
    tipo_documento: string;
    fecha: Date;
    estado: string;
    subtotal: bigint;
    iva_total: bigint;
    total: bigint;
  };
  cliente: {
    nombre: string;
    razon_social?: string | null;
    ruc?: string | null;
    documento_numero?: string | null;
    documento_tipo?: string | null;
  } | null;
  condicion: string;
  items: FacturaPDFItem[];
  config: {
    razon_social: string;
    ruc: string;
    direccion: string;
    timbrado: string;
    establecimiento: string;
    punto_expedicion: string;
  };
}

export async function generarFacturaPDF(data: FacturaPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100;
      const { factura, cliente, condicion, items, config } = data;
      const esNotaCredito = factura.tipo_documento === 'NOTA_CREDITO';
      const titulo = esNotaCredito ? 'NOTA DE CRÉDITO' : factura.tipo_documento === 'TICKET' ? 'TICKET' : 'FACTURA';

      // ── ENCABEZADO EMPRESA ────────────────────────────────────────────────────
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(config.razon_social || 'COMEDOR', 50, 50, { align: 'center', width: pageWidth });

      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`RUC: ${config.ruc || '-'}`, 50, doc.y + 2, { align: 'center', width: pageWidth });

      doc.text(`${config.direccion || '-'}`, 50, doc.y + 1, { align: 'center', width: pageWidth });

      // ── TÍTULO DEL DOCUMENTO ──────────────────────────────────────────────────
      doc.y += 12;
      doc
        .rect(50, doc.y, pageWidth, 28)
        .fill('#1a202c');

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text(titulo, 50, doc.y + 6, { align: 'center', width: pageWidth });

      doc.fillColor('#000000');
      doc.y += 36;

      // ── DATOS TIMBRADO / NUMERACIÓN ───────────────────────────────────────────
      const datosY = doc.y;
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Timbrado N°: `, 50, datosY, { continued: true })
        .font('Helvetica-Bold')
        .text(config.timbrado || '-');

      doc
        .font('Helvetica')
        .text(`Establecimiento: `, 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(config.establecimiento || '001', { continued: true })
        .font('Helvetica')
        .text('   Punto de expedición: ', { continued: true })
        .font('Helvetica-Bold')
        .text(config.punto_expedicion || '001');

      // Número de factura a la derecha
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(`N° ${factura.numero}`, doc.page.width - 200, datosY, { width: 150, align: 'right' });

      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Fecha: ${formatFecha(new Date(factura.fecha))}`, doc.page.width - 200, datosY + 15, {
          width: 150,
          align: 'right',
        });

      // Línea separadora
      doc.y += 8;
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .strokeColor('#cccccc')
        .stroke();
      doc.y += 8;

      // ── DATOS DEL CLIENTE ─────────────────────────────────────────────────────
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('DATOS DEL CLIENTE', 50, doc.y);
      doc.y += 4;

      const nombreCliente = cliente
        ? cliente.razon_social || cliente.nombre
        : 'CONSUMIDOR FINAL';
      const docCliente = cliente
        ? cliente.ruc
          ? `RUC: ${cliente.ruc}`
          : cliente.documento_numero
            ? `${cliente.documento_tipo || 'CI'}: ${cliente.documento_numero}`
            : 'Sin documento'
        : '-';

      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Nombre/Razón social: `, 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(nombreCliente);

      doc
        .font('Helvetica')
        .text(`Documento: `, 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(docCliente, { continued: true })
        .font('Helvetica')
        .text(`   Condición: `, { continued: true })
        .font('Helvetica-Bold')
        .text(condicion === 'CREDITO' ? 'Crédito' : 'Contado');

      // Línea separadora
      doc.y += 8;
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .strokeColor('#cccccc')
        .stroke();
      doc.y += 8;

      // ── TABLA DE ITEMS ────────────────────────────────────────────────────────
      const colCantidad = 50;
      const colDescripcion = 90;
      const colPrecioUnit = 310;
      const colIva = 390;
      const colSubtotal = 440;
      const tableHeaderY = doc.y;

      doc
        .rect(50, tableHeaderY, pageWidth, 18)
        .fill('#2d3748');

      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('Cant.', colCantidad + 2, tableHeaderY + 4)
        .text('Descripción', colDescripcion + 2, tableHeaderY + 4)
        .text('P. Unit.', colPrecioUnit + 2, tableHeaderY + 4)
        .text('IVA%', colIva + 2, tableHeaderY + 4)
        .text('Subtotal', colSubtotal + 2, tableHeaderY + 4);

      doc.fillColor('#000000');
      doc.y = tableHeaderY + 18;

      let rowIndex = 0;
      for (const item of items) {
        const rowTop = doc.y;
        const bg = rowIndex % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(50, rowTop, pageWidth, 16).fill(bg);

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#000000')
          .text(String(Number(item.cantidad)), colCantidad + 2, rowTop + 3, { width: 35 })
          .text(item.descripcion.substring(0, 38), colDescripcion + 2, rowTop + 3, {
            width: colPrecioUnit - colDescripcion - 8,
          })
          .text(formatGs(item.precio_unitario), colPrecioUnit + 2, rowTop + 3, {
            width: colIva - colPrecioUnit - 4,
          })
          .text(`${item.iva_porcentaje}%`, colIva + 2, rowTop + 3, {
            width: colSubtotal - colIva - 4,
          })
          .text(formatGs(item.subtotal), colSubtotal + 2, rowTop + 3, {
            width: 50 + pageWidth - colSubtotal - 4,
          });

        doc.y = rowTop + 16;
        rowIndex++;

        if (doc.y > doc.page.height - 160) {
          doc.addPage();
          doc.y = 50;
        }
      }

      // Borde de tabla
      doc
        .rect(50, tableHeaderY, pageWidth, doc.y - tableHeaderY)
        .strokeColor('#e2e8f0')
        .stroke();

      // ── DESGLOSE IVA ──────────────────────────────────────────────────────────
      doc.y += 12;

      // Calcular gravado 10%, 5% y exento
      let gravado10 = BigInt(0);
      let gravado5 = BigInt(0);
      let exento = BigInt(0);
      let iva10 = BigInt(0);
      let iva5 = BigInt(0);

      for (const item of items) {
        if (item.iva_porcentaje === 10) {
          const ivaItem = (item.subtotal * BigInt(10)) / BigInt(110);
          iva10 += ivaItem;
          gravado10 += item.subtotal - ivaItem;
        } else if (item.iva_porcentaje === 5) {
          const ivaItem = (item.subtotal * BigInt(5)) / BigInt(105);
          iva5 += ivaItem;
          gravado5 += item.subtotal - ivaItem;
        } else {
          exento += item.subtotal;
        }
      }

      const ivaBoxX = 50 + pageWidth - 220;
      const ivaBoxW = 220;

      doc
        .rect(ivaBoxX, doc.y, ivaBoxW, 90)
        .fillAndStroke('#f7fafc', '#e2e8f0');

      const iy = doc.y + 8;
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#000000')
        .text('Gravado 10%:', ivaBoxX + 8, iy)
        .text(formatGs(gravado10), ivaBoxX + 8, iy, { width: ivaBoxW - 16, align: 'right' });

      doc
        .text('Gravado 5%:', ivaBoxX + 8, iy + 14)
        .text(formatGs(gravado5), ivaBoxX + 8, iy + 14, { width: ivaBoxW - 16, align: 'right' });

      doc
        .text('Exento:', ivaBoxX + 8, iy + 28)
        .text(formatGs(exento), ivaBoxX + 8, iy + 28, { width: ivaBoxW - 16, align: 'right' });

      doc
        .text('IVA 10%:', ivaBoxX + 8, iy + 42)
        .text(formatGs(iva10), ivaBoxX + 8, iy + 42, { width: ivaBoxW - 16, align: 'right' });

      doc
        .text('IVA 5%:', ivaBoxX + 8, iy + 56)
        .text(formatGs(iva5), ivaBoxX + 8, iy + 56, { width: ivaBoxW - 16, align: 'right' });

      doc.y += 90 + 8;

      // ── TOTAL ─────────────────────────────────────────────────────────────────
      const totalBoxX = 50 + pageWidth - 220;

      doc
        .rect(totalBoxX, doc.y, 220, 32)
        .fill('#1a202c');

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('TOTAL', totalBoxX + 8, doc.y + 7, { continued: true })
        .text(formatGs(factura.total), totalBoxX + 8, doc.y, { width: 204, align: 'right' });

      doc.fillColor('#000000');
      doc.y += 40;

      // ── PIE DE PÁGINA ─────────────────────────────────────────────────────────
      const footerY = doc.page.height - 60;
      doc
        .moveTo(50, footerY)
        .lineTo(50 + pageWidth, footerY)
        .strokeColor('#cccccc')
        .stroke();

      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor('#999999')
        .text(
          `Este documento es válido como comprobante fiscal. Timbrado vigente según DNIT. Generado el ${formatFecha(new Date())}.`,
          50,
          footerY + 8,
          { align: 'center', width: pageWidth }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
