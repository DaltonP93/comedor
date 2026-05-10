import React, { useState } from 'react';
import { reportesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Alert } from '../../components/UI/Alert';
import { formatGs, formatFechaHora, getErrorMessage, hoyISO } from '../../lib/utils';

interface VentaReporte {
  id: number;
  tipo_venta: string;
  estado: string;
  total: number | string;
  subtotal: number | string;
  iva_total: number | string;
  creado_en: string;
  cliente: { nombre: string } | null;
  usuario: { nombre: string } | null;
}

interface Resumen { total_ventas: number; total_monto: number; total_iva: number; total_descuento: number; }

export function ReporteVentas() {
  const [ventas, setVentas] = useState<VentaReporte[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fechaDesde, setFechaDesde] = useState(hoyISO());
  const [fechaHasta, setFechaHasta] = useState(hoyISO());
  const [generado, setGenerado] = useState(false);

  const generar = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportesApi.ventas({
        fecha_desde: fechaDesde ? new Date(fechaDesde).toISOString() : undefined,
        fecha_hasta: fechaHasta ? new Date(fechaHasta + 'T23:59:59').toISOString() : undefined,
      });
      setVentas(res.data.data.ventas as VentaReporte[]);
      setResumen(res.data.data.resumen as Resumen);
      setGenerado(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Reporte de Ventas</h1>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 flex-wrap items-end">
          <Input type="date" label="Desde" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          <Input type="date" label="Hasta" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          <Button onClick={generar} loading={loading}>Generar reporte</Button>
        </div>
      </div>

      {generado && resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total ventas</p>
            <p className="text-2xl font-bold">{resumen.total_ventas}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Monto total</p>
            <p className="text-xl font-bold text-blue-600">{formatGs(resumen.total_monto)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">IVA total</p>
            <p className="text-xl font-bold">{formatGs(resumen.total_iva)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Descuentos</p>
            <p className="text-xl font-bold text-red-600">{formatGs(resumen.total_descuento)}</p>
          </div>
        </div>
      )}

      {generado && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ventas.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Sin ventas en el período</td></tr>
              ) : (
                ventas.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">#{v.id}</td>
                    <td className="px-4 py-3">{v.cliente?.nombre || 'Anónimo'}</td>
                    <td className="px-4 py-3 text-gray-500">{v.tipo_venta}</td>
                    <td className="px-4 py-3 text-gray-500">{formatFechaHora(v.creado_en)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatGs(Number(v.total))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
