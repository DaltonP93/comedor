import React, { useState } from 'react';
import { reportesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Alert } from '../../components/UI/Alert';
import { formatGs, getErrorMessage } from '../../lib/utils';

interface ProductoStock {
  id: number;
  nombre: string;
  codigo: string | null;
  categoria: { nombre: string } | null;
  unidad_medida: string;
  stock_actual: number;
  valor_stock: number;
  costo_promedio: number | string;
}

interface Resumen { total_productos: number; valor_total_stock: number; productos_sin_stock: number; productos_bajo_minimo: number; }

export function ReporteStock() {
  const [productos, setProductos] = useState<ProductoStock[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generado, setGenerado] = useState(false);

  const generar = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportesApi.stock();
      setProductos(res.data.data.productos as ProductoStock[]);
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reporte de Stock</h1>
        <Button onClick={generar} loading={loading}>Generar reporte</Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {generado && resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total productos</p>
            <p className="text-2xl font-bold">{resumen.total_productos}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Valor total stock</p>
            <p className="text-xl font-bold text-blue-600">{formatGs(resumen.valor_total_stock)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Sin stock</p>
            <p className="text-2xl font-bold text-red-600">{resumen.productos_sin_stock}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Bajo mínimo</p>
            <p className="text-2xl font-bold text-yellow-600">{resumen.productos_bajo_minimo}</p>
          </div>
        </div>
      )}

      {generado && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo unit.</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {productos.map((p) => (
                <tr key={p.id} className={p.stock_actual <= 0 ? 'bg-red-50' : p.stock_actual <= 10 ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.nombre}</p>
                    <p className="text-xs text-gray-500">{p.codigo}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.categoria?.nombre || '-'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${p.stock_actual <= 0 ? 'text-red-600' : p.stock_actual <= 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {p.stock_actual} {p.unidad_medida}
                  </td>
                  <td className="px-4 py-3 text-right">{formatGs(Number(p.costo_promedio))}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatGs(p.valor_stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
