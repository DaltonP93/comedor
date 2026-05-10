import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { comprasApi, productosApi, proveedoresApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Alert } from '../../components/UI/Alert';
import { Card } from '../../components/UI/Card';
import { formatGs, getErrorMessage } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

interface Producto { id: number; nombre: string; unidad_medida: string; costo_promedio: number | string; }
interface Proveedor { id: number; nombre: string; }

interface CompraItem {
  producto_id: number;
  nombre: string;
  cantidad: number;
  unidad: string;
  costo_unitario: number;
  iva_porcentaje: number;
}

export function EntradaMercaderia() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Produto[]>([]);
  const [proveedorId, setProveedorId] = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [items, setItems] = useState<CompraItem[]>([]);
  const [selectedProducto, setSelectedProducto] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  type Produto = Producto;

  useEffect(() => {
    Promise.all([
      proveedoresApi.listar({ activo: 'true' }),
      productosApi.listar({ activo: 'true', limit: '200' }),
    ]).then(([provRes, prodRes]) => {
      setProveedores(provRes.data.data as Proveedor[]);
      setProductos(prodRes.data.data as Produto[]);
    });
  }, []);

  const addItem = () => {
    const prod = productos.find((p) => p.id === parseInt(selectedProducto));
    if (!prod) return;
    setItems((prev) => [
      ...prev,
      {
        producto_id: prod.id,
        nombre: prod.nombre,
        cantidad: parseFloat(cantidad) || 1,
        unidad: prod.unidad_medida,
        costo_unitario: parseInt(costoUnitario) || Number(prod.costo_promedio),
        iva_porcentaje: 10,
      },
    ]);
    setSelectedProducto('');
    setCantidad('1');
    setCostoUnitario('');
  };

  const total = items.reduce((sum, item) => sum + item.cantidad * item.costo_unitario, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId) { setError('Seleccione un proveedor'); return; }
    if (items.length === 0) { setError('Agregue al menos un producto'); return; }
    setSaving(true);
    setError('');
    try {
      const sucursalId = usuario?.sucursal?.id || 1;
      await comprasApi.crear({
        proveedor_id: parseInt(proveedorId),
        numero_factura: numeroFactura || undefined,
        sucursal_id: sucursalId,
        items: items.map((item) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          unidad: item.unidad,
          costo_unitario: item.costo_unitario,
          iva_porcentaje: item.iva_porcentaje,
        })),
      });
      navigate('/stock');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/stock')}>← Volver</Button>
        <h1 className="text-2xl font-bold text-gray-900">Entrada de mercadería</h1>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <form onSubmit={handleSubmit}>
        <Card title="Datos del proveedor">
          <div className="space-y-4">
            <Select
              label="Proveedor"
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              options={[{ value: '', label: 'Seleccionar proveedor' }, ...proveedores.map((p) => ({ value: p.id, label: p.nombre }))]}
            />
            <Input label="Nro. factura del proveedor" value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="Ej: 001-001-0000001" />
          </div>
        </Card>

        <Card title="Agregar productos" className="mt-4">
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3 items-end">
              <div className="col-span-2">
                <Select
                  label="Producto"
                  value={selectedProducto}
                  onChange={(e) => {
                    setSelectedProducto(e.target.value);
                    const p = productos.find((pr) => pr.id === parseInt(e.target.value));
                    if (p) setCostoUnitario(String(p.costo_promedio ?? ''));
                  }}
                  options={[{ value: '', label: 'Seleccionar' }, ...productos.map((p) => ({ value: p.id, label: p.nombre }))]}
                />
              </div>
              <Input label="Cantidad" type="number" min="0.001" step="0.001" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
              <Input label="Costo unitario" type="number" min="0" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} placeholder="Gs." />
            </div>
            <Button type="button" variant="secondary" onClick={addItem} disabled={!selectedProducto}>
              + Agregar
            </Button>
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="mt-4">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="text-left py-2">Producto</th>
                    <th className="text-right py-2">Cant.</th>
                    <th className="text-right py-2">Costo</th>
                    <th className="text-right py-2">Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2">{item.nombre}</td>
                      <td className="py-2 text-right">{item.cantidad} {item.unidad}</td>
                      <td className="py-2 text-right">{formatGs(item.costo_unitario)}</td>
                      <td className="py-2 text-right font-medium">{formatGs(item.cantidad * item.costo_unitario)}</td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} className="text-red-500 text-xs">✕</button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-200 font-bold">
                    <td colSpan={3} className="py-2 text-right">TOTAL:</td>
                    <td className="py-2 text-right text-blue-600">{formatGs(total)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="secondary" type="button" onClick={() => navigate('/stock')}>Cancelar</Button>
          <Button type="submit" loading={saving} disabled={items.length === 0}>Registrar entrada</Button>
        </div>
      </form>
    </div>
  );
}
