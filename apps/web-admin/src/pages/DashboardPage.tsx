import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportesApi } from '../api/endpoints';
import { StatCard } from '../components/UI/Card';
import { PageLoader } from '../components/UI/LoadingSpinner';
import { Badge, estadoBadge } from '../components/UI/Badge';
import { formatGs, formatFechaHora, getErrorMessage } from '../lib/utils';
import { Alert } from '../components/UI/Alert';

interface DashboardData {
  ventas_hoy: { total: number; cantidad: number };
  reservas_hoy: Record<string, number>;
  stock_critico: Array<{ id: number; nombre: string; stock_actual: number }>;
  deudas_vencidas: { total: number; cantidad: number };
  ultimas_ventas: Array<{
    id: number;
    total: number | string;
    estado: string;
    tipo_venta: string;
    creado_en: string;
    cliente?: { nombre: string } | null;
    usuario?: { nombre: string } | null;
  }>;
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await reportesApi.dashboard();
      setData(res.data.data as DashboardData);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return null;

  const totalReservas = Object.values(data.reservas_hoy).reduce((a, b) => a + b, 0);
  const reservasConfirmadas = data.reservas_hoy['CONFIRMADA'] || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen del día - {new Date().toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ventas del día"
          value={formatGs(data.ventas_hoy.total)}
          subtitle={`${data.ventas_hoy.cantidad} transacciones`}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <StatCard
          title="Reservas hoy"
          value={totalReservas}
          subtitle={`${reservasConfirmadas} confirmadas`}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          title="Stock crítico"
          value={data.stock_critico.length}
          subtitle="Productos bajo mínimo"
          color="yellow"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
        <StatCard
          title="Deudas vencidas"
          value={formatGs(data.deudas_vencidas.total)}
          subtitle={`${data.deudas_vencidas.cantidad} libretas`}
          color="red"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent sales */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Últimas ventas</h3>
            <Link to="/ventas" className="text-sm text-blue-600 hover:text-blue-700">
              Ver todas
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data.ultimas_ventas.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-500 text-sm">Sin ventas hoy</p>
            ) : (
              data.ultimas_ventas.map((venta) => {
                const badge = estadoBadge(venta.estado);
                return (
                  <Link
                    key={venta.id}
                    to={`/ventas`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {venta.cliente?.nombre || 'Cliente anónimo'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {venta.tipo_venta} · {formatFechaHora(venta.creado_en)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatGs(Number(venta.total))}</p>
                      <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Stock crítico */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Stock crítico</h3>
            <Link to="/stock" className="text-sm text-blue-600 hover:text-blue-700">
              Ver stock
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data.stock_critico.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-500 text-sm">Sin alertas de stock</p>
            ) : (
              data.stock_critico.map((prod) => (
                <div key={prod.id} className="flex items-center justify-between px-6 py-3">
                  <p className="text-sm font-medium text-gray-900">{prod.nombre}</p>
                  <span className={`text-sm font-semibold ${prod.stock_actual <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                    {prod.stock_actual <= 0 ? 'Sin stock' : `${prod.stock_actual} uds.`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reservas por estado */}
      {totalReservas > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Reservas por estado</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(data.reservas_hoy).map(([estado, count]) => {
              const badge = estadoBadge(estado);
              return (
                <div key={estado} className="flex items-center gap-2">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <span className="text-sm font-medium text-gray-700">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
