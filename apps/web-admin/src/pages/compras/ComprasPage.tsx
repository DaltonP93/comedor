import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { comprasApi, proveedoresApi, productosApi } from '../../api/endpoints';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { Button } from '../../components/UI/Button';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { formatGs, formatFecha, getErrorMessage } from '../../lib/utils';

interface Compra {
  id: number;
  proveedor_id: number;
  fecha: string;
  numero_factura: string | null;
  subtotal: string;
  iva_total: string;
  total: string;
  estado: string;
  proveedor?: { nombre: string };
  usuario?: { nombre: string };
}

export function ComprasPage() {
  const { hasPermiso } = useAuth();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await comprasApi.listar();
      setCompras(res.data.data as Compra[]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          <p className="text-gray-500 text-sm mt-1">Registro de compras a proveedores</p>
        </div>
        {hasPermiso('COMPRAS:CREAR') && (
          <Link to="/compras/nueva">
            <Button>+ Nueva Compra</Button>
          </Link>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nro. Factura</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {compras.map((c) => {
              const badge = estadoBadge(c.estado);
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{c.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatFecha(c.fecha)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.proveedor?.nombre || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.numero_factura || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatGs(Number(c.total))}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                  </td>
                </tr>
              );
            })}
            {compras.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No hay compras registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
