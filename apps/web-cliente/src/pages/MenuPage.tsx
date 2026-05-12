import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

interface MenuItem {
  id: number;
  nombre: string;
  tipo: string;
}

interface Menu {
  id: number;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  precio: string;
  cupo_total: number;
  cupo_reservado: number;
  estado: string;
  items: MenuItem[];
}

function formatGs(amount: string | number): string {
  const num = typeof amount === 'string' ? parseInt(amount) : amount;
  return `Gs. ${num.toLocaleString('es-PY')}`;
}

function hoyISO(): string {
  return new Date().toISOString().split('T')[0];
}

const TIPO_LABELS: Record<string, string> = {
  SOPA: 'Sopa',
  PRINCIPAL: 'Principal',
  GUARNICION: 'Guarnición',
  BEBIDA: 'Bebida',
  POSTRE: 'Postre',
  EXTRA: 'Extra',
};

export default function MenuPage() {
  const navigate = useNavigate();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMenus = useCallback(async () => {
    try {
      setError('');
      const hoy = hoyISO();
      const response = await apiClient.get('/menus', {
        params: { fecha: hoy, estado: 'PUBLICADO', limit: 10 },
      });
      setMenus(response.data.data || []);
    } catch {
      setError('No se pudo cargar el menú. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenus();
    // Auto-refresh cada 5 minutos
    const interval = setInterval(fetchMenus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchMenus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando menú...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Menú de hoy</h1>
        <button
          onClick={fetchMenus}
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          Actualizar
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {!error && menus.length === 0 && (
        <div className="card flex flex-col items-center py-12 gap-3">
          <span className="text-5xl">🍽️</span>
          <p className="text-gray-500 text-center font-medium">
            No hay menú publicado para hoy
          </p>
          <p className="text-gray-400 text-sm text-center">
            Volvé a consultar más tarde o contactá al comedor.
          </p>
        </div>
      )}

      {menus.map((menu) => {
        const cupoDisponible = menu.cupo_total - menu.cupo_reservado;
        const sinCupo = cupoDisponible <= 0;

        return (
          <div key={menu.id} className="card space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">{menu.titulo}</h2>
                {menu.descripcion && (
                  <p className="text-gray-500 text-sm mt-0.5">{menu.descripcion}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-primary-700 text-lg">{formatGs(menu.precio)}</p>
                <p className={`text-xs ${sinCupo ? 'text-red-500' : 'text-gray-400'}`}>
                  {sinCupo ? 'Sin cupo' : `${cupoDisponible} lugares`}
                </p>
              </div>
            </div>

            {/* Items del menú */}
            {menu.items && menu.items.length > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Incluye
                </p>
                <ul className="space-y-1">
                  {menu.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-2 h-2 rounded-full bg-primary-400 shrink-0" />
                      <span className="text-xs text-gray-400 w-20 shrink-0">
                        {TIPO_LABELS[item.tipo] ?? item.tipo}
                      </span>
                      <span>{item.nombre}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reservar button */}
            <button
              onClick={() => navigate(`/reservar?menu_id=${menu.id}`)}
              disabled={sinCupo}
              className="btn-primary w-full py-3 mt-1 disabled:opacity-50"
            >
              {sinCupo ? 'Sin cupo disponible' : 'Reservar'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
