import React, { useState, useEffect, useCallback } from 'react';
import { productosApi } from '../../api/endpoints';
import apiClient from '../../api/client';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Alert } from '../../components/UI/Alert';
import { Table } from '../../components/UI/Table';
import { formatFechaHora, getErrorMessage, hoyISO } from '../../lib/utils';

interface Producto { id: number; nombre: string; unidad_medida?: string; }
interface Merma {
  id: number;
  producto: { nombre: string };
  cantidad: number;
  descripcion?: string;
  creado_en: string;
  usuario?: { nombre: string };
}

const MOTIVOS = ['VENCIMIENTO', 'DAÑO', 'ROBO', 'OTRO'];

export function MermasPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [mermas, setMermas] = useState<Merma[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('VENCIMIENTO');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    productosApi.listar({ limit: 200 })
      .then(r => setProductos(r.data.data as Producto[]))
      .catch(() => {});
    loadMermas();
  }, []);

  const loadMermas = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.get('/stock/movimientos', { params: { tipo: 'SALIDA_MERMA', limit: 30 } });
      setMermas((r.data.data || []) as Merma[]);
    } catch {
      setMermas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoId || !cantidad || parseFloat(cantidad) <= 0) {
      setError('Seleccione producto y cantidad válida.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiClient.post('/stock/ajuste', {
        producto_id: parseInt(productoId),
        cantidad: -Math.abs(parseFloat(cantidad)),
        tipo: 'SALIDA_MERMA',
        descripcion: `${motivo}: ${descripcion || 'Sin descripción'}`.trim(),
        fecha,
      });
      setSuccess('Merma registrada correctamente.');
      setProductoId('');
      setCantidad('');
      setDescripcion('');
      loadMermas();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Registro de Mermas</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Nueva Merma</h2>
        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}
        <form onSubmit={registrar} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Producto *</label>
            <select
              value={productoId}
              onChange={e => setProductoId(e.target.value)}
              required
              className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar producto...</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <Input label="Cantidad *" type="number" step="0.001" min="0.001" value={cantidad} onChange={e => setCantidad(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
            <select
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Input label="Descripción" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Detalle adicional..." />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" loading={saving}>Registrar Merma</Button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Mermas Recientes</h2>
        {loading ? (
          <p className="text-gray-500 text-center py-8">Cargando...</p>
        ) : mermas.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Sin mermas registradas.</p>
        ) : (
          <Table<Merma>
            columns={[
              { key: 'producto', header: 'Producto', render: (m: Merma) => m.producto?.nombre || '-' },
              { key: 'cantidad', header: 'Cantidad', render: (m: Merma) => Math.abs(m.cantidad).toString() },
              { key: 'descripcion', header: 'Descripción', render: (m: Merma) => m.descripcion || '-' },
              { key: 'creado_en', header: 'Fecha', render: (m: Merma) => formatFechaHora(m.creado_en) },
              { key: 'usuario', header: 'Usuario', render: (m: Merma) => m.usuario?.nombre || '-' },
            ]}
            data={mermas}
          />
        )}
      </div>
    </div>
  );
}
