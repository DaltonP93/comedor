import React, { useState } from 'react';
import { facturasApi, ventasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Alert } from '../../components/UI/Alert';
import { Modal } from '../../components/UI/Modal';
import { formatGs, getErrorMessage } from '../../lib/utils';

interface VentaPreview {
  id: number;
  total: string;
  estado: string;
  facturada: boolean;
  cliente: { id: number; nombre: string } | null;
  items: Array<{
    descripcion: string;
    cantidad: string;
    precio_unitario: string;
    iva_porcentaje: string;
    subtotal: string;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function FacturaForm({ isOpen, onClose, onSuccess }: Props) {
  const [ventaId, setVentaId] = useState('');
  const [ventaPreview, setVentaPreview] = useState<VentaPreview | null>(null);
  const [buscandoVenta, setBuscandoVenta] = useState(false);
  const [errorVenta, setErrorVenta] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('FACTURA');
  const [condicion, setCondicion] = useState('CONTADO');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const buscarVenta = async () => {
    if (!ventaId) return;
    setBuscandoVenta(true);
    setErrorVenta('');
    setVentaPreview(null);
    try {
      const res = await ventasApi.obtener(parseInt(ventaId));
      const venta = res.data.data as VentaPreview;
      if (venta.facturada) {
        setErrorVenta('Esta venta ya fue facturada');
        return;
      }
      setVentaPreview(venta);
    } catch (err) {
      setErrorVenta(getErrorMessage(err));
    } finally {
      setBuscandoVenta(false);
    }
  };

  // Calcular desglose IVA a partir de los items
  const calcularIva = () => {
    if (!ventaPreview) return { gravado10: 0, gravado5: 0, exento: 0, iva10: 0, iva5: 0 };
    let gravado10 = 0, gravado5 = 0, exento = 0, iva10 = 0, iva5 = 0;
    for (const item of ventaPreview.items) {
      const subtotal = Number(item.subtotal);
      const ivaPct = Number(item.iva_porcentaje);
      if (ivaPct === 10) {
        const ivaItem = Math.floor((subtotal * 10) / 110);
        iva10 += ivaItem;
        gravado10 += subtotal - ivaItem;
      } else if (ivaPct === 5) {
        const ivaItem = Math.floor((subtotal * 5) / 105);
        iva5 += ivaItem;
        gravado5 += subtotal - ivaItem;
      } else {
        exento += subtotal;
      }
    }
    return { gravado10, gravado5, exento, iva10, iva5 };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ventaPreview) {
      setError('Busca y selecciona una venta primero');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      await facturasApi.crear({
        venta_id: ventaPreview.id,
        cliente_id: ventaPreview.cliente?.id,
        tipo_documento: tipoDocumento,
        condicion,
      });
      onSuccess();
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setEnviando(false);
    }
  };

  const handleClose = () => {
    setVentaId('');
    setVentaPreview(null);
    setErrorVenta('');
    setTipoDocumento('FACTURA');
    setCondicion('CONTADO');
    setError('');
    onClose();
  };

  const desglose = calcularIva();

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Emitir factura" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

        {/* Buscar venta */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Venta *</label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="N° de venta"
              value={ventaId}
              onChange={(e) => setVentaId(e.target.value)}
              min={1}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={buscarVenta}
              loading={buscandoVenta}
              disabled={!ventaId}
            >
              Buscar
            </Button>
          </div>
          {errorVenta && (
            <p className="text-sm text-red-600">{errorVenta}</p>
          )}
          {ventaPreview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800">
                Venta #{ventaPreview.id} — {formatGs(Number(ventaPreview.total))}
              </p>
              {ventaPreview.cliente && (
                <p className="text-blue-600">Cliente: {ventaPreview.cliente.nombre}</p>
              )}
              <p className="text-blue-500">{ventaPreview.items.length} ítems</p>
            </div>
          )}
        </div>

        {/* Tipo y condición */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo de documento *"
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value)}
            options={[
              { value: 'FACTURA', label: 'Factura' },
              { value: 'TICKET', label: 'Ticket' },
            ]}
          />
          <Select
            label="Condición *"
            value={condicion}
            onChange={(e) => setCondicion(e.target.value)}
            options={[
              { value: 'CONTADO', label: 'Contado' },
              { value: 'CREDITO', label: 'Crédito' },
            ]}
          />
        </div>

        {/* Desglose IVA preview */}
        {ventaPreview && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm space-y-1">
            <p className="font-medium text-gray-700 mb-2">Desglose IVA</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-gray-600">Gravado 10%:</span>
              <span className="text-right font-medium">{formatGs(desglose.gravado10)}</span>
              <span className="text-gray-600">Gravado 5%:</span>
              <span className="text-right font-medium">{formatGs(desglose.gravado5)}</span>
              <span className="text-gray-600">Exento:</span>
              <span className="text-right font-medium">{formatGs(desglose.exento)}</span>
              <span className="text-gray-600">IVA 10%:</span>
              <span className="text-right font-medium">{formatGs(desglose.iva10)}</span>
              <span className="text-gray-600">IVA 5%:</span>
              <span className="text-right font-medium">{formatGs(desglose.iva5)}</span>
              <span className="font-semibold text-gray-800 border-t border-gray-300 pt-1">
                Total:
              </span>
              <span className="text-right font-bold text-gray-900 border-t border-gray-300 pt-1">
                {formatGs(Number(ventaPreview.total))}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando} disabled={!ventaPreview}>
            Emitir factura
          </Button>
        </div>
      </form>
    </Modal>
  );
}
