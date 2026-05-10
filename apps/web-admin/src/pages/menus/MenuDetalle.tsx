import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { menusApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { formatGs, formatFecha, formatFechaHora, getErrorMessage } from '../../lib/utils';

export function MenuDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loadMenu(); }, [id]);

  const loadMenu = async () => {
    setLoading(true);
    try {
      const res = await menusApi.obtener(parseInt(id!));
      setMenu(res.data.data as Record<string, unknown>);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePublicar = async () => {
    setActionLoading(true);
    try {
      await menusApi.publicar(parseInt(id!));
      loadMenu();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCerrar = async () => {
    if (!confirm('¿Cerrar este menú? Ya no se podrán hacer reservas.')) return;
    setActionLoading(true);
    try {
      await menusApi.cerrar(parseInt(id!));
      loadMenu();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!menu) return <Alert type="error">{error}</Alert>;

  const badge = estadoBadge(String(menu.estado));
  const items = (menu.items as Array<Record<string, unknown>>) || [];
  const reservas = (menu.reservas as Array<Record<string, unknown>>) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/menus')}>← Volver</Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{String(menu.titulo)}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-gray-500 text-sm">
            {formatFecha(String(menu.fecha))} · {String((menu.sucursal as Record<string, unknown>)?.nombre ?? '')}
          </p>
        </div>
        <div className="flex gap-2">
          {String(menu.estado) === 'BORRADOR' && (
            <>
              <Link to={`/menus/${id}/editar`}>
                <Button variant="secondary">Editar</Button>
              </Link>
              <Button onClick={handlePublicar} loading={actionLoading} variant="success">
                Publicar
              </Button>
            </>
          )}
          {String(menu.estado) === 'PUBLICADO' && (
            <Button variant="secondary" onClick={handleCerrar} loading={actionLoading}>
              Cerrar menú
            </Button>
          )}
        </div>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Precio normal</p>
          <p className="text-xl font-bold">{formatGs(Number(menu.precio))}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Precio convenio</p>
          <p className="text-xl font-bold">{menu.precio_convenio ? formatGs(Number(menu.precio_convenio)) : '-'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Cupo reservado</p>
          <p className="text-xl font-bold">{Number(menu.cupo_reservado)} / {menu.cupo_total ?? '∞'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total reservas</p>
          <p className="text-xl font-bold">{reservas.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Items */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Componentes</h3>
          </div>
          <div className="p-4 space-y-2">
            {items.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">Sin componentes</p>
            ) : (
              items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{String(item.tipo)}</span>
                  <span className="text-sm text-gray-700">{String(item.descripcion || (item.producto as Record<string, unknown>)?.nombre || '')}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Reservas */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Reservas ({reservas.length})</h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {reservas.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">Sin reservas</p>
            ) : (
              reservas.map((r) => {
                const rbadge = estadoBadge(String(r.estado));
                const cliente = r.cliente as Record<string, unknown>;
                return (
                  <div key={String(r.id)} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{String(cliente?.nombre ?? 'Anónimo')}</p>
                      <p className="text-xs text-gray-500">{formatFechaHora(String(r.creado_en))} · {Number(r.cantidad)} porción(es)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{formatGs(Number(r.total))}</p>
                      <Badge variant={rbadge.variant} size="sm">{rbadge.label}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
