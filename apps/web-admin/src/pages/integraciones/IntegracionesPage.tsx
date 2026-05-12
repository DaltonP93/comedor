import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageBack } from '../../components/UI/PageBack';

export function IntegracionesPage() {
  useEffect(() => {
    if (window.location.hash === '#facturas') {
      document.getElementById('facturas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <PageBack to="/dashboard" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integraciones</h1>
            <p className="text-sm text-gray-500">
              Flujos de POS, cobros digitales y facturación electrónica (lineamiento operativo).
            </p>
          </div>
        </div>
        <Link
          to="/configuracion"
          className="text-sm font-medium text-[#0c3c6e] underline-offset-2 hover:underline"
        >
          Parámetros en configuración →
        </Link>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">1. POS y cobros en caja</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
          <li>
            <strong>POS sin API:</strong> en cada venta el cajero registra forma de pago POS, voucher y autorización manualmente (conciliación posterior).
          </li>
          <li>
            <strong>POS con API/SDK:</strong> cuando exista integración certificada, el monto se envía al terminal y la respuesta aprueba o rechaza el cobro en el mismo flujo de{' '}
            <Link className="text-blue-600 hover:underline" to="/ventas/nueva">
              Nueva venta
            </Link>
            .
          </li>
          <li>
            <strong>Pago mixto:</strong> combinar efectivo, tarjeta/QR y libreta en una misma venta según política del comedor.
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">2. Pasarelas y cobros online</h2>
        <p className="mt-2 text-sm text-gray-600">
          Flujo estándar: crear orden de pago → cliente paga en checkout del proveedor (Bancard vPOS, Pagopar, etc.) → webhook confirma → el sistema marca el pago y habilita entrega o
          facturación.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Las claves y URLs de webhook se definen por entorno en variables de servidor (ver README del proyecto: <code className="rounded bg-gray-100 px-1">PAYMENT_PROVIDER</code>,{' '}
          <code className="rounded bg-gray-100 px-1">BANCARD_*</code>, <code className="rounded bg-gray-100 px-1">PAGOPAR_*</code>).
        </p>
      </section>

      <section id="facturas" className="scroll-mt-24 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">3. Facturas electrónicas y envío</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
          <li>
            Tras venta confirmada, emitir comprobante fiscal (CDC SIFEN o proveedor homologado) y guardar XML/PDF.
          </li>
          <li>
            Envío al cliente por correo, WhatsApp o descarga desde{' '}
            <Link className="text-blue-600 hover:underline" to="/ventas">
              Ventas
            </Link>{' '}
            / portal del cliente cuando esté habilitado.
          </li>
          <li>
            API de facturas en backend: <code className="rounded bg-gray-100 px-1">POST /facturas</code> — la UI de administración puede ampliarse con pantalla dedicada de comprobantes.
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Este módulo documenta el flujo acordado con el negocio. La conexión real con cada proveedor (tokens, webhooks, impresión fiscal) se implementa por fases sobre la API existente.
      </section>
    </div>
  );
}
