import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ventasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { Modal } from '../../components/UI/Modal';
import { Input } from '../../components/UI/Input';
import { formatGs, formatFechaHora, getErrorMessage } from '../../lib/utils';

export function VentaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [venta, setVenta] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  useEffect(() => { loadVenta(); }, [id]);

  const loadVenta = async () => {
    setLoading(true);
    try {
      const res = await ventasApi.obtener(parseInt(id!));
      setVenta(res.data.data as Record<string, unknown>);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAnular = async () => {
    if (!motivoAnulacion.trim()) {
      setError('Ingrese un motivo para la anulación');
      return;
    }
    setSaving(true);
    try {
      await ventasApi.anular(parseInt(id!), motivoAnulacion.trim());
      setShowAnularModal(false);
      setMotivoAnulacion('');
      loadVenta();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!venta) return <Alert type="error">{error || 'Venta no encontrada'}</Alert>;

  const badge = estadoBadge(String(venta.estado));
  const cliente = venta.cliente as Record<string, unknown> | null;
  const usuario = venta.usuario as Record<string, unknown> | null;
  const items = (venta.items as Array<Record<string, unknown>>) ?? [];
  const pagos = (venta.pagos as Array<Record<string, unknown>>) ?? [];
  const factura = venta.factura as Record<string, unknown> | null;

  const subtotal = Number(venta.subtotal ?? 0);
  const descuento = Number(venta.descuento ?? 0);
  const iva = Number(venta.iva ?? 0);
  const total = Number(venta.total ?? 0);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>← Volver</Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Venta #{id}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-gray-500 text-sm">
            {formatFechaHora(String(venta.creado_en))}
            {usuario && ` · ${String(usuario.nombre)} ${String(usuario.apellido ?? '')}`}
          </p>
        </div>
        {venta.estado === 'COMPLETADA' && (
          <Button variant="danger" onClick={() => setShowAnularModal(true)}>
            Anular venta
          </Button>
        )}
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Info cliente */}
      {cliente && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Cliente</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Nombre</p>
              <p className="text-sm font-medium">{String(cliente.nombre)}</p>
            </div>
            {cliente.documento_numero && (
              <div>
                <p className="text-xs text-gray-500">Documento</p>
                <p className="text-sm font-medium">{String(cliente.documento_numero)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Artículos</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Descripción</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cant.</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Unidad</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Precio unit.</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-gray-500">Sin artículos</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={String(item.id)} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-900">{String(item.descripcion)}</td>
                  <td className="px-5 py-3 text-sm text-right text-gray-700">{Number(item.cantidad)}</td>
                  <td className="px-5 py-3 text-sm text-right text-gray-500">{String(item.unidad_medida ?? '-')}</td>
                  <td className="px-5 py-3 text-sm text-right text-gray-700">{formatGs(Number(item.precio_unitario))}</td>
                  <td className="px-5 py-3 text-sm text-right font-semibold text-gray-900">{formatGs(Number(item.total))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totales */}
        <div className="border-t border-gray-200 px-5 py-4 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatGs(subtotal)}</span>
          </div>
          {descuento > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Descuento</span>
              <span className="text-red-600">- {formatGs(descuento)}</span>
            </div>
          )}
          {iva > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>IVA</span>
              <span>{formatGs(iva)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
            <span>TOTAL</span>
            <span>{formatGs(total)}</span>
          </div>
        </div>
      </div>

      {/* Pagos */}
      {pagos.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Pagos</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Forma de pago</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Monto</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Referencia</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagos.map((pago) => (
                <tr key={String(pago.id)}>
                  <td className="px-5 py-3 text-sm text-gray-900">{String(pago.forma_pago)}</td>
                  <td className="px-5 py-3 text-sm text-right font-semibold text-gray-900">{formatGs(Number(pago.monto))}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">{String(pago.referencia_externa ?? '-')}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">{formatFechaHora(String(pago.creado_en))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Factura */}
      {factura && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Factura</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Número</p>
              <p className="text-sm font-medium">{String(factura.numero ?? '-')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Estado</p>
              <p className="text-sm font-medium">{String(factura.estado ?? '-')}</p>
            </div>
            {factura.cdc && (
              <div>
                <p className="text-xs text-gray-500">CDC</p>
                <p className="text-sm font-medium break-all">{String(factura.cdc)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal anulación */}
      <Modal isOpen={showAnularModal} onClose={() => { setShowAnularModal(false); setMotivoAnulacion(''); }} title="Anular venta">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Esta acción revertirá el stock y los movimientos de libreta asociados a la venta <strong>#{id}</strong>. No se puede deshacer.
          </p>
          <Input
            label="Motivo de anulación"
            value={motivoAnulacion}
            onChange={(e) => setMotivoAnulacion(e.target.value)}
            placeholder="Ingrese el motivo"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setShowAnularModal(false); setMotivoAnulacion(''); }}>Cancelar</Button>
            <Button variant="danger" onClick={handleAnular} loading={saving}>Confirmar anulación</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
