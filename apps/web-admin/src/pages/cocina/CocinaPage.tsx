import React, { useState, useEffect, useCallback } from 'react';
import { reportesApi, reservasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Alert } from '../../components/UI/Alert';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { formatGs, getErrorMessage, hoyISO } from '../../lib/utils';

interface ReservaItem {
  id: number;
  cantidad: number;
  estado: string;
  observacion: string | null;
  total: number | string;
  cliente: { nombre: string };
}

interface MenuCocina {
  id: number;
  titulo: string;
  precio: number | string;
  cupo_total: number | null;
  cupo_reservado: number;
  items: Array<{ id: number; tipo: string; descripcion: string | null; producto: { nombre: string } | null }>;
  reservas: ReservaItem[];
}

const ESTADOS_FLUJO = ['CONFIRMADA', 'EN_COCINA', 'PREPARADA', 'ENTREGADA'];

export function CocinaPage() {
  const [menus, setMenus] = useState<MenuCocina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('CONFIRMADA');

  const loadData = useCallback(async () => {
    try {
      const res = await reportesApi.cocina();
      setMenus(res.data.data as MenuCocina[]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [loadData]);

  const handleAvanzarEstado = async (reservaId: number, estadoActual: string) => {
    const idx = ESTADOS_FLUJO.indexOf(estadoActual);
    if (idx < 0 || idx >= ESTADOS_FLUJO.length - 1) return;
    const nuevoEstado = ESTADOS_FLUJO[idx + 1];
    try {
      await reservasApi.actualizarEstado(reservaId, nuevoEstado);
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const getSiguienteEstado = (estado: string) => {
    const idx = ESTADOS_FLUJO.indexOf(estado);
    if (idx < 0 || idx >= ESTADOS_FLUJO.length - 1) return null;
    return ESTADOS_FLUJO[idx + 1];
  };

  if (loading) return <PageLoader />;

  const allReservas = menus.flatMap((m) => m.reservas);
  const totalPorEstado = ESTADOS_FLUJO.reduce((acc, est) => ({
    ...acc,
    [est]: allReservas.filter((r) => r.estado === est).length,
  }), {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel de Cocina</h1>
          <p className="text-gray-500 text-sm">Pedidos del día - {new Date().toLocaleDateString('es-PY')}</p>
        </div>
        <Button variant="secondary" onClick={() => loadData()}>
          Actualizar
        </Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Status counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ESTADOS_FLUJO.map((estado) => {
          const badge = estadoBadge(estado);
          const count = totalPorEstado[estado] || 0;
          return (
            <button
              key={estado}
              onClick={() => setFiltroEstado(estado)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${filtroEstado === estado ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
            >
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
            </button>
          );
        })}
      </div>

      {/* Menus and reservations */}
      {menus.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No hay menús publicados para hoy
        </div>
      ) : (
        menus.map((menu) => {
          const reservasFiltradas = menu.reservas.filter((r) => r.estado === filtroEstado);

          return (
            <div key={menu.id} className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{menu.titulo}</h3>
                    <p className="text-sm text-gray-500">
                      {menu.cupo_reservado} reservas · Precio: {formatGs(Number(menu.precio))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Cupo: {menu.cupo_reservado} / {menu.cupo_total ?? '∞'}</p>
                  </div>
                </div>
                {/* Menu items */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {menu.items.map((item, idx) => (
                    <span key={idx} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded">
                      {item.tipo}: {item.descripcion || item.producto?.nombre || '-'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {reservasFiltradas.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-gray-500 text-center">Sin pedidos en estado "{filtroEstado}"</p>
                ) : (
                  reservasFiltradas.map((reserva) => {
                    const siguiente = getSiguienteEstado(reserva.estado);
                    const badge = estadoBadge(reserva.estado);
                    return (
                      <div key={reserva.id} className="flex items-center gap-4 px-6 py-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{reserva.cliente.nombre}</p>
                            <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                          </div>
                          <p className="text-sm text-gray-500">
                            {reserva.cantidad} porción(es) · {formatGs(Number(reserva.total))}
                          </p>
                          {reserva.observacion && (
                            <p className="text-xs text-orange-600 mt-0.5">⚠ {reserva.observacion}</p>
                          )}
                        </div>
                        {siguiente && (
                          <Button
                            size="sm"
                            variant={siguiente === 'ENTREGADA' ? 'success' : 'primary'}
                            onClick={() => handleAvanzarEstado(reserva.id, reserva.estado)}
                          >
                            → {siguiente === 'EN_COCINA' ? 'Preparar' : siguiente === 'PREPARADA' ? 'Listo' : 'Entregar'}
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
