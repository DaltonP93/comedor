import React, { useState, useEffect } from 'react';
import { reportesApi, sucursalesApi } from '../../api/endpoints';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Select } from '../../components/UI/Select';
import { LoadingSpinner } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { formatFecha, hoyISO, getErrorMessage } from '../../lib/utils';

interface Sucursal {
  id: number;
  nombre: string;
}

interface HistoricoItem {
  fecha: string;
  menu_id: number;
  titulo: string;
  porciones: number;
}

interface PrediccionData {
  fecha: string;
  dia_semana: string;
  historico: HistoricoItem[];
  promedio: number;
  maximo: number;
  minimo: number;
  prediccion: number;
  reservas_ya_confirmadas: number;
  produccion_sugerida: number;
}

export default function ReportePrediccion() {
  const manana = (() => {
    const d = new Date(hoyISO());
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  const [fecha, setFecha] = useState(manana);
  const [sucursalId, setSucursalId] = useState('');
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState<PrediccionData | null>(null);

  useEffect(() => {
    sucursalesApi.listar().then((res) => {
      setSucursales(res.data.data as Sucursal[]);
    }).catch(() => {});
  }, []);

  async function calcular() {
    setCargando(true);
    setError('');
    try {
      const params: Record<string, unknown> = { fecha };
      if (sucursalId) params.sucursal_id = parseInt(sucursalId);
      const res = await reportesApi.prediccion(params);
      setDatos(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCargando(false);
    }
  }

  function aplicarCupo() {
    alert('Funcionalidad de aplicar cupo al menú estará disponible cuando se seleccione el menú objetivo.');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Predicción de Demanda</h1>
        <p className="text-gray-500 text-sm">Calcula la producción sugerida basada en el historial de las últimas 8 semanas</p>
      </div>

      {/* Filtros */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha objetivo</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <Select
                label="Sucursal (opcional)"
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
                options={[
                  { value: '', label: 'Todas las sucursales' },
                  ...sucursales.map((s) => ({ value: String(s.id), label: s.nombre })),
                ]}
              />
            </div>
            <div>
              <Button onClick={calcular} disabled={cargando} className="w-full">
                {cargando ? 'Calculando…' : 'Calcular predicción'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {error && <Alert type="error">{error}</Alert>}

      {cargando && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {datos && !cargando && (
        <>
          {/* Resumen principal */}
          <Card>
            <div className="p-6 text-center">
              <p className="text-sm text-gray-500 mb-1">
                {datos.dia_semana} {formatFecha(datos.fecha)}
              </p>
              <p className="text-4xl font-bold text-blue-600 mb-1">{datos.produccion_sugerida}</p>
              <p className="text-lg text-gray-700 font-medium">porciones de producción sugerida</p>
              <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm text-gray-600">
                <span>Predicción base: <strong>{datos.prediccion}</strong></span>
                <span>Ya reservadas: <strong>{datos.reservas_ya_confirmadas}</strong></span>
                <span>Promedio histórico: <strong>{datos.promedio}</strong></span>
              </div>
              <div className="mt-4">
                <Button variant="secondary" onClick={aplicarCupo}>
                  Aplicar como cupo del menú
                </Button>
              </div>
            </div>
          </Card>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Promedio histórico', value: datos.promedio, color: 'text-blue-600' },
              { label: 'Máximo histórico', value: datos.maximo, color: 'text-green-600' },
              { label: 'Mínimo histórico', value: datos.minimo, color: 'text-orange-600' },
              { label: 'Predicción (+10%)', value: datos.prediccion, color: 'text-purple-600' },
            ].map((stat) => (
              <Card key={stat.label}>
                <div className="p-4 text-center">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Tabla histórica */}
          <Card>
            <div className="p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Historial de las últimas 8 semanas ({datos.dia_semana}s)
              </h2>
              {datos.historico.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  No hay datos históricos para este día de la semana en las últimas 8 semanas.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Fecha</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Menú</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">Porciones reales</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">vs. promedio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.historico.map((item) => {
                        const diff = item.porciones - datos.promedio;
                        return (
                          <tr key={item.menu_id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-3 text-gray-700">{formatFecha(item.fecha)}</td>
                            <td className="py-2 px-3 text-gray-700">{item.titulo}</td>
                            <td className="py-2 px-3 text-right font-medium text-gray-900">{item.porciones}</td>
                            <td className={`py-2 px-3 text-right font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {diff >= 0 ? '+' : ''}{Math.round(diff * 10) / 10}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
