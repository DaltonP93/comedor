import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Menu {
  id: number;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  precio: string;
  cupo_total: number;
  cupo_reservado: number;
  estado: string;
}

interface Libreta {
  id: number;
  estado: string;
  saldo_actual: string;
  limite_credito: string;
}

function formatGs(amount: string | number): string {
  const num = typeof amount === 'string' ? parseInt(amount, 10) : amount;
  return `Gs. ${num.toLocaleString('es-PY')}`;
}

export default function ReservarPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cliente } = useAuth();
  const menuId = searchParams.get('menu_id');

  const [menu, setMenu] = useState<Menu | null>(null);
  const [libreta, setLibreta] = useState<Libreta | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [loadingLibreta, setLoadingLibreta] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState<number | null>(null);

  const [cantidad, setCantidad] = useState(1);
  const [tipoEntrega, setTipoEntrega] = useState<'EN_LOCAL' | 'RETIRO'>('EN_LOCAL');
  const [observacion, setObservacion] = useState('');
  const [formaPago, setFormaPago] = useState<'EFECTIVO' | 'LIBRETA'>('EFECTIVO');

  const fetchMenu = useCallback(async () => {
    if (!menuId) {
      setLoadingMenu(false);
      return;
    }
    try {
      const res = await apiClient.get(`/menus/${menuId}`);
      setMenu(res.data.data);
    } catch {
      setError('No se pudo cargar el menú seleccionado.');
    } finally {
      setLoadingMenu(false);
    }
  }, [menuId]);

  const fetchLibreta = useCallback(async () => {
    if (!cliente) {
      setLoadingLibreta(false);
      return;
    }
    try {
      const res = await apiClient.get('/libretas', {
        params: { cliente_id: cliente.id, limit: 1 },
      });
      const items = res.data.data;
      if (items && items.length > 0) {
        setLibreta(items[0] as Libreta);
      }
    } catch {
      // No libreta — silenciar el error
    } finally {
      setLoadingLibreta(false);
    }
  }, [cliente]);

  useEffect(() => {
    fetchMenu();
    fetchLibreta();
  }, [fetchMenu, fetchLibreta]);

  const precioUnitario = menu ? parseInt(menu.precio, 10) : 0;
  const total = precioUnitario * cantidad;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!menu || !cliente) return;
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        menu_id: menu.id,
        cliente_id: cliente.id,
        cantidad,
        tipo_entrega: tipoEntrega,
        observacion: observacion.trim() || undefined,
        forma_pago: formaPago,
      };
      const res = await apiClient.post('/reservas', payload);
      setExito(res.data.data.id as number);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'message' in err.response.data
      ) {
        setError(String((err.response.data as { message: string }).message));
      } else {
        setError('No se pudo crear la reserva. Intentá de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- Estados de carga ---
  if (loadingMenu || loadingLibreta) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!menuId || !menu) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-800">Reservar</h1>
        <div className="card text-center py-10 space-y-3">
          <p className="text-gray-500">Menú no encontrado.</p>
          <Link to="/menu" className="btn-primary inline-block">
            Ver menú de hoy
          </Link>
        </div>
      </div>
    );
  }

  // --- Confirmación de éxito ---
  if (exito !== null) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-800">Reserva confirmada</h1>
        <div className="card text-center py-10 space-y-4">
          <div className="text-6xl">✅</div>
          <div>
            <p className="text-lg font-semibold text-gray-800">¡Tu reserva fue registrada!</p>
            <p className="text-gray-500 text-sm mt-1">
              N.° de reserva: <span className="font-bold text-primary-700">#{exito}</span>
            </p>
          </div>
          <div className="text-sm text-gray-500 space-y-1">
            <p><span className="font-medium">Menú:</span> {menu.titulo}</p>
            <p><span className="font-medium">Cantidad:</span> {cantidad}</p>
            <p><span className="font-medium">Total:</span> {formatGs(total)}</p>
            <p><span className="font-medium">Forma de pago:</span> {formaPago === 'EFECTIVO' ? 'Efectivo al retirar' : 'Libreta'}</p>
          </div>
          <button
            onClick={() => navigate('/mis-reservas')}
            className="btn-primary w-full py-3"
          >
            Ver mis reservas
          </button>
        </div>
      </div>
    );
  }

  const cupoDisponible = menu.cupo_total - menu.cupo_reservado;
  const libretatActiva = libreta && libreta.estado === 'ACTIVA';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Volver"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-gray-800">Reservar</h1>
      </div>

      {/* Detalle del menú */}
      <div className="card space-y-1">
        <h2 className="font-bold text-gray-800">{menu.titulo}</h2>
        {menu.descripcion && (
          <p className="text-sm text-gray-500">{menu.descripcion}</p>
        )}
        <div className="flex items-center justify-between pt-2">
          <span className="text-primary-700 font-bold text-lg">{formatGs(menu.precio)}</span>
          <span className="text-xs text-gray-400">
            {cupoDisponible > 0
              ? `${cupoDisponible} lugares disponibles`
              : 'Sin cupo'}
          </span>
        </div>
      </div>

      {cupoDisponible <= 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
          Este menú ya no tiene cupo disponible.
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cantidad */}
        <div className="card space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Cantidad
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-xl font-bold text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
            >
              −
            </button>
            <span className="text-2xl font-bold text-gray-800 w-8 text-center">
              {cantidad}
            </span>
            <button
              type="button"
              onClick={() => setCantidad((c) => Math.min(5, c + 1))}
              className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-xl font-bold text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
            >
              +
            </button>
            <span className="text-sm text-gray-400">(máx. 5)</span>
          </div>
        </div>

        {/* Tipo de entrega */}
        <div className="card space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Tipo de entrega
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['EN_LOCAL', 'RETIRO'] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setTipoEntrega(tipo)}
                className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  tipoEntrega === tipo
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {tipo === 'EN_LOCAL' ? '🍽️ En el local' : '🛍️ Para llevar'}
              </button>
            ))}
          </div>
        </div>

        {/* Forma de pago */}
        <div className="card space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Forma de pago
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormaPago('EFECTIVO')}
              className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                formaPago === 'EFECTIVO'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              💵 Efectivo al retirar
            </button>
            <button
              type="button"
              onClick={() => libretatActiva && setFormaPago('LIBRETA')}
              disabled={!libretatActiva}
              className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                formaPago === 'LIBRETA'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              📒 Libreta
              {!libretatActiva && (
                <span className="block text-xs text-gray-400">No disponible</span>
              )}
            </button>
          </div>
        </div>

        {/* Observación */}
        <div className="card space-y-2">
          <label htmlFor="observacion" className="block text-sm font-semibold text-gray-700">
            Observación <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <textarea
            id="observacion"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            rows={2}
            placeholder="Ej: sin cebolla, alergia a mariscos..."
            className="input-field resize-none"
            maxLength={200}
          />
        </div>

        {/* Total */}
        <div className="card flex items-center justify-between">
          <span className="font-semibold text-gray-700">Total a pagar</span>
          <span className="text-xl font-bold text-primary-700">{formatGs(total)}</span>
        </div>

        <button
          type="submit"
          disabled={submitting || cupoDisponible <= 0}
          className="btn-primary w-full py-3"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Registrando...
            </span>
          ) : (
            'Confirmar reserva'
          )}
        </button>
      </form>
    </div>
  );
}
