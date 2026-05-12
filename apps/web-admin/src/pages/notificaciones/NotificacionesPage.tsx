import React, { useState, useEffect, useCallback } from 'react';
import { notificacionesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Table } from '../../components/UI/Table';
import { Badge } from '../../components/UI/Badge';
import { Pagination } from '../../components/UI/Pagination';
import { Alert } from '../../components/UI/Alert';
import { formatFechaHora, getErrorMessage } from '../../lib/utils';

interface Notificacion {
  id: number;
  tipo: string;
  canal: string;
  mensaje: string;
  estado: string;
  creado_en: string;
  cliente: { id: number; nombre: string; telefono: string | null; email: string | null } | null;
}

const ESTADOS = ['', 'PENDIENTE', 'ENVIADA', 'ERROR'];
const CANALES = ['', 'WHATSAPP', 'EMAIL', 'SMS'];

function estadoNotifBadge(estado: string) {
  if (estado === 'ENVIADA') return { variant: 'success' as const, label: 'Enviada' };
  if (estado === 'ERROR') return { variant: 'danger' as const, label: 'Error' };
  return { variant: 'warning' as const, label: 'Pendiente' };
}

function canalBadge(canal: string) {
  if (canal === 'WHATSAPP') return { variant: 'success' as const };
  if (canal === 'EMAIL') return { variant: 'info' as const };
  return { variant: 'default' as const };
}

export default function NotificacionesPage() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCanal, setFiltroCanal] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [enviandoMasivo, setEnviandoMasivo] = useState(false);
  const [stats, setStats] = useState({ pendiente: 0, enviada: 0, error: 0 });

  const loadNotificaciones = useCallback(async () => {
    setLoading(true);
    try {
      const [res, pendienteRes, enviadaRes, errorRes] = await Promise.all([
        notificacionesApi.listar({
          estado: filtroEstado || undefined,
          canal: filtroCanal || undefined,
          tipo: filtroTipo || undefined,
          page,
          limit: 20,
        }),
        notificacionesApi.listar({ estado: 'PENDIENTE', limit: 1 }),
        notificacionesApi.listar({ estado: 'ENVIADA', limit: 1 }),
        notificacionesApi.listar({ estado: 'ERROR', limit: 1 }),
      ]);
      setNotificaciones(res.data.data as Notificacion[]);
      setMeta(res.data.meta || { total: 0, totalPages: 1 });
      setStats({
        pendiente: (pendienteRes.data.meta?.total as number) || 0,
        enviada: (enviadaRes.data.meta?.total as number) || 0,
        error: (errorRes.data.meta?.total as number) || 0,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroCanal, filtroTipo, page]);

  useEffect(() => {
    loadNotificaciones();
  }, [loadNotificaciones]);

  const marcarEnviada = async (id: number) => {
    try {
      await notificacionesApi.marcarEnviada(id);
      setSuccess('Notificación marcada como enviada');
      loadNotificaciones();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta notificación pendiente?')) return;
    try {
      await notificacionesApi.eliminar(id);
      setSuccess('Notificación eliminada');
      loadNotificaciones();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const envioMasivo = async () => {
    if (!confirm('Se crearán recordatorios de pago para todos los clientes con saldo vencido. ¿Continuar?')) return;
    setEnviandoMasivo(true);
    try {
      const res = await notificacionesApi.envioMasivo();
      const creadas = (res.data.data as { creadas: number })?.creadas ?? 0;
      setSuccess(`Envío masivo completado: se crearon ${creadas} notificación(es) de recordatorio`);
      loadNotificaciones();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setEnviandoMasivo(false);
    }
  };

  const columns = [
    {
      key: 'cliente',
      header: 'Cliente',
      render: (row: Notificacion) =>
        row.cliente ? (
          <div>
            <p className="text-sm font-medium text-gray-900">{row.cliente.nombre}</p>
            <p className="text-xs text-gray-500">{row.cliente.telefono || row.cliente.email || '—'}</p>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">Sin cliente</span>
        ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (row: Notificacion) => (
        <span className="text-sm text-gray-700">{row.tipo.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'canal',
      header: 'Canal',
      render: (row: Notificacion) => {
        const { variant } = canalBadge(row.canal);
        return (
          <Badge variant={variant} size="sm">
            {row.canal}
          </Badge>
        );
      },
    },
    {
      key: 'mensaje',
      header: 'Mensaje',
      render: (row: Notificacion) => (
        <span className="text-sm text-gray-600 max-w-xs block truncate" title={row.mensaje}>
          {row.mensaje.length > 60 ? row.mensaje.slice(0, 60) + '...' : row.mensaje}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (row: Notificacion) => {
        const badge = estadoNotifBadge(row.estado);
        return (
          <Badge variant={badge.variant} size="sm">
            {badge.label}
          </Badge>
        );
      },
    },
    {
      key: 'fecha',
      header: 'Fecha',
      render: (row: Notificacion) => (
        <span className="text-xs text-gray-500">{formatFechaHora(row.creado_en)}</span>
      ),
    },
    {
      key: 'acciones',
      header: '',
      render: (row: Notificacion) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {row.estado === 'PENDIENTE' && (
            <>
              <button
                onClick={() => marcarEnviada(row.id)}
                className="text-green-600 hover:text-green-800 text-xs font-medium"
              >
                Marcar enviada
              </button>
              <button
                onClick={() => eliminar(row.id)}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-gray-500 text-sm">Recordatorios y comunicaciones a clientes</p>
        </div>
        <Button onClick={envioMasivo} disabled={enviandoMasivo}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {enviandoMasivo ? 'Enviando...' : 'Envío masivo recordatorios'}
        </Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-xs font-medium text-yellow-700 uppercase tracking-wide">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-900 mt-1">{stats.pendiente}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Enviadas</p>
          <p className="text-2xl font-bold text-green-900 mt-1">{stats.enviada}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Con error</p>
          <p className="text-2xl font-bold text-red-900 mt-1">{stats.error}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
            <select
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={filtroEstado}
              onChange={(e) => { setFiltroEstado(e.target.value); setPage(1); }}
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>{e || 'Todos'}</option>
              ))}
            </select>
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">Canal</label>
            <select
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={filtroCanal}
              onChange={(e) => { setFiltroCanal(e.target.value); setPage(1); }}
            >
              {CANALES.map((c) => (
                <option key={c} value={c}>{c || 'Todos'}</option>
              ))}
            </select>
          </div>
          <div className="w-56">
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <input
              type="text"
              placeholder="Filtrar por tipo..."
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={filtroTipo}
              onChange={(e) => { setFiltroTipo(e.target.value); setPage(1); }}
            />
          </div>
          {(filtroEstado || filtroCanal || filtroTipo) && (
            <div className="flex items-end">
              <button
                onClick={() => { setFiltroEstado(''); setFiltroCanal(''); setFiltroTipo(''); setPage(1); }}
                className="text-sm text-gray-500 hover:text-gray-700 underline py-2"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns}
          data={notificaciones}
          loading={loading}
          emptyMessage="No se encontraron notificaciones"
        />
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={20}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
