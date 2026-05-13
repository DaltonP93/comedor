import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Reserva {
  id: number;
  fecha: string;
  cantidad: number;
  estado: string;
  total: string;
  forma_pago: string;
  tipo_entrega: string;
  observacion: string | null;
  menu: {
    id: number;
    titulo: string;
    fecha: string;
  };
}

type EstadoReserva =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'EN_PREPARACION'
  | 'LISTA'
  | 'ENTREGADA'
  | 'CANCELADA_CLIENTE'
  | 'CANCELADA_COMEDOR'
  | string;

function formatGs(amount: string | number): string {
  const num = typeof amount === 'string' ? parseInt(amount, 10) : amount;
  return `Gs. ${num.toLocaleString('es-PY')}`;
}

function formatFecha(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const ESTADO_CONFIG: Record<string, { label: string; clases: string }> = {
  PENDIENTE: { label: 'Pendiente', clases: 'bg-yellow-100 text-yellow-700' },
  CONFIRMADA: { label: 'Confirmada', clases: 'bg-green-100 text-green-700' },
  EN_PREPARACION: { label: 'En preparación', clases: 'bg-blue-100 text-blue-700' },
  LISTA: { label: 'Lista', clases: 'bg-teal-100 text-teal-700' },
  ENTREGADA: { label: 'Entregada', clases: 'bg-gray-100 text-gray-600' },
  CANCELADA_CLIENTE: { label: 'Cancelada', clases: 'bg-red-100 text-red-600' },
  CANCELADA_COMEDOR: { label: 'Cancelada', clases: 'bg-red-100 text-red-600' },
};

const FORMA_PAGO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  LIBRETA: 'Libreta',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
};

const TIPO_ENTREGA_LABELS: Record<string, string> = {
  EN_LOCAL: 'En el local',
  RETIRO: 'Para llevar',
};

function estadoConfig(estado: EstadoReserva) {
  return ESTADO_CONFIG[estado] ?? { label: estado, clases: 'bg-gray-100 text-gray-600' };
}

function puedeCanselar(estado: EstadoReserva) {
  return estado === 'PENDIENTE' || estado === 'CONFIRMADA';
}

export default function MisReservasPage() {
  const { cliente } = useAuth();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelando, setCancelando] = useState<number | null>(null);
  const [mensajeExito, setMensajeExito] = useState('');

  const fetchReservas = useCallback(async () => {
    if (!cliente) return;
    setError('');
    try {
      const res = await apiClient.get('/reservas', {
        params: { cliente_id: cliente.id, limit: 50, order: 'desc' },
      });
      setReservas(res.data.data || []);
    } catch {
      setError('No se pudieron cargar tus reservas.');
    } finally {
      setLoading(false);
    }
  }, [cliente]);

  useEffect(() => {
    fetchReservas();
  }, [fetchReservas]);

  const handleCancelar = async (id: number) => {
    if (!window.confirm('¿Confirmás la cancelación de esta reserva?')) return;
    setCancelando(id);
    try {
      await apiClient.post(`/reservas/${id}/cancelar`);
      setMensajeExito('Reserva cancelada correctamente.');
      setTimeout(() => setMensajeExito(''), 4000);
      await fetchReservas();
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
        setError('No se pudo cancelar la reserva.');
      }
    } finally {
      setCancelando(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando reservas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Mis reservas</h1>
        <button
          onClick={fetchReservas}
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          Actualizar
        </button>
      </div>

      {mensajeExito && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {mensajeExito}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {reservas.length === 0 && !error && (
        <div className="card flex flex-col items-center py-12 gap-3">
          <span className="text-5xl">📋</span>
          <p className="text-gray-500 font-medium">No tenés reservas registradas</p>
          <p className="text-gray-400 text-sm text-center">
            Podés hacer una reserva desde la sección Menú.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {reservas.map((reserva) => {
          const cfg = estadoConfig(reserva.estado);
          const cancelable = puedeCanselar(reserva.estado);

          return (
            <div key={reserva.id} className="card space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{reserva.menu.titulo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatFecha(reserva.menu.fecha)} · Reserva #{reserva.id}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.clases}`}
                >
                  {cfg.label}
                </span>
              </div>

              {/* Detalles */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>
                  <span className="text-gray-400 text-xs">Cantidad</span>
                  <p className="text-gray-700 font-medium">{reserva.cantidad}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Total</span>
                  <p className="text-gray-700 font-medium">{formatGs(reserva.total)}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Forma de pago</span>
                  <p className="text-gray-700 font-medium">
                    {FORMA_PAGO_LABELS[reserva.forma_pago] ?? reserva.forma_pago}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Entrega</span>
                  <p className="text-gray-700 font-medium">
                    {TIPO_ENTREGA_LABELS[reserva.tipo_entrega] ?? reserva.tipo_entrega}
                  </p>
                </div>
              </div>

              {reserva.observacion && (
                <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-2">
                  Obs: {reserva.observacion}
                </p>
              )}

              {/* Cancelar */}
              {cancelable && (
                <button
                  onClick={() => handleCancelar(reserva.id)}
                  disabled={cancelando === reserva.id}
                  className="btn-danger w-full py-2 text-sm disabled:opacity-50"
                >
                  {cancelando === reserva.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Cancelando...
                    </span>
                  ) : (
                    'Cancelar reserva'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
