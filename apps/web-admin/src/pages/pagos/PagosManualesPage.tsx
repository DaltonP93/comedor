import React, { useState, useEffect, useCallback } from 'react';
import { pagosApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Alert } from '../../components/UI/Alert';
import { Badge } from '../../components/UI/Badge';
import { Card } from '../../components/UI/Card';
import { formatGs, formatFechaHora, getErrorMessage } from '../../lib/utils';

interface PagoManual {
  id: number;
  venta_id: number | null;
  monto: string;
  voucher: string | null;
  autorizacion: string | null;
  referencia_externa: string | null;
  estado: string;
  fecha_pago: string;
  cliente: { nombre: string } | null;
  venta: { id: number; total: string } | null;
}

interface FormData {
  venta_id: string;
  monto: string;
  voucher: string;
  autorizacion: string;
  referencia_externa: string;
}

const FORM_INICIAL: FormData = {
  venta_id: '',
  monto: '',
  voucher: '',
  autorizacion: '',
  referencia_externa: '',
};

export default function PagosManualesPage() {
  const [form, setForm] = useState<FormData>(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagosRecientes, setPagosRecientes] = useState<PagoManual[]>([]);
  const [cargandoRecientes, setCargandoRecientes] = useState(false);

  const cargarRecientes = useCallback(async () => {
    setCargandoRecientes(true);
    try {
      const res = await pagosApi.listar({ forma_pago: 'POS', limit: '20' });
      setPagosRecientes(res.data.data as PagoManual[]);
    } catch {
      // silencioso
    } finally {
      setCargandoRecientes(false);
    }
  }, []);

  useEffect(() => {
    cargarRecientes();
  }, [cargarRecientes]);

  const handleChange = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.venta_id || !form.monto || !form.voucher || !form.autorizacion) {
      setError('Completa los campos obligatorios: Venta, Monto, Voucher y Autorización');
      return;
    }

    setEnviando(true);
    try {
      await pagosApi.posManual({
        venta_id: parseInt(form.venta_id),
        monto: parseInt(form.monto),
        voucher: form.voucher,
        autorizacion: form.autorizacion,
        referencia_externa: form.referencia_externa || undefined,
      });
      setSuccess('Pago POS registrado correctamente');
      setForm(FORM_INICIAL);
      await cargarRecientes();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setEnviando(false);
    }
  };

  const badgeEstado = (estado: string) => {
    if (estado === 'CONFIRMADO') return <Badge variant="success" size="sm">Confirmado</Badge>;
    if (estado === 'PENDIENTE') return <Badge variant="warning" size="sm">Pendiente</Badge>;
    if (estado === 'RECHAZADO') return <Badge variant="danger" size="sm">Rechazado</Badge>;
    return <Badge size="sm">{estado}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Pagos POS Manuales</h1>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Formulario */}
      <Card title="Registrar pago POS">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="N° de Venta *"
              type="number"
              placeholder="Ej: 123"
              value={form.venta_id}
              onChange={handleChange('venta_id')}
              min={1}
            />
            <Input
              label="Monto (Gs.) *"
              type="number"
              placeholder="Ej: 50000"
              value={form.monto}
              onChange={handleChange('monto')}
              min={1}
            />
            <Input
              label="Voucher *"
              placeholder="Número de voucher"
              value={form.voucher}
              onChange={handleChange('voucher')}
            />
            <Input
              label="Autorización *"
              placeholder="Código de autorización"
              value={form.autorizacion}
              onChange={handleChange('autorizacion')}
            />
            <Input
              label="Referencia externa"
              placeholder="Referencia adicional (opcional)"
              value={form.referencia_externa}
              onChange={handleChange('referencia_externa')}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={enviando}>
              Registrar pago POS
            </Button>
          </div>
        </form>
      </Card>

      {/* Tabla de recientes */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Pagos POS recientes</h2>
          <Button size="sm" variant="secondary" onClick={cargarRecientes} loading={cargandoRecientes}>
            Actualizar
          </Button>
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Venta</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Autorización</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pagosRecientes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No hay pagos POS registrados
                </td>
              </tr>
            ) : (
              pagosRecientes.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">#{p.id}</td>
                  <td className="px-4 py-3">{p.venta_id ? `#${p.venta_id}` : '-'}</td>
                  <td className="px-4 py-3">{p.cliente?.nombre || 'Anónimo'}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatGs(Number(p.monto))}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.voucher || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.autorizacion || '-'}</td>
                  <td className="px-4 py-3">{badgeEstado(p.estado)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatFechaHora(p.fecha_pago)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
