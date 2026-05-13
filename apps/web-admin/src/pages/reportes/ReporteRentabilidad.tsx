import React, { useState } from 'react';
import { reportesApi } from '../../api/endpoints';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Alert } from '../../components/UI/Alert';
import { LoadingSpinner } from '../../components/UI/LoadingSpinner';
import { formatGs, hoyISO, getErrorMessage } from '../../lib/utils';

interface ProductoRentabilidad {
  producto_id: number;
  nombre: string;
  unidades_vendidas: number;
  total_vendido: number;
  costo_total: number;
  ganancia: number;
  margen_pct: number;
}

interface ResumenRentabilidad {
  total_ingresos: number;
  total_costos: number;
  ganancia_total: number;
  margen_promedio: number;
}

function colorMargen(pct: number): string {
  if (pct >= 30) return 'text-green-600 font-semibold';
  if (pct >= 10) return 'text-yellow-600 font-semibold';
  return 'text-red-600 font-semibold';
}

function badgeMargen(pct: number): string {
  if (pct >= 30) return 'bg-green-100 text-green-800';
  if (pct >= 10) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

export default function ReporteRentabilidad() {
  const hoy = hoyISO();
  const [fechaDesde, setFechaDesde] = useState(hoy);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [productos, setProductos] = useState<ProductoRentabilidad[]>([]);
  const [resumen, setResumen] = useState<ResumenRentabilidad | null>(null);
  const [generado, setGenerado] = useState(false);

  async function generar() {
    setCargando(true);
    setError('');
    try {
      const res = await reportesApi.rentabilidad({
        fecha_desde: fechaDesde ? new Date(fechaDesde).toISOString() : undefined,
        fecha_hasta: fechaHasta ? new Date(fechaHasta + 'T23:59:59').toISOString() : undefined,
      });
      const data = res.data.data;
      setProductos(data.productos as ProductoRentabilidad[]);
      setResumen(data.resumen as ResumenRentabilidad);
      setGenerado(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCargando(false);
    }
  }

  function exportarCSV() {
    if (!productos.length) return;
    const cabecera = ['Producto', 'Unidades vendidas', 'Ingresos (Gs)', 'Costos (Gs)', 'Ganancia (Gs)', 'Margen %'];
    const filas = productos.map((p) => [
      p.nombre,
      p.unidades_vendidas,
      p.total_vendido,
      p.costo_total,
      p.ganancia,
      p.margen_pct.toFixed(2),
    ]);
    const csv = [cabecera, ...filas].map((fila) => fila.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentabilidad_${fechaDesde}_${fechaHasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rentabilidad por Producto</h1>
        <p className="text-gray-500 text-sm">Analisis de margen de ganancia por producto en un periodo</p>
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
            <Button onClick={generar} loading={cargando}>Generar reporte</Button>
            {generado && (
              <Button variant="secondary" onClick={exportarCSV}>Exportar CSV</Button>
            )}
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
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <div className="p-4">
                <p className="text-xs text-gray-500 uppercase mb-1">Total ingresos</p>
                <p className="text-xl font-bold text-blue-600">{formatGs(resumen.total_ingresos)}</p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-xs text-gray-500 uppercase mb-1">Total costos</p>
                <p className="text-xl font-bold text-red-600">{formatGs(resumen.total_costos)}</p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-xs text-gray-500 uppercase mb-1">Ganancia total</p>
                <p className={`text-xl font-bold ${resumen.ganancia_total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatGs(resumen.ganancia_total)}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-xs text-gray-500 uppercase mb-1">Margen promedio</p>
                <p className={`text-xl font-bold ${colorMargen(resumen.margen_promedio)}`}>
                  {resumen.margen_promedio.toFixed(1)}%
                </p>
              </div>
            </Card>
          </div>

          {/* Tabla de productos */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800">
                Detalle por producto — {productos.length} producto{productos.length !== 1 ? 's' : ''} vendido{productos.length !== 1 ? 's' : ''}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unidades</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costos</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ganancia</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {productos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Sin ventas en el periodo seleccionado
                      </td>
                    </tr>
                  ) : (
                    productos.map((p) => (
                      <tr key={p.producto_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.nombre}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{p.unidades_vendidas}</td>
                        <td className="px-4 py-3 text-right text-blue-700">{formatGs(p.total_vendido)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatGs(p.costo_total)}</td>
                        <td className={`px-4 py-3 text-right ${p.ganancia >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatGs(p.ganancia)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeMargen(p.margen_pct)}`}>
                            {p.margen_pct.toFixed(1)}%
                          </span>
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
    </div>
  );
}
