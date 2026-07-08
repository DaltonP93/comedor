import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { libretasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Badge } from '../../components/UI/Badge';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { formatGs, getErrorMessage } from '../../lib/utils';

const FORMAS_PAGO = ['EFECTIVO', 'POS', 'TRANSFERENCIA', 'QR'];

export function LibretaCobroPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [libreta, setLibreta] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [monto, setMonto] = useState('');
  const [formaPago, setFormaPago] = useState('EFECTIVO');
  const [referencia, setReferencia] = useState('');
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    libretasApi.obtener(parseInt(id!))
      .then(r => setLibreta(r.data.data as Record<string, unknown>))
      .catch(err => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const cobrar = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) { setError('Ingrese un monto válido.'); return; }
    const saldo = Number(libreta?.saldo_actual || 0);
    if (montoNum > saldo) { setError(`El monto no puede superar el saldo actual (${formatGs(saldo)}).`); return; }

    setSaving(true);
    setError('');
    try {
      await libretasApi.pago(parseInt(id!), {
        monto: Math.round(montoNum),
        forma_pago: formaPago,
        referencia: referencia || undefined,
        observacion: observacion || undefined,
      });
      setSuccess(`Pago de ${formatGs(montoNum)} registrado correctamente.`);
      const r = await libretasApi.obtener(parseInt(id!));
      setLibreta(r.data.data as Record<string, unknown>);
      setMonto('');
      setReferencia('');
      setObservacion('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!libreta) return <Alert type="error">{error || 'Libreta no encontrada.'}</Alert>;

  const saldo = Number(libreta.saldo_actual || 0);
  const limite = Number(libreta.limite_credito || 0);
  const estado = String(libreta.estado || '');
  const porcentaje = limite > 0 ? Math.min((saldo / limite) * 100, 100) : 0;
  const cliente = libreta.cliente as Record<string, unknown> | undefined;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <button onClick={() => navigate(`/libretas/${id}`)} className="text-sm text-gray-500 hover:text-gray-700 mb-1">← Volver a libreta</button>
        <h1 className="text-2xl font-bold text-gray-900">Cobro de Libreta</h1>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      {/* Info de la libreta */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="font-semibold text-gray-900 text-lg">{String(cliente?.nombre || 'Cliente')}</p>
            <p className="text-sm text-gray-500">Libreta #{id}</p>
          </div>
          <Badge variant={estado === 'ACTIVA' ? 'success' : estado === 'BLOQUEADA' ? 'danger' : 'warning'}>
            {estado}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Saldo actual (deuda)</p>
            <p className="text-2xl font-bold text-red-600">{formatGs(saldo)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Límite de crédito</p>
            <p className="text-2xl font-bold text-gray-900">{formatGs(limite)}</p>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${porcentaje > 80 ? 'bg-red-500' : porcentaje > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{porcentaje.toFixed(0)}% del límite utilizado</p>
      </div>

      {/* Formulario de cobro */}
      {saldo > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Registrar Pago</h2>
          <form onSubmit={cobrar} className="space-y-4">
            <div>
              <Input
                label="Monto a cobrar (Gs.) *"
                type="number"
                min="1"
                max={saldo}
                value={monto}
                onChange={e => setMonto(e.target.value)}
                required
                placeholder={`Máximo: ${formatGs(saldo)}`}
              />
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setMonto(String(saldo))}
                  className="text-xs text-blue-600 hover:underline">
                  Pago total ({formatGs(saldo)})
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago *</label>
              <select
                value={formaPago}
                onChange={e => setFormaPago(e.target.value)}
                className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              >
                {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <Input
              label="Referencia / Voucher"
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="Número de recibo, voucher POS..."
            />

            <Input
              label="Observación"
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              placeholder="Observación opcional..."
            />

            <Button type="submit" loading={saving} className="w-full">
              Registrar Pago de {monto ? formatGs(parseFloat(monto) || 0) : 'Gs. 0'}
            </Button>
          </form>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-700 font-semibold text-lg">✓ Libreta al día</p>
          <p className="text-green-600 text-sm mt-1">El cliente no tiene saldo pendiente.</p>
        </div>
      )}
    </div>
  );
}
