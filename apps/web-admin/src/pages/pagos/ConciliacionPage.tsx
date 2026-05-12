import React, { useState, useEffect, useCallback } from 'react';
import { pagosApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Alert } from '../../components/UI/Alert';
import { Badge } from '../../components/UI/Badge';
import { Modal } from '../../components/UI/Modal';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { formatGs, formatFechaHora, getErrorMessage, hoyISO } from '../../lib/utils';

interface ResumenConciliacion {
  total_confirmado: string;
  total_pendiente: string;
  total_rechazado: string;
  cantidad_confirmado: number;
  cantidad_pendiente: number;
  cantidad_rechazado: number;
}

interface PorFormaPago {
  forma_pago: string;
  total: string;
  cantidad: number;
}

interface PagoPendiente {
  id: number;
  venta_id: number | null;
  monto: string;
  forma_pago: string;
  fecha_pago: string;
  cliente: { id: number; nombre: string } | null;
  venta: { id: number; total: string } | null;
}

export default function ConciliacionPage() {
  const [fechaDesde, setFechaDesde] = useState(hoyISO());
  const [fechaHasta, setFechaHasta] = useState(hoyISO());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resumen, setResumen] = useState<ResumenConciliacion | null>(null);
  const [porFormaPago, setPorFormaPago] = useState<PorFormaPago[]>([]);
  const [pagosPendientes, setPagosPendientes] = useState<PagoPendiente[]>([]);
  const [generado, setGenerado] = useState(false);

  // Modal confirmar
  const [modalConfirmar, setModalConfirmar] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState<PagoPendiente | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Modal rechazar
  const [modalRechazar, setModalRechazar] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = {};
      if (fechaDesde) params.fecha_desde = new Date(fechaDesde).toISOString();
      if (fechaHasta) params.fecha_hasta = new Date(fechaHasta + 'T23:59:59').toISOString();

      const res = await pagosApi.conciliacion(params);
      const data = res.data.data as {
        resumen: ResumenConciliacion;
        por_forma_pago: PorFormaPago[];
        pagos_pendientes: PagoPendiente[];
      };
      setResumen(data.resumen);
      setPorFormaPago(data.por_forma_pago);
      setPagosPendientes(data.pagos_pendientes);
      setGenerado(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirConfirmar = (pago: PagoPendiente) => {
    setPagoSeleccionado(pago);
    setModalConfirmar(true);
  };

  const abrirRechazar = (pago: PagoPendiente) => {
    setPagoSeleccionado(pago);
    setMotivoRechazo('');
    setModalRechazar(true);
  };

  const confirmarPago = async () => {
    if (!pagoSeleccionado) return;
    setProcesando(true);
    try {
      await pagosApi.confirmar(pagoSeleccionado.id);
      setSuccess(`Pago #${pagoSeleccionado.id} confirmado`);
      setModalConfirmar(false);
      await cargar();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcesando(false);
    }
  };

  const rechazarPago = async () => {
    if (!pagoSeleccionado || !motivoRechazo.trim()) return;
    setProcesando(true);
    try {
      await pagosApi.rechazar(pagoSeleccionado.id, motivoRechazo);
      setSuccess(`Pago #${pagoSeleccionado.id} rechazado`);
      setModalRechazar(false);
      await cargar();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcesando(false);
    }
  };

  const labelFormaPago: Record<string, string> = {
    EFECTIVO: 'Efectivo',
    POS: 'POS',
    TRANSFERENCIA: 'Transferencia',
    BANCARD: 'Bancard',
    PAGOPAR: 'Pagopar',
    LIBRETA: 'Libreta',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Conciliación de Pagos</h1>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 flex-wrap items-end">
          <Input
            type="date"
            label="Desde"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
          <Input
            type="date"
            label="Hasta"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
          <Button onClick={cargar} loading={loading}>
            Actualizar
          </Button>
        </div>
      </div>

      {loading && !generado && <PageLoader />}

      {generado && resumen && (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Total cobrado (confirmado)</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatGs(Number(resumen.total_confirmado))}
              </p>
              <p className="text-xs text-gray-400 mt-1">{resumen.cantidad_confirmado} pagos</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Pendiente de confirmación</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">
                {formatGs(Number(resumen.total_pendiente))}
              </p>
              <p className="text-xs text-gray-400 mt-1">{resumen.cantidad_pendiente} pagos</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Rechazados</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatGs(Number(resumen.total_rechazado))}
              </p>
              <p className="text-xs text-gray-400 mt-1">{resumen.cantidad_rechazado} pagos</p>
            </div>
          </div>

          {/* Desglose por forma de pago */}
          {porFormaPago.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-800">Desglose por forma de pago</h2>
              </div>
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Forma de pago
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Cantidad
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {porFormaPago.map((fp) => (
                    <tr key={fp.forma_pago} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium">
                        {labelFormaPago[fp.forma_pago] || fp.forma_pago}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{fp.cantidad}</td>
                      <td className="px-5 py-3 text-right font-semibold">
                        {formatGs(Number(fp.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagos pendientes */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">
                Pagos pendientes de confirmación
              </h2>
            </div>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Venta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Monto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Forma pago
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pagosPendientes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No hay pagos pendientes en el período
                    </td>
                  </tr>
                ) : (
                  pagosPendientes.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">#{p.id}</td>
                      <td className="px-4 py-3">
                        {p.venta_id ? `#${p.venta_id}` : '-'}
                      </td>
                      <td className="px-4 py-3">{p.cliente?.nombre || 'Anónimo'}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatGs(Number(p.monto))}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="info" size="sm">
                          {labelFormaPago[p.forma_pago] || p.forma_pago}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatFechaHora(p.fecha_pago)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => abrirConfirmar(p)}
                          >
                            Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => abrirRechazar(p)}
                          >
                            Rechazar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal Confirmar */}
      <Modal
        isOpen={modalConfirmar}
        onClose={() => setModalConfirmar(false)}
        title="Confirmar pago"
        size="sm"
      >
        <div className="space-y-4">
          {pagoSeleccionado && (
            <p className="text-gray-700">
              ¿Confirmar el pago{' '}
              <span className="font-semibold">#{pagoSeleccionado.id}</span> de{' '}
              <span className="font-semibold">
                {formatGs(Number(pagoSeleccionado.monto))}
              </span>
              ?
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalConfirmar(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmarPago} loading={procesando}>
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Rechazar */}
      <Modal
        isOpen={modalRechazar}
        onClose={() => setModalRechazar(false)}
        title="Rechazar pago"
        size="sm"
      >
        <div className="space-y-4">
          {pagoSeleccionado && (
            <p className="text-gray-700">
              Rechazar el pago{' '}
              <span className="font-semibold">#{pagoSeleccionado.id}</span> de{' '}
              <span className="font-semibold">
                {formatGs(Number(pagoSeleccionado.monto))}
              </span>
            </p>
          )}
          <Input
            label="Motivo del rechazo"
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            placeholder="Ej: Fondos insuficientes"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalRechazar(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={rechazarPago}
              loading={procesando}
              disabled={!motivoRechazo.trim()}
            >
              Rechazar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
