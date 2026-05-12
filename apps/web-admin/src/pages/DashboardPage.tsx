import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportesApi } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { StatCard } from '../components/UI/Card';
import { PageLoader } from '../components/UI/LoadingSpinner';
import { formatGs, getErrorMessage } from '../lib/utils';
import { Alert } from '../components/UI/Alert';

interface DashboardData {
  ventas_hoy: { total: number; cantidad: number };
  reservas_hoy: Record<string, number>;
  stock_critico: Array<{ id: number; nombre: string; stock_actual: number }>;
  deudas_vencidas: { total: number; cantidad: number };
  menus_del_dia: { total: number; publicados: number };
  ventas_mes: { total: number; cantidad: number };
  reservas_pendientes_hoy: number;
  clientes_activos: number;
  productos_activos: number;
  facturas_emitidas_hoy: number;
  ventas_sin_facturar_hoy: number;
  libretas_activas: number;
  compras_mes: number;
}

type StatColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple';

interface KpiTile {
  title: string;
  value: string | number;
  subtitle: string;
  color: StatColor;
  to: string;
  icon: React.ReactNode;
}

export function DashboardPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = async (fromRefresh = false) => {
    if (fromRefresh) setRefreshing(true);
    try {
      const res = await reportesApi.dashboard();
      const raw = res.data.data as Partial<DashboardData> & Pick<DashboardData, 'ventas_hoy' | 'reservas_hoy' | 'stock_critico' | 'deudas_vencidas'>;
      setData({
        ventas_hoy: raw.ventas_hoy,
        reservas_hoy: raw.reservas_hoy,
        stock_critico: raw.stock_critico,
        deudas_vencidas: raw.deudas_vencidas,
        menus_del_dia: raw.menus_del_dia ?? { total: 0, publicados: 0 },
        ventas_mes: raw.ventas_mes ?? { total: 0, cantidad: 0 },
        reservas_pendientes_hoy: raw.reservas_pendientes_hoy ?? 0,
        clientes_activos: raw.clientes_activos ?? 0,
        productos_activos: raw.productos_activos ?? 0,
        facturas_emitidas_hoy: raw.facturas_emitidas_hoy ?? 0,
        ventas_sin_facturar_hoy: raw.ventas_sin_facturar_hoy ?? 0,
        libretas_activas: raw.libretas_activas ?? 0,
        compras_mes: raw.compras_mes ?? 0,
      });
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBooting(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard(false);
  }, []);

  const nombreUsuario = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ').trim() || 'Usuario';
  const fechaSesion = new Date().toLocaleString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (booting) return <PageLoader />;
  if (error && !data) return <Alert type="error">{error}</Alert>;
  if (!data) return null;

  const totalReservas = Object.values(data.reservas_hoy).reduce((a, b) => a + b, 0);
  const reservasConfirmadas = data.reservas_hoy['CONFIRMADA'] || 0;

  const kpis: KpiTile[] = [
    {
      title: 'Ventas del día',
      value: formatGs(data.ventas_hoy.total),
      subtitle: `${data.ventas_hoy.cantidad} transacciones · Ver ventas`,
      color: 'blue',
      to: '/ventas',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      title: 'Ventas del mes',
      value: formatGs(data.ventas_mes.total),
      subtitle: `${data.ventas_mes.cantidad} operaciones · Reporte ventas`,
      color: 'purple',
      to: '/reportes/ventas',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: 'Reservas hoy',
      value: totalReservas,
      subtitle: `${reservasConfirmadas} confirmadas · Ver reservas`,
      color: 'green',
      to: '/reservas',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: 'Reservas pendientes hoy',
      value: data.reservas_pendientes_hoy,
      subtitle: 'Estado PENDIENTE · Gestionar en reservas',
      color: 'yellow',
      to: '/reservas',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Stock crítico',
      value: data.stock_critico.length,
      subtitle: 'Productos bajo mínimo · Ver stock',
      color: 'yellow',
      to: '/stock',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      title: 'Deudas vencidas',
      value: formatGs(data.deudas_vencidas.total),
      subtitle: `${data.deudas_vencidas.cantidad} libretas · Ver libretas`,
      color: 'red',
      to: '/libretas',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Menús programados hoy',
      value: data.menus_del_dia.total,
      subtitle: `${data.menus_del_dia.publicados} publicados · Ir a menús`,
      color: 'blue',
      to: '/menus',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      title: 'Facturas emitidas hoy',
      value: data.facturas_emitidas_hoy,
      subtitle: 'Comprobantes · Integraciones / ventas',
      color: 'purple',
      to: '/integraciones#facturas',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: 'Ventas sin facturar hoy',
      value: data.ventas_sin_facturar_hoy,
      subtitle: 'Pendientes de comprobante · Ventas',
      color: 'red',
      to: '/ventas',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      title: 'Clientes activos',
      value: data.clientes_activos,
      subtitle: 'Registro maestro · Clientes',
      color: 'green',
      to: '/clientes',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      title: 'Productos activos',
      value: data.productos_activos,
      subtitle: 'Catálogo · Productos',
      color: 'blue',
      to: '/productos',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      title: 'Libretas activas',
      value: data.libretas_activas,
      subtitle: 'Cuentas corrientes · Libretas',
      color: 'purple',
      to: '/libretas',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      title: 'Compras del mes',
      value: data.compras_mes,
      subtitle: 'Órdenes registradas · Compras',
      color: 'green',
      to: '/compras',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H19M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {error ? (
        <Alert type="error" onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}
      <section className="rounded-lg border border-gray-200 bg-white px-4 py-6 shadow-sm sm:px-8">
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-3">
          <div className="flex justify-center md:justify-start">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#0c3c6e] text-white shadow-inner">
              <svg className="h-11 w-11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-xl font-bold uppercase tracking-tight text-teal-600 sm:text-2xl">
              Bienvenido, {nombreUsuario}!
            </h1>
            <p className="mt-1 text-sm text-gray-600">Conexión: {fechaSesion}</p>
            <p className="mt-2 text-sm font-semibold text-gray-800">
              {usuario?.sucursal?.nombre ?? 'Todas las sucursales'}
            </p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-lg font-bold uppercase tracking-wide text-[#0c3c6e]">Sistema Comedor</p>
            <p className="text-sm text-gray-500">Gestión integral del comedor</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white px-4 py-5 shadow-sm sm:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#0c3c6e]">Indicadores (KPI)</h2>
            <p className="text-xs text-gray-500">Vista consolidada del día y del mes · pulse una tarjeta para abrir el módulo</p>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => loadDashboard(true)}
            className="inline-flex items-center justify-center gap-2 self-start rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60 sm:self-auto"
          >
            <svg
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {kpis.map((k) => (
            <button
              key={k.title}
              type="button"
              onClick={() => navigate(k.to)}
              className="text-left transition-opacity hover:opacity-90"
            >
              <StatCard title={k.title} value={k.value} subtitle={k.subtitle} color={k.color} icon={k.icon} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
