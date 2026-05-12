import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { reservasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { PageBack } from '../../components/UI/PageBack';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { Modal } from '../../components/UI/Modal';
import { Select } from '../../components/UI/Select';
import { formatGs, formatFechaHora, getErrorMessage } from '../../lib/utils';

const ESTADOS_RESERVA = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'CONFIRMADA', label: 'Confirmada' },
  { value: 'EN_COCINA', label: 'En cocina' },
  { value: 'PREPARADA', label: 'Preparada' },
  { value: 'ENTREGADA', label: 'Entregada' },
];

export function ReservaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reserva, setReserva] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showVentaModal, setShowVentaModal] = useState(false);
  const [formaPago, setFormaPago] = useState('EFECTIVO');
  const [nuevoEstado, setNuevoEstado] = useState('');

  useEffect(() => { loadReserva(); }, [id]);

  const loadReserva = async () => {
    setLoading(true);
    try {
      const res = await reservasApi.obtener(parseInt(id!));
      setReserva(res.data.data as Record<string, unknown>);
      setNuevoEstado(String(res.data.data.estado));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstado = async () => {
    if (!nuevoEstado || nuevoEstado === reserva?.estado) return;
    setSaving(true);
    try {
      await reservasApi.actualizarEstado(parseInt(id!), nuevoEstado);
      loadReserva();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelar = async () => {
    if (!confirm('¿Cancelar esta reserva?')) return;
    setSaving(true);
    try {
      await reservasApi.cancelar(parseInt(id!));
      loadReserva();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleConvertirVenta = async () => {
    setSaving(true);
    try {
      await reservasApi.convertirVenta(parseInt(id!), { forma_pago: formaPago });
      setShowVentaModal(false);
      navigate('/ventas');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!reserva) return <Alert type="error">{error}</Alert>;

  const badge = estadoBadge(String(reserva.estado));
  const cliente = reserva.cliente as Record<string, unknown>;
  const menu = reserva.menu as Record<string, unknown>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <PageBack to="/reservas" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Reserva #{id}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
        </div>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Cliente</p>
            <p className="text-sm font-medium">{String(cliente?.nombre ?? '-')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Menú</p>
            <p className="text-sm font-medium">{String(menu?.titulo ?? '-')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Cantidad</p>
            <p className="text-sm font-medium">{Number(reserva.cantidad)} porción(es)</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-sm font-medium text-blue-600">{formatGs(Number(reserva.total))}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Tipo entrega</p>
            <p className="text-sm font-medium">{String(reserva.tipo_entrega)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Forma pago prevista</p>
            <p className="text-sm font-medium">{String(reserva.forma_pago_prevista || '-')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Creada</p>
            <p className="text-sm font-medium">{formatFechaHora(String(reserva.creado_en))}</p>
          </div>
          {Boolean(reserva.observacion) && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Observación</p>
              <p className="text-sm">{String(reserva.observacion)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {Boolean(!['CANCELADA', 'ENTREGADA'].includes(String(reserva.estado))) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-medium text-gray-900 mb-4">Acciones</h3>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Select
                label="Cambiar estado"
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value)}
                options={ESTADOS_RESERVA}
              />
            </div>
            <Button onClick={handleCambiarEstado} loading={saving} disabled={nuevoEstado === reserva.estado}>
              Actualizar estado
            </Button>
          </div>
          <div className="flex gap-3 mt-4">
            {!Boolean(reserva.venta_id) && (
              <Button variant="success" onClick={() => setShowVentaModal(true)}>
                Convertir en venta
              </Button>
            )}
            <Button variant="danger" onClick={handleCancelar} loading={saving}>
              Cancelar reserva
            </Button>
          </div>
        </div>
      )}

      {Boolean(reserva.venta_id) && (
        <Alert type="success">
          Esta reserva fue convertida en venta #{String(reserva.venta_id)}
        </Alert>
      )}

      {/* Modal convertir venta */}
      <Modal isOpen={showVentaModal} onClose={() => setShowVentaModal(false)} title="Convertir en venta">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Se creará una venta por {formatGs(Number(reserva.total))} para {String(cliente?.nombre)}.
          </p>
          <Select
            label="Forma de pago"
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value)}
            options={[
              { value: 'EFECTIVO', label: 'Efectivo' },
              { value: 'LIBRETA', label: 'Libreta / Cuenta corriente' },
              { value: 'POS', label: 'Tarjeta POS' },
              { value: 'TRANSFERENCIA', label: 'Transferencia' },
            ]}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowVentaModal(false)}>Cancelar</Button>
            <Button onClick={handleConvertirVenta} loading={saving}>Confirmar venta</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
