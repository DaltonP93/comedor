import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { facturasApi } from '../../api/endpoints';
import apiClient from '../../api/client';
import { Button } from '../../components/UI/Button';
import { Badge } from '../../components/UI/Badge';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { Modal } from '../../components/UI/Modal';
import { Input } from '../../components/UI/Input';
import { formatGs, formatFechaHora, getErrorMessage } from '../../lib/utils';

const ESTADO_COLOR: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'default'> = {
  EMITIDA_LOCAL: 'info',
  PENDIENTE_SIFEN: 'warning',
  APROBADA_SIFEN: 'success',
  RECHAZADA_SIFEN: 'danger',
  ANULADA: 'default',
  BORRADOR: 'default',
};

export function FacturaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [factura, setFactura] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAnular, setShowAnular] = useState(false);
  const [showNotaCredito, setShowNotaCredito] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    facturasApi.obtener(parseInt(id!))
      .then(r => setFactura(r.data.data as Record<string, unknown>))
      .catch(err => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const descargarPDF = async () => {
    try {
      const res = await facturasApi.pdf(parseInt(id!));
      const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const anular = async () => {
    if (!motivo.trim()) { setError('El motivo es obligatorio.'); return; }
    setSaving(true);
    try {
      await apiClient.post(`/facturas/${id}/anular`, { motivo });
      setSuccess('Factura anulada correctamente.');
      setShowAnular(false);
      setMotivo('');
      const r = await facturasApi.obtener(parseInt(id!));
      setFactura(r.data.data as Record<string, unknown>);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const emitirNotaCredito = async () => {
    if (!motivo.trim()) { setError('El motivo es obligatorio.'); return; }
    setSaving(true);
    try {
      await apiClient.post(`/facturas/${id}/nota-credito`, { motivo });
      setSuccess('Nota de crédito emitida correctamente.');
      setShowNotaCredito(false);
      setMotivo('');
      const r = await facturasApi.obtener(parseInt(id!));
      setFactura(r.data.data as Record<string, unknown>);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const reenviarSifen = async () => {
    setSaving(true);
    try {
      await facturasApi.reenviarSifen(parseInt(id!));
      setSuccess('Reenviado a SIFEN correctamente.');
      const r = await facturasApi.obtener(parseInt(id!));
      setFactura(r.data.data as Record<string, unknown>);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!factura) return <Alert type="error">{error || 'Factura no encontrada.'}</Alert>;

  const doc = (factura.documento_fiscal || factura) as Record<string, unknown>;
  const eventos = (doc.eventos || factura.eventos || []) as Array<Record<string, unknown>>;
  const estado = String(doc.estado || factura.estado || '');
  const estadoSifen = String(doc.estado_sifen || '');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-1">← Volver</button>
          <h1 className="text-2xl font-bold text-gray-900">
            Factura {String(doc.numero_formateado || factura.numero_formateado || `#${id}`)}
          </h1>
        </div>
        <div className="flex gap-2">
          <Badge variant={ESTADO_COLOR[estado] || 'default'}>{estado}</Badge>
          {estadoSifen && <Badge variant={ESTADO_COLOR[estadoSifen] || 'default'}>SIFEN: {estadoSifen}</Badge>}
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={descargarPDF}>⬇ PDF</Button>
        {estado !== 'ANULADA' && (
          <>
            <Button variant="secondary" onClick={() => { setMotivo(''); setShowNotaCredito(true); }}>
              Nota de Crédito
            </Button>
            <Button variant="danger" onClick={() => { setMotivo(''); setShowAnular(true); }}>
              Anular
            </Button>
          </>
        )}
        {estadoSifen && estadoSifen !== 'APROBADA_SIFEN' && (
          <Button variant="secondary" onClick={reenviarSifen} loading={saving}>
            Reenviar SIFEN
          </Button>
        )}
      </div>

      {/* Datos del documento */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos del Documento</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            ['Número', String(doc.numero_formateado || factura.numero_formateado || '-')],
            ['Timbrado', String(doc.timbrado || factura.timbrado || '-')],
            ['Tipo', String(doc.tipo_documento || factura.tipo_documento || '-')],
            ['Condición', String(doc.condicion || factura.condicion || '-')],
            ['Fecha emisión', formatFechaHora(String(doc.fecha_emision || factura.creado_en || ''))],
            ['CDC', String(doc.cdc || '-').substring(0, 20) + (String(doc.cdc || '').length > 20 ? '...' : '')],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-medium text-gray-500">{k}</dt>
              <dd className="text-sm text-gray-900 font-medium mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Totales IVA */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Desglose IVA</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {['Gravado 5%', 'IVA 5%', 'Gravado 10%', 'IVA 10%', 'Exento', 'Total'].map(h => (
                <th key={h} className="py-2 text-right text-xs font-medium text-gray-500 first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 text-left">{formatGs(String(doc.gravado_5 || 0))}</td>
              <td className="py-2 text-right">{formatGs(String(doc.iva_5 || 0))}</td>
              <td className="py-2 text-right">{formatGs(String(doc.gravado_10 || 0))}</td>
              <td className="py-2 text-right">{formatGs(String(doc.iva_10 || 0))}</td>
              <td className="py-2 text-right">{formatGs(String(doc.exento || 0))}</td>
              <td className="py-2 text-right font-bold text-gray-900">{formatGs(String(doc.total || factura.total || 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Eventos */}
      {eventos.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Historial de eventos</h2>
          <ol className="relative border-l border-gray-200 space-y-4 ml-3">
            {eventos.map(ev => (
              <li key={Number(ev.id)} className="ml-6">
                <span className="absolute -left-3 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="w-2 h-2 bg-blue-600 rounded-full" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{String(ev.tipo_evento)}</p>
                  {ev.estado_anterior != null && <p className="text-xs text-gray-500">{String(ev.estado_anterior)} → {String(ev.estado_nuevo)}</p>}
                  <p className="text-xs text-gray-400">{formatFechaHora(String(ev.creado_en))}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Modal Anular */}
      <Modal isOpen={showAnular} onClose={() => setShowAnular(false)} title="Anular Factura">
        <div className="space-y-4">
          <Alert type="warning">Esta acción anulará el documento fiscal. Si está aprobado en SIFEN, se enviará cancelación.</Alert>
          <Input label="Motivo de anulación *" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Descripción del motivo..." />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowAnular(false)}>Cancelar</Button>
            <Button variant="danger" onClick={anular} loading={saving}>Anular</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Nota de Crédito */}
      <Modal isOpen={showNotaCredito} onClose={() => setShowNotaCredito(false)} title="Emitir Nota de Crédito">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Se emitirá una nota de crédito referenciando esta factura y se anulará el documento original.</p>
          <Input label="Motivo *" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo de la nota de crédito..." />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowNotaCredito(false)}>Cancelar</Button>
            <Button onClick={emitirNotaCredito} loading={saving}>Emitir Nota de Crédito</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
