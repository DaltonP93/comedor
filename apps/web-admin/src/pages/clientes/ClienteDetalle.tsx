import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { clientesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { PageBack } from '../../components/UI/PageBack';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { Card } from '../../components/UI/Card';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { formatGs, formatFechaHora, getErrorMessage } from '../../lib/utils';

export function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [estadoCuenta, setEstadoCuenta] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'info' | 'ventas' | 'reservas' | 'movimientos'>('info');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clienteRes, estadoRes] = await Promise.all([
        clientesApi.obtener(parseInt(id!)),
        clientesApi.estadoCuenta(parseInt(id!)),
      ]);
      setData(clienteRes.data.data as Record<string, unknown>);
      setEstadoCuenta(estadoRes.data.data as Record<string, unknown>);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return null;

  const libretas = (data.libretas as Array<Record<string, unknown>>) || [];
  const libretaActiva = libretas.find((l) => l.estado === 'ACTIVA');
  const badge = estadoBadge(String(data.estado));
  const ventas = (estadoCuenta?.ventas as Array<Record<string, unknown>>) || [];
  const movimientos = (estadoCuenta?.movimientos as Array<Record<string, unknown>>) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <PageBack to="/clientes" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{String(data.nombre)}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-gray-500 text-sm">{String(data.tipo_cliente)} · {String(data.documento_numero || data.ruc || '-')}</p>
        </div>
        <Link to={`/clientes/${id}/editar`}>
          <Button variant="secondary">Editar</Button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Saldo en libreta</p>
          <p className={`text-2xl font-bold ${Number(libretaActiva?.saldo_actual ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatGs(Number(libretaActiva?.saldo_actual ?? 0))}
          </p>
          <p className="text-xs text-gray-400">Límite: {formatGs(Number(libretaActiva?.limite_credito ?? 0))}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total consumido</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatGs(ventas.reduce((sum: number, v) => sum + Number(v.total ?? 0), 0))}
          </p>
          <p className="text-xs text-gray-400">{ventas.length} ventas</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Estado libreta</p>
          <p className="text-2xl font-bold text-gray-900">
            {libretaActiva ? String(libretaActiva.tipo) : 'Sin libreta'}
          </p>
          {libretaActiva && (
            <Link to={`/libretas/${libretaActiva.id}`} className="text-xs text-blue-600 hover:underline">
              Ver detalle →
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex border-b border-gray-200">
          {(['info', 'ventas', 'reservas', 'movimientos'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'info' ? 'Información' : t === 'ventas' ? 'Ventas' : t === 'reservas' ? 'Reservas' : 'Movimientos libreta'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'info' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Teléfono</p>
                  <p className="text-sm font-medium">{String(data.telefono || '-')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">WhatsApp</p>
                  <p className="text-sm font-medium">{String(data.whatsapp || '-')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm font-medium">{String(data.email || '-')}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Dirección</p>
                  <p className="text-sm font-medium">{String(data.direccion || '-')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Canal preferido</p>
                  <p className="text-sm font-medium">{String(data.canal_preferido || '-')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Notificaciones</p>
                  <p className="text-sm font-medium">{data.permite_notificaciones ? 'Sí' : 'No'}</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'ventas' && (
            <div className="space-y-2">
              {ventas.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Sin ventas registradas</p>
              ) : (
                ventas.map((venta) => {
                  const vbadge = estadoBadge(String(venta.estado));
                  return (
                    <div key={String(venta.id)} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div>
                        <p className="text-sm font-medium">Venta #{String(venta.id)} - {String(venta.tipo_venta)}</p>
                        <p className="text-xs text-gray-500">{formatFechaHora(String(venta.creado_en))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatGs(Number(venta.total))}</p>
                        <Badge variant={vbadge.variant} size="sm">{vbadge.label}</Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'movimientos' && (
            <div className="space-y-2">
              {movimientos.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Sin movimientos de libreta</p>
              ) : (
                movimientos.map((mov) => (
                  <div key={String(mov.id)} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium">{String(mov.descripcion || mov.tipo_movimiento)}</p>
                      <p className="text-xs text-gray-500">{formatFechaHora(String(mov.fecha_movimiento))}</p>
                    </div>
                    <div className="text-right">
                      {Number(mov.monto_debe) > 0 && (
                        <p className="text-sm font-semibold text-red-600">+{formatGs(Number(mov.monto_debe))}</p>
                      )}
                      {Number(mov.monto_haber) > 0 && (
                        <p className="text-sm font-semibold text-green-600">-{formatGs(Number(mov.monto_haber))}</p>
                      )}
                      <p className="text-xs text-gray-500">Saldo: {formatGs(Number(mov.saldo_resultante))}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
