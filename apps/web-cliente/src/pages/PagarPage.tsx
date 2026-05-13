import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Libreta {
  id: number;
  estado: string;
  saldo_actual: string;
  limite_credito: string;
}

type MetodoPago = 'TRANSFERENCIA' | 'EFECTIVO';

function formatGs(amount: string | number): string {
  const num = typeof amount === 'string' ? parseInt(amount, 10) : amount;
  return `Gs. ${num.toLocaleString('es-PY')}`;
}

export default function PagarPage() {
  const { cliente } = useAuth();
  const navigate = useNavigate();

  const [libreta, setLibreta] = useState<Libreta | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('TRANSFERENCIA');

  const fetchLibreta = useCallback(async () => {
    if (!cliente) return;
    try {
      const res = await apiClient.get('/libretas', {
        params: { cliente_id: cliente.id, limit: 1 },
      });
      const items = res.data.data;
      if (items && items.length > 0) {
        const lib = items[0] as Libreta;
        setLibreta(lib);
        setMonto(lib.saldo_actual);
      }
    } catch {
      setError('No se pudo cargar tu libreta.');
    } finally {
      setLoading(false);
    }
  }, [cliente]);

  useEffect(() => {
    fetchLibreta();
  }, [fetchLibreta]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!libreta) return;

    const montoNum = parseInt(monto, 10);
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('Ingresá un monto válido.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await apiClient.post('/pagos/orden', {
        libreta_id: libreta.id,
        monto: montoNum,
        forma_pago: metodoPago,
        descripcion: `Pago desde Portal del Cliente - ${metodoPago === 'TRANSFERENCIA' ? 'Transferencia bancaria' : 'Efectivo en caja'}`,
      });
      setExito(true);
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
        setError('No se pudo registrar el pago. Intentá de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!libreta) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-800">Pagar deuda</h1>
        <div className="card text-center py-10 text-gray-500 text-sm">
          No tenés una libreta asignada.
        </div>
      </div>
    );
  }

  // Pantalla de confirmación exitosa
  if (exito) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-800">Pago registrado</h1>
        <div className="card text-center py-10 space-y-4">
          <div className="text-6xl">✅</div>
          <div>
            <p className="text-lg font-semibold text-gray-800">¡Tu pago fue registrado!</p>
            <p className="text-gray-500 text-sm mt-2">
              Un administrador confirmará tu pago a la brevedad.
            </p>
          </div>
          <div className="bg-primary-50 rounded-lg p-4 text-sm text-left space-y-2">
            <p className="font-semibold text-primary-700 mb-2">Próximos pasos:</p>
            {metodoPago === 'TRANSFERENCIA' ? (
              <ul className="space-y-1 text-gray-600">
                <li>1. Realizá la transferencia al número de cuenta indicado.</li>
                <li>2. Enviá el comprobante al comedor por WhatsApp o en persona.</li>
                <li>3. El administrador confirmará el pago y actualizará tu saldo.</li>
              </ul>
            ) : (
              <ul className="space-y-1 text-gray-600">
                <li>1. Acercate a la caja del comedor.</li>
                <li>2. Presentá tu número de reserva o nombre para identificar el pago.</li>
                <li>3. El operador registrará el pago y actualizará tu saldo.</li>
              </ul>
            )}
          </div>
          <button
            onClick={() => navigate('/mi-libreta')}
            className="btn-primary w-full py-3"
          >
            Ver mi libreta
          </button>
        </div>
      </div>
    );
  }

  const saldo = parseInt(libreta.saldo_actual, 10);

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
        <h1 className="text-xl font-bold text-gray-800">Pagar deuda</h1>
      </div>

      {/* Saldo actual */}
      <div className="card text-center py-5">
        <p className="text-sm text-gray-500 mb-1">Deuda actual</p>
        <p className="text-3xl font-bold text-red-600">{formatGs(saldo)}</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Monto a pagar */}
        <div className="card space-y-2">
          <label htmlFor="monto" className="block text-sm font-semibold text-gray-700">
            Monto a pagar (Gs.)
          </label>
          <input
            id="monto"
            type="number"
            min="1"
            max={saldo}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
            className="input-field text-lg font-bold"
            placeholder="0"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMonto(libreta.saldo_actual)}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Pagar total ({formatGs(saldo)})
            </button>
          </div>
        </div>

        {/* Método de pago */}
        <div className="card space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Método de pago
          </label>

          <label
            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              metodoPago === 'TRANSFERENCIA'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="metodo"
              value="TRANSFERENCIA"
              checked={metodoPago === 'TRANSFERENCIA'}
              onChange={() => setMetodoPago('TRANSFERENCIA')}
              className="mt-0.5 accent-primary-600"
            />
            <div>
              <p className="font-medium text-gray-800 text-sm">Transferencia bancaria</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Banco: Banco Nacional de Fomento<br />
                Cuenta: 001-100234-5<br />
                Titular: Comedor S.A.<br />
                <span className="text-primary-600">Enviá el comprobante al comedor.</span>
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              metodoPago === 'EFECTIVO'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="metodo"
              value="EFECTIVO"
              checked={metodoPago === 'EFECTIVO'}
              onChange={() => setMetodoPago('EFECTIVO')}
              className="mt-0.5 accent-primary-600"
            />
            <div>
              <p className="font-medium text-gray-800 text-sm">Efectivo en caja</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Acercate a la caja del comedor y presentá tu nombre.
              </p>
            </div>
          </label>
        </div>

        {/* Aviso */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
          ℹ️ Tu pago será registrado como pendiente de confirmación. El saldo se actualizará
          una vez que el administrador verifique el pago.
        </div>

        <button
          type="submit"
          disabled={submitting || saldo <= 0}
          className="btn-primary w-full py-3"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Registrando...
            </span>
          ) : (
            'Registrar pago'
          )}
        </button>
      </form>
    </div>
  );
}
