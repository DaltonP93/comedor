import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { libretasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { Modal } from '../../components/UI/Modal';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { formatGs, formatFechaHora, getErrorMessage } from '../../lib/utils';

export function LibretaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [libreta, setLibreta] = useState<Record<string, unknown> | null>(null);
  const [movimientos, setMovimientos] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [montoPago, setMontoPago] = useState('');
  const [formaPago, setFormaPago] = useState('EFECTIVO');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [libRes, movRes] = await Promise.all([
        libretasApi.obtener(parseInt(id!)),
        libretasApi.movimientos(parseInt(id!), { limit: 30 }),
      ]);
      setLibreta(libRes.data.data as Record<string, unknown>);
      setMovimientos(movRes.data.data as Array<Record<string, unknown>>);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePago = async () => {
    if (!montoPago || parseInt(montoPago) <= 0) {
      setError('Ingrese un monto válido');
      return;
    }
    setSaving(true);
    try {
      await libretasApi.pago(parseInt(id!), { monto: parseInt(montoPago), forma_pago: formaPago });
      setShowPagoModal(false);
      setMontoPago('');
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!libreta) return <Alert type="error">{error}</Alert>;

  const badge = estadoBadge(String(libreta.estado));
  const cliente = libreta.cliente as Record<string, unknown>;
  const saldo = Number(libreta.saldo_actual);
  const limite = Number(libreta.limite_credito);
  const disponible = limite - saldo;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/libretas')}>← Volver</Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Libreta #{id}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-gray-500 text-sm">{String(cliente?.nombre)} · {String(libreta.tipo)}</p>
        </div>
        {libreta.estado === 'ACTIVA' && (
          <Button onClick={() => setShowPagoModal(true)} variant="success">
            Registrar pago
          </Button>
        )}
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Saldo actual (debe)</p>
          <p className={`text-2xl font-bold ${saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatGs(saldo)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Límite de crédito</p>
          <p className="text-2xl font-bold text-gray-900">{formatGs(limite)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Disponible</p>
          <p className={`text-2xl font-bold ${disponible <= 0 ? 'text-red-600' : 'text-green-600'}`}>{formatGs(disponible)}</p>
        </div>
      </div>

      {/* Movimientos */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Movimientos</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {movimientos.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-500 text-sm">Sin movimientos</p>
          ) : (
            movimientos.map((mov) => (
              <div key={String(mov.id)} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium">
                    <span className={`mr-2 px-1.5 py-0.5 rounded text-xs ${mov.tipo_movimiento === 'CARGO' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {String(mov.tipo_movimiento)}
                    </span>
                    {String(mov.descripcion || '-')}
                  </p>
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
      </div>

      {/* Payment modal */}
      <Modal isOpen={showPagoModal} onClose={() => setShowPagoModal(false)} title="Registrar pago">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Saldo actual: <strong className="text-red-600">{formatGs(saldo)}</strong></p>
          <Input
            label="Monto del pago (Gs.)"
            type="number"
            min="1"
            max={saldo}
            value={montoPago}
            onChange={(e) => setMontoPago(e.target.value)}
            placeholder="Ingrese el monto"
          />
          <Select
            label="Forma de pago"
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value)}
            options={[
              { value: 'EFECTIVO', label: 'Efectivo' },
              { value: 'POS', label: 'Tarjeta POS' },
              { value: 'TRANSFERENCIA', label: 'Transferencia' },
              { value: 'CHEQUE', label: 'Cheque' },
            ]}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowPagoModal(false)}>Cancelar</Button>
            <Button variant="success" onClick={handlePago} loading={saving}>Confirmar pago</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
