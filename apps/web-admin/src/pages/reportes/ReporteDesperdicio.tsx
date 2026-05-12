import React, { useState } from 'react';
import { reportesApi } from '../../api/endpoints';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Alert } from '../../components/UI/Alert';
import { LoadingSpinner } from '../../components/UI/LoadingSpinner';
import { formatGs, hoyISO, getErrorMessage } from '../../lib/utils';

interface ProductoDesperdicio {
  producto_id: number;
  nombre: string;
  unidad_medida: string;
  entrada_periodo: number;
  salida_periodo: number;
  saldo_teorico: number;
  stock_actual: number;
  diferencia: number;
  valor_perdida_estimada: number;
}

interface ResumenDesperdicio {
  total_productos_con_merma: number;
  valor_perdida_total_estimada: number;
}

// Umbral a partir del cual se muestra la alerta de perdida significativa (en Gs.)
const UMBRAL_ALERTA = 500_000;

export default function ReporteDesperdicio() {
  const hoy = hoyISO();
  const primerDiaMes = hoy.substring(0, 8) + '01';
  const [fechaDesde, setFechaDesde] = useState(primerDiaMes);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [productos, setProductos] = useState<ProductoDesperdicio[]>([]);
  const [resumen, setResumen] = useState<ResumenDesperdicio | null>(null);
  const [generado, setGenerado] = useState(false);

  async function generar() {
    setCargando(true);
    setError('');
    try {
      const res = await reportesApi.desperdicio({
        fecha_desde: fechaDesde ? new Date(fechaDesde).toISOString() : undefined,
        fecha_hasta: fechaHasta ? new Date(fechaHasta + 'T23:59:59').toISOString() : undefined,
      });
      const data = res.data.data;
      setProductos(data.productos as ProductoDesperdicio[]);
      setResumen(data.resumen as ResumenDesperdicio);
      setGenerado(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCargando(false);
    }
  }

  const alertaActiva = resumen && resumen.valor_perdida_total_estimada > UMBRAL_ALERTA;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Desperdicio y Merma</h1>
        <p className="text-gray-500 text-sm">
          Compara entradas de compras con salidas de ventas y recetas para detectar posibles perdidas de stock
        </p>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Filtros */}
      <Card>
        <div className="p-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button onClick={generar} loading={cargando}>Analizar desperdicio</Button>
          </div>
        </div>
      </Card>

      {cargando && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {generado && resumen && !cargando && (
        <>
          {/* Alerta si la perdida supera el umbral */}
          {alertaActiva && (
            <Alert type="error">
              Atencion: se detectaron perdidas de stock estimadas en{' '}
              <strong>{formatGs(resumen.valor_perdida_total_estimada)}</strong>, lo que supera el umbral de{' '}
              {formatGs(UMBRAL_ALERTA)}. Revisar inventario fisico.
            </Alert>
          )}

          {/* Tarjetas resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <div className="p-4">
                <p className="text-xs text-gray-500 uppercase mb-1">Productos con posible merma</p>
                <p className="text-3xl font-bold text-orange-600">{resumen.total_productos_con_merma}</p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-xs text-gray-500 uppercase mb-1">Valor perdida estimada total</p>
                <p className={`text-2xl font-bold ${alertaActiva ? 'text-red-600' : 'text-orange-600'}`}>
                  {formatGs(resumen.valor_perdida_total_estimada)}
                </p>
              </div>
            </Card>
          </div>

          {/* Tabla de productos */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800">
                Productos con saldo teorico mayor al stock real
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Solo se muestran productos donde (entradas - salidas del periodo) &gt; stock actual acumulado
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entradas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Salidas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo teorico</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock real</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Diferencia</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor perdida est.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {productos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        No se detectaron diferencias de stock en el periodo. Buen trabajo.
                      </td>
                    </tr>
                  ) : (
                    productos.map((p) => (
                      <tr key={p.producto_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {p.nombre}
                          <span className="ml-1 text-xs text-gray-400">{p.unidad_medida}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-green-700">+{p.entrada_periodo}</td>
                        <td className="px-4 py-3 text-right text-red-700">-{p.salida_periodo}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{p.saldo_teorico}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{p.stock_actual}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-600">
                          {p.diferencia > 0 ? '+' : ''}{p.diferencia}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {formatGs(p.valor_perdida_estimada)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {generado && productos.length === 0 && !cargando && (
        <Alert type="success">
          No se detectaron diferencias significativas de stock en el periodo analizado.
        </Alert>
      )}
    </div>
  );
}
