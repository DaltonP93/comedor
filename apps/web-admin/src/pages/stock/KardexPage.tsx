import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { stockApi, productosApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Alert } from '../../components/UI/Alert';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Pagination } from '../../components/UI/Pagination';
import { formatGs, formatFechaHora, getErrorMessage } from '../../lib/utils';

export function KardexPage() {
  const { productoId } = useParams();
  const navigate = useNavigate();
  const [producto, setProducto] = useState<Record<string, unknown> | null>(null);
  const [movimientos, setMovimientos] = useState<Array<Record<string, unknown>>>([]);
  const [stockActual, setStockActual] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });

  useEffect(() => {
    loadData();
  }, [productoId, page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, kardexRes] = await Promise.all([
        productosApi.obtener(parseInt(productoId!)),
        stockApi.kardex(parseInt(productoId!), { page, limit: 30 }),
      ]);
      setProducto(prodRes.data.data as Record<string, unknown>);
      setMovimientos(kardexRes.data.data as Array<Record<string, unknown>>);
      setStockActual(kardexRes.data.stockActual as number ?? 0);
      setMeta(kardexRes.data.meta || { total: 0, totalPages: 1 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!producto) return <Alert type="error">{error}</Alert>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/stock')}>← Volver</Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kardex - {String(producto.nombre)}</h1>
          <p className="text-gray-500 text-sm">Historial de movimientos de stock</p>
        </div>
        <div className="ml-auto bg-white rounded-lg border border-gray-200 px-4 py-2">
          <p className="text-xs text-gray-500">Stock actual</p>
          <p className={`text-xl font-bold ${stockActual <= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stockActual} {String(producto.unidad_medida)}
          </p>
        </div>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo unit.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observación</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {movimientos.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-500">Sin movimientos</td></tr>
            ) : (
              movimientos.map((mov) => {
                const cantidad = Number(mov.cantidad);
                const isEntrada = cantidad > 0;
                return (
                  <tr key={String(mov.id)} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-500">{formatFechaHora(String(mov.creado_en))}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${isEntrada ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {String(mov.tipo_movimiento)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {mov.referencia_tipo ? `${mov.referencia_tipo} #${mov.referencia_id}` : '-'}
                    </td>
                    <td className={`px-6 py-3 text-right font-semibold text-sm ${isEntrada ? 'text-green-600' : 'text-red-600'}`}>
                      {isEntrada ? '+' : ''}{cantidad}
                    </td>
                    <td className="px-6 py-3 text-right text-sm">{mov.costo_unitario ? formatGs(Number(mov.costo_unitario)) : '-'}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{String(mov.observacion || '-')}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {mov.usuario ? String((mov.usuario as Record<string, unknown>).nombre) : '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={30} onPageChange={setPage} />
      </div>
    </div>
  );
}
