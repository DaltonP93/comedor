import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { stockApi, categoriasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Select } from '../../components/UI/Select';
import { Alert } from '../../components/UI/Alert';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { formatGs, getErrorMessage } from '../../lib/utils';

interface StockItem {
  id: number;
  nombre: string;
  codigo: string | null;
  categoria: { nombre: string } | null;
  unidad_medida: string;
  costo_promedio: number | string;
  stock_actual: number;
  stock_minimo: number;
}

interface Categoria { id: number; nombre: string; }

export function StockPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StockItem[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [soloAlert, setSoloAlert] = useState(false);

  useEffect(() => {
    categoriasApi.listar({ activo: 'true' }).then((res) => {
      setCategorias(res.data.data as Categoria[]);
    });
  }, []);

  const loadStock = useCallback(async () => {
    setLoading(true);
    try {
      const res = await stockApi.listar({
        categoria_id: categoriaId || undefined,
        bajo_minimo: soloAlert ? 'true' : undefined,
      });
      setItems(res.data.data as StockItem[]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [categoriaId, soloAlert]);

  useEffect(() => { loadStock(); }, [loadStock]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
          <p className="text-gray-500 text-sm">Niveles de inventario</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/stock/entrada')}>
            + Entrada mercadería
          </Button>
        </div>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="w-48">
            <Select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              options={[{ value: '', label: 'Todas las categorías' }, ...categorias.map((c) => ({ value: c.id, label: c.nombre }))]}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="alerta" checked={soloAlert} onChange={(e) => setSoloAlert(e.target.checked)} className="h-4 w-4" />
            <label htmlFor="alerta" className="text-sm text-gray-700">Solo productos con alerta</label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock actual</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mínimo</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-gray-500">Sin productos con stock</td>
              </tr>
            ) : (
              items.map((item) => {
                const nivel = item.stock_actual <= 0 ? 'sin_stock' : item.stock_actual <= item.stock_minimo ? 'bajo' : 'ok';
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{item.nombre}</p>
                      <p className="text-xs text-gray-500">{item.codigo || ''}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.categoria?.nombre || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-bold ${nivel === 'sin_stock' ? 'text-red-600' : nivel === 'bajo' ? 'text-yellow-600' : 'text-green-600'}`}>
                        {item.stock_actual} {item.unidad_medida}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-500">{item.stock_minimo}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      {formatGs(Number(item.costo_promedio) * item.stock_actual)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {nivel === 'sin_stock' && <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Sin stock</span>}
                      {nivel === 'bajo' && <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">Stock bajo</span>}
                      {nivel === 'ok' && <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">OK</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/stock/kardex/${item.id}`} className="text-blue-600 hover:text-blue-700 text-sm">Kardex</Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
