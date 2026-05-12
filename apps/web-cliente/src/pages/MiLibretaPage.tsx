import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Libreta {
  id: number;
  estado: string;
  saldo_actual: string;
  limite_credito: string;
  dia_vencimiento: number;
  cliente: {
    id: number;
    nombre: string;
    apellido: string;
  };
}

interface Movimiento {
  id: number;
  fecha: string;
  descripcion: string;
  tipo: string;
  monto: string;
  saldo_posterior: string;
  venta_id: number | null;
}

function formatGs(amount: string | number): string {
  const num = typeof amount === 'string' ? parseInt(amount, 10) : amount;
  return `Gs. ${num.toLocaleString('es-PY')}`;
}

function formatFechaHora(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ESTADO_CONFIG: Record<string, { label: string; clases: string; banner?: string }> = {
  ACTIVA: { label: 'Activa', clases: 'bg-green-100 text-green-700' },
  SUSPENDIDA: {
    label: 'Suspendida',
    clases: 'bg-yellow-100 text-yellow-700',
    banner: 'Tu libreta está suspendida. Contactá al administrador.',
  },
  BLOQUEADA: {
    label: 'Bloqueada',
    clases: 'bg-red-100 text-red-700',
    banner: 'Tu libreta está bloqueada por deuda vencida. Por favor regularizá tu situación.',
  },
};

export default function MiLibretaPage() {
  const { cliente } = useAuth();
  const navigate = useNavigate();
  const [libreta, setLibreta] = useState<Libreta | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loadingLibreta, setLoadingLibreta] = useState(true);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  const [error, setError] = useState('');

  const fetchLibreta = useCallback(async () => {
    if (!cliente) return;
    setError('');
    try {
      const res = await apiClient.get('/libretas', {
        params: { cliente_id: cliente.id, limit: 1 },
      });
      const items = res.data.data;
      if (items && items.length > 0) {
        const lib = items[0] as Libreta;
        setLibreta(lib);
        // Cargar movimientos
        setLoadingMovimientos(true);
        try {
          const movRes = await apiClient.get(`/libretas/${lib.id}/movimientos`, {
            params: { limit: 30, order: 'desc' },
          });
          setMovimientos(movRes.data.data || []);
        } catch {
          // Silenciar error de movimientos
        } finally {
          setLoadingMovimientos(false);
        }
      }
    } catch {
      setError('No se pudo cargar tu libreta.');
    } finally {
      setLoadingLibreta(false);
    }
  }, [cliente]);

  useEffect(() => {
    fetchLibreta();
  }, [fetchLibreta]);

  if (loadingLibreta) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando libreta...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-800">Mi Libreta</h1>
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!libreta) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-800">Mi Libreta</h1>
        <div className="card flex flex-col items-center py-12 gap-3">
          <span className="text-5xl">📒</span>
          <p className="text-gray-500 font-medium">No tenés una libreta asignada</p>
          <p className="text-gray-400 text-sm text-center">
            Contactá al administrador del comedor para solicitar crédito.
          </p>
        </div>
      </div>
    );
  }

  const estadoCfg = ESTADO_CONFIG[libreta.estado] ?? {
    label: libreta.estado,
    clases: 'bg-gray-100 text-gray-600',
  };
  const saldo = parseInt(libreta.saldo_actual, 10);
  const limite = parseInt(libreta.limite_credito, 10);
  const porcentajeUso = limite > 0 ? Math.min(100, (saldo / limite) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Mi Libreta</h1>
        <button
          onClick={fetchLibreta}
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          Actualizar
        </button>
      </div>

      {/* Banner de bloqueo/suspensión */}
      {estadoCfg.banner && (
        <div className={`p-3 rounded-lg text-sm font-medium ${
          libreta.estado === 'BLOQUEADA'
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
        }`}>
          ⚠️ {estadoCfg.banner}
        </div>
      )}

      {/* Resumen de cuenta */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">Saldo actual</p>
            <p className={`text-3xl font-bold mt-0.5 ${saldo > 0 ? 'text-red-600' : 'text-gray-700'}`}>
              {formatGs(saldo)}
            </p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${estadoCfg.clases}`}>
            {estadoCfg.label}
          </span>
        </div>

        {/* Barra de uso */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Límite de crédito: {formatGs(limite)}</span>
            <span>{porcentajeUso.toFixed(0)}% usado</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                porcentajeUso > 80 ? 'bg-red-400' : 'bg-primary-400'
              }`}
              style={{ width: `${porcentajeUso}%` }}
            />
          </div>
        </div>

        <div className="text-xs text-gray-400 text-right">
          Vencimiento: día {libreta.dia_vencimiento} de cada mes
        </div>

        {/* Botón pagar */}
        {saldo > 0 && (
          <button
            onClick={() => navigate('/pagar')}
            className="btn-primary w-full py-3"
          >
            Pagar ahora
          </button>
        )}
        {saldo === 0 && (
          <div className="text-center py-2 text-sm text-green-600 font-medium">
            ✓ Tu cuenta está al día
          </div>
        )}
      </div>

      {/* Movimientos */}
      <div className="space-y-2">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
          Últimos movimientos
        </h2>

        {loadingMovimientos && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}

        {!loadingMovimientos && movimientos.length === 0 && (
          <div className="card text-center py-8 text-gray-400 text-sm">
            Sin movimientos registrados
          </div>
        )}

        {!loadingMovimientos && movimientos.map((mov) => {
          const esCargo = mov.tipo === 'CARGO';
          return (
            <div key={mov.id} className="card flex items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{mov.descripcion}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatFechaHora(mov.fecha)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-semibold text-sm ${esCargo ? 'text-red-600' : 'text-green-600'}`}>
                  {esCargo ? '+' : '−'} {formatGs(mov.monto)}
                </p>
                <p className="text-xs text-gray-400">
                  Saldo: {formatGs(mov.saldo_posterior)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
