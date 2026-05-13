import React, { useState } from 'react';
import { reportesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { PageBack } from '../../components/UI/PageBack';
import { Alert } from '../../components/UI/Alert';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { formatGs, getErrorMessage } from '../../lib/utils';

interface LibretaReporte {
  id: number;
  tipo: string;
  estado: string;
  saldo_actual: number | string;
  saldo_vencido: number | string;
  limite_credito: number | string;
  cliente: { nombre: string; documento_numero: string | null };
  empresa: { nombre: string } | null;
}

interface Resumen { total_libretas: number; total_deuda: number; total_vencido: number; total_limite: number; }

export function ReporteLibreta() {
  const [libretas, setLibretas] = useState<LibretaReporte[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generado, setGenerado] = useState(false);

  const generar = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportesApi.libreta({ estado: 'ACTIVA' });
      setLibretas(res.data.data.libretas as LibretaReporte[]);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <PageBack to="/reportes" />
          <h1 className="text-2xl font-bold text-gray-900">Cuentas Corrientes</h1>
        </div>
        <Button onClick={generar} loading={loading}>Generar reporte</Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {generado && resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total libretas</p>
            <p className="text-2xl font-bold">{resumen.total_libretas}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total deuda</p>
            <p className="text-xl font-bold text-red-600">{formatGs(resumen.total_deuda)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Deuda vencida</p>
            <p className="text-xl font-bold text-red-700">{formatGs(resumen.total_vencido)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Límite total</p>
            <p className="text-xl font-bold">{formatGs(resumen.total_limite)}</p>
          </div>
        </div>
      )}

      {generado && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Límite</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Disponible</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {libretas.map((l) => {
                const disponible = Number(l.limite_credito) - Number(l.saldo_actual);
                const badge = estadoBadge(l.estado);
                return (
                  <tr key={l.id} className={Number(l.saldo_vencido) > 0 ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{l.cliente.nombre}</p>
                      <p className="text-xs text-gray-500">{l.cliente.documento_numero || l.empresa?.nombre || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{l.tipo}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{formatGs(Number(l.saldo_actual))}</td>
                    <td className="px-4 py-3 text-right">{formatGs(Number(l.limite_credito))}</td>
                    <td className={`px-4 py-3 text-right font-medium ${disponible <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatGs(disponible)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
