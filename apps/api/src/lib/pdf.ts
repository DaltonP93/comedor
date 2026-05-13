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

export async function generarPDFEstadoCuenta(data: {
  libreta: {
    id: number;
    tipo: string;
    saldo_actual: bigint;
    limite_credito: bigint;
    cliente: { nombre: string; documento_numero?: string | null };
  };
  movimientos: Array<{
    fecha_movimiento: Date;
    descripcion?: string | null;
    monto_debe: bigint;
    monto_haber: bigint;
    saldo_resultante: bigint;
  }>;
  periodo: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100; // accounting for margins

      // ── ENCABEZADO ──────────────────────────────────────────────────────────
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('COMEDOR', 50, 50, { align: 'center' });

      doc
        .fontSize(14)
        .font('Helvetica')
        .text('ESTADO DE CUENTA', 50, 78, { align: 'center' });

      // Línea divisoria
      doc
        .moveTo(50, 102)
        .lineTo(50 + pageWidth, 102)
        .strokeColor('#cccccc')
        .stroke();

      // ── DATOS DEL CLIENTE ────────────────────────────────────────────────────
      doc.y = 115;
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('DATOS DEL CLIENTE', 50, doc.y);

      doc.y += 4;
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Cliente: `, 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(data.libreta.cliente.nombre);

      if (data.libreta.cliente.documento_numero) {
        doc
          .font('Helvetica')
          .text(`Documento: `, 50, doc.y, { continued: true })
          .font('Helvetica-Bold')
          .text(data.libreta.cliente.documento_numero);
      }

      doc
        .font('Helvetica')
        .text(`Libreta N°: `, 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(String(data.libreta.id), { continued: true })
        .font('Helvetica')
        .text(`   Tipo: `, { continued: true })
        .font('Helvetica-Bold')
        .text(data.libreta.tipo);

      doc
        .font('Helvetica')
        .text(`Período: `, 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(data.periodo);

      // ── CAJA RESUMEN ─────────────────────────────────────────────────────────
      doc.y += 12;
      const boxTop = doc.y;
      const boxHeight = 90;

      doc
        .roundedRect(50, boxTop, pageWidth, boxHeight, 4)
        .fillAndStroke('#f8f9fa', '#dee2e6');

      // Calcular totales del periodo
      let totalCargos = BigInt(0);
      let totalPagos = BigInt(0);
      for (const mov of data.movimientos) {
        totalCargos += mov.monto_debe;
        totalPagos += mov.monto_haber;
      }

      const saldoAnterior = data.movimientos.length > 0
        ? data.movimientos[data.movimientos.length - 1].saldo_resultante - data.movimientos[data.movimientos.length - 1].monto_debe + data.movimientos[data.movimientos.length - 1].monto_haber
        : data.libreta.saldo_actual;

      const col1 = 65;
      const col2 = 300;
      const rowH = 18;
      let ry = boxTop + 12;

      doc.fillColor('#000000');

      doc
        .fontSize(9)
        .font('Helvetica')
        .text('Saldo anterior:', col1, ry)
        .text(formatGs(saldoAnterior), col2, ry);
      ry += rowH;

      doc
        .font('Helvetica')
        .text('Cargos del período:', col1, ry)
        .text(formatGs(totalCargos), col2, ry);
      ry += rowH;

      doc
        .font('Helvetica')
        .text('Pagos del período:', col1, ry)
        .text(formatGs(totalPagos), col2, ry);
      ry += rowH;

      // Línea separadora dentro del cuadro
      doc
        .moveTo(col1, ry)
        .lineTo(col1 + pageWidth - 30, ry)
        .strokeColor('#cccccc')
        .stroke();
      ry += 6;

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('TOTAL A PAGAR:', col1, ry)
        .text(formatGs(data.libreta.saldo_actual), col2, ry);

      // ── TABLA DE MOVIMIENTOS ─────────────────────────────────────────────────
      doc.y = boxTop + boxHeight + 16;

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('MOVIMIENTOS DEL PERÍODO', 50, doc.y);

      doc.y += 8;

      // Cabecera de tabla
      const tableTop = doc.y;
      const colFecha = 50;
      const colDesc = 130;
      const colDebe = 320;
      const colHaber = 400;
      const colSaldo = 480;

      doc
        .rect(50, tableTop, pageWidth, 18)
        .fill('#343a40');

      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .text('FECHA', colFecha + 2, tableTop + 4)
        .text('DESCRIPCIÓN', colDesc + 2, tableTop + 4)
        .text('DEBE', colDebe + 2, tableTop + 4)
        .text('HABER', colHaber + 2, tableTop + 4)
        .text('SALDO', colSaldo + 2, tableTop + 4);

      doc.y = tableTop + 18;

      if (data.movimientos.length === 0) {
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#666666')
          .text('Sin movimientos en el período', 50, doc.y + 8, { align: 'center', width: pageWidth });
        doc.y += 24;
      } else {
        // Filas de movimientos (de más antiguo a más reciente)
        const movimientosOrdenados = [...data.movimientos].reverse();
        let rowIndex = 0;
        for (const mov of movimientosOrdenados) {
          const rowTop = doc.y;
          const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';

          doc.rect(50, rowTop, pageWidth, 16).fill(bgColor);

          const descripcion = (mov.descripcion || '-').substring(0, 30);
          const debe = mov.monto_debe > BigInt(0) ? formatGs(mov.monto_debe) : '-';
          const haber = mov.monto_haber > BigInt(0) ? formatGs(mov.monto_haber) : '-';

          doc
            .fontSize(8)
            .font('Helvetica')
            .fillColor('#000000')
            .text(formatFecha(new Date(mov.fecha_movimiento)), colFecha + 2, rowTop + 3)
            .text(descripcion, colDesc + 2, rowTop + 3, { width: colDebe - colDesc - 8 })
            .text(debe, colDebe + 2, rowTop + 3, { width: colHaber - colDebe - 4 })
            .text(haber, colHaber + 2, rowTop + 3, { width: colSaldo - colHaber - 4 })
            .text(formatGs(mov.saldo_resultante), colSaldo + 2, rowTop + 3, { width: 50 + pageWidth - colSaldo - 4 });

          doc.y = rowTop + 16;
          rowIndex++;

          // Nueva página si se acaba el espacio
          if (doc.y > doc.page.height - 100) {
            doc.addPage();
            doc.y = 50;
          }
        }
      }

      // Borde de tabla
      doc
        .rect(50, tableTop, pageWidth, doc.y - tableTop)
        .strokeColor('#dee2e6')
        .stroke();

      // ── PIE DE PÁGINA ────────────────────────────────────────────────────────
      const footerY = doc.page.height - 60;
      doc
        .moveTo(50, footerY)
        .lineTo(50 + pageWidth, footerY)
        .strokeColor('#cccccc')
        .stroke();

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#999999')
        .text(
          `Generado el ${formatFecha(new Date())}`,
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
