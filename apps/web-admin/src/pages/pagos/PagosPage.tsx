import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pagosApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Table } from '../../components/UI/Table';
import { Badge } from '../../components/UI/Badge';
import { Pagination } from '../../components/UI/Pagination';
import { Alert } from '../../components/UI/Alert';
import { Modal } from '../../components/UI/Modal';
import { formatGs, formatFechaHora, getErrorMessage, hoyISO } from '../../lib/utils';

interface Pago {
  id: number;
  monto: number | string;
  forma_pago: string;
  estado: string;
  creado_en: string;
  venta?: { id: number; total: number | string };
  cliente?: { nombre: string } | null;
}

const ESTADO_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
  CONFIRMADO: 'success',
  PENDIENTE: 'warning',
  RECHAZADO: 'danger',
  ANULADO: 'default',
  EXPIRADO: 'default',
  CREADO: 'info',
};

const FORMAS_PAGO = ['', 'EFECTIVO', 'POS', 'QR', 'TRANSFERENCIA', 'LIBRETA', 'BANCARD', 'PAGOPAR'];
const ESTADOS = ['', 'PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'ANULADO', 'EXPIRADO'];

export function PagosPage() {
  const navigate = useNavigate();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [estado, setEstado] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [fechaDesde, setFechaDesde] = useState(hoyISO());
  const [showMotivo, setShowMotivo] = useState(false);
  const [pagoAccion, setPagoAccion] = useState<{ id: number; accion: 'rechazar' } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await pagosApi.listar({
        estado: estado || undefined,
        forma_pago: formaPago || undefined,
        fecha_desde: fechaDesde ? new Date(fechaDesde).toISOString() : undefined,
        page,
        limit: 20,
      });
      setPagos(res.data.data as Pago[]);
      setMeta(res.data.meta || { total: 0, totalPages: 1 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [estado, formaPago, fechaDesde, page]);

  useEffect(() => { load(); }, [load]);

  const confirmar = async (id: number) => {
    setSaving(true);
    try {
      await pagosApi.confirmar(id);
      setSuccess('Pago confirmado.');
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const rechazar = async () => {
    if (!pagoAccion) return;
    setSaving(true);
    try {
      await pagosApi.rechazar(pagoAccion.id, motivo);
      setSuccess('Pago rechazado.');
      setShowMotivo(false);
      setMotivo('');
      setPagoAccion(null);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
          <select value={estado} onChange={e => { setEstado(e.target.value); setPage(1); }}
            className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            {ESTADOS.map(e => <option key={e} value={e}>{e || 'Todos'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Forma de pago</label>
          <select value={formaPago} onChange={e => { setFormaPago(e.target.value); setPage(1); }}
            className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            {FORMAS_PAGO.map(f => <option key={f} value={f}>{f || 'Todas'}</option>)}
          </select>
        </div>
        <div>
          <Input label="Desde" type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(1); }} />
        </div>
        <div className="flex items-end">
          <Button variant="secondary" onClick={load} className="w-full">Filtrar</Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <p className="text-center text-gray-500 py-12">Cargando...</p>
        ) : pagos.length === 0 ? (
          <p className="text-center text-gray-400 py-12">Sin pagos para los filtros seleccionados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['ID', 'Cliente', 'Venta', 'Forma Pago', 'Monto', 'Estado', 'Fecha', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pagos.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono">#{p.id}</td>
                    <td className="px-4 py-3 text-sm">{p.cliente?.nombre || 'S/N'}</td>
                    <td className="px-4 py-3 text-sm">
                      {p.venta ? (
                        <button onClick={() => navigate(`/ventas/${p.venta!.id}`)} className="text-blue-600 hover:underline">
                          #{p.venta.id}
                        </button>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">{p.forma_pago}</td>
                    <td className="px-4 py-3 text-sm font-medium">{formatGs(p.monto)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ESTADO_COLOR[p.estado] || 'default'}>{p.estado}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatFechaHora(p.creado_en)}</td>
                    <td className="px-4 py-3 text-sm">
                      {p.estado === 'PENDIENTE' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => confirmar(p.id)}
                            disabled={saving}
                            className="text-green-600 hover:text-green-800 text-xs font-medium disabled:opacity-50"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => { setPagoAccion({ id: p.id, accion: 'rechazar' }); setShowMotivo(true); }}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={20} onPageChange={(p: number) => setPage(p)} />

      <Modal isOpen={showMotivo} onClose={() => setShowMotivo(false)} title="Rechazar Pago">
        <div className="space-y-4">
          <Input label="Motivo del rechazo" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ingrese el motivo..." />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowMotivo(false)}>Cancelar</Button>
            <Button variant="danger" onClick={rechazar} loading={saving}>Rechazar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
