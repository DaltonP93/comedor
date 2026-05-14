import React, { useState, useEffect, useCallback } from 'react';
import { facturasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Select } from '../../components/UI/Select';
import { Alert } from '../../components/UI/Alert';
import { Badge } from '../../components/UI/Badge';
import { Pagination } from '../../components/UI/Pagination';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { FacturaForm } from './FacturaForm';
import { formatGs, formatFecha, getErrorMessage } from '../../lib/utils';
import apiClient from '../../api/client';

interface Factura {
  id: number;
  numero: string;
  tipo_documento: string;
  estado: string;
  fecha: string;
  subtotal: string;
  iva_total: string;
  total: string;
  cliente: { id: number; nombre: string; ruc: string | null } | null;
  venta: { id: number; total: string } | null;
}

const ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'EMITIDA', label: 'Emitida' },
  { value: 'ANULADA', label: 'Anulada' },
  { value: 'PENDIENTE_SIFEN', label: 'Pendiente SIFEN' },
  { value: 'RECHAZADA_SIFEN', label: 'Rechazada SIFEN' },
  { value: 'ENVIANDO_SIFEN', label: 'Enviando SIFEN' },
];

const labelEstado: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' | 'default' | 'purple' }> = {
  EMITIDA: { label: 'Emitida', variant: 'success' },
  ANULADA: { label: 'Anulada', variant: 'danger' },
  PENDIENTE_SIFEN: { label: 'Pend. SIFEN', variant: 'warning' },
  RECHAZADA_SIFEN: { label: 'Rechaz. SIFEN', variant: 'danger' },
  ENVIANDO_SIFEN: { label: 'Enviando SIFEN', variant: 'info' },
  VIGENTE: { label: 'Vigente', variant: 'success' },
};

const labelTipo: Record<string, string> = {
  FACTURA: 'Factura',
  TICKET: 'Ticket',
  NOTA_CREDITO: 'Nota de Crédito',
};

export default function FacturasPage() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;
  const [modalForm, setModalForm] = useState(false);
  const [anulando, setAnulando] = useState<number | null>(null);
  const [reenviando, setReenviando] = useState<number | null>(null);
  const [descargando, setDescargando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (estadoFiltro) params.estado = estadoFiltro;
      const res = await facturasApi.listar(params);
      setFacturas(res.data.data as Factura[]);
      setTotalPages(res.data.meta?.totalPages || 1);
      setTotal(res.data.meta?.total || 0);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, estadoFiltro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleAnular = async (id: number) => {
    if (!confirm('¿Anular esta factura? Esta acción no se puede deshacer.')) return;
    setAnulando(id);
    try {
      await facturasApi.anular(id, 'Anulación manual');
      setSuccess('Factura anulada');
      await cargar();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAnulando(null);
    }
  };

  const handleReenviarSifen = async (id: number) => {
    setReenviando(id);
    try {
      const res = await facturasApi.reenviarSifen(id);
      const msg = (res.data as { message?: string }).message || 'Solicitud enviada';
      setSuccess(msg);
      await cargar();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setReenviando(null);
    }
  };

  const handleVerPdf = async (id: number, numero: string) => {
    setDescargando(id);
    try {
      const res = await apiClient.get<Blob>(`/facturas/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDescargando(null);
    }
  };

  const getBadge = (estado: string) => {
    const cfg = labelEstado[estado] || { label: estado, variant: 'default' as const };
    return <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
        <Button onClick={() => setModalForm(true)}>Emitir factura</Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 flex-wrap items-end">
          <Select
            label="Estado"
            value={estadoFiltro}
            onChange={(e) => { setEstadoFiltro(e.target.value); setPage(1); }}
            options={ESTADOS}
          />
          <Button variant="secondary" onClick={() => { setEstadoFiltro(''); setPage(1); }}>
            Limpiar filtros
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><PageLoader /></div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Venta</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">IVA</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {facturas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      No se encontraron facturas
                    </td>
                  </tr>
                ) : (
                  facturas.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{f.numero}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {labelTipo[f.tipo_documento] || f.tipo_documento}
                      </td>
                      <td className="px-4 py-3">
                        {f.cliente ? (
                          <div>
                            <p>{f.cliente.nombre}</p>
                            {f.cliente.ruc && (
                              <p className="text-xs text-gray-400">RUC: {f.cliente.ruc}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">Consumidor final</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {f.venta ? `#${f.venta.id}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatGs(Number(f.total))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatGs(Number(f.iva_total))}
                      </td>
                      <td className="px-4 py-3">{getBadge(f.estado)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatFecha(f.fecha)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleVerPdf(f.id, f.numero)}
                            loading={descargando === f.id}
                          >
                            PDF
                          </Button>
                          {(f.estado === 'EMITIDA' || f.estado === 'VIGENTE') && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleAnular(f.id)}
                              loading={anulando === f.id}
                            >
                              Anular
                            </Button>
                          )}
                          {(f.estado === 'PENDIENTE_SIFEN' || f.estado === 'RECHAZADA_SIFEN') && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleReenviarSifen(f.id)}
                              loading={reenviando === f.id}
                            >
                              Reenv. SIFEN
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={LIMIT}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>

      <FacturaForm
        isOpen={modalForm}
        onClose={() => setModalForm(false)}
        onSuccess={() => {
          setSuccess('Factura emitida correctamente');
          cargar();
        }}
      />
    </div>
  );
}
