import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { comprasApi, proveedoresApi, productosApi } from '../../api/endpoints';
import { Alert } from '../../components/UI/Alert';
import { Button } from '../../components/UI/Button';
import { PageBack } from '../../components/UI/PageBack';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { formatGs, getErrorMessage } from '../../lib/utils';

interface LineaCompra {
  producto_id: string;
  cantidad: string;
  costo_unitario: string;
  iva_porcentaje: string;
}

export function NuevaCompra() {
  const navigate = useNavigate();
  const [proveedores, setProveedores] = useState<Array<{ id: number; nombre: string }>>([]);
  const [productos, setProductos] = useState<Array<{ id: number; nombre: string; codigo: string }>>([]);
  const [proveedor_id, setProveedorId] = useState('');
  const [numero_factura, setNumeroFactura] = useState('');
  const [lineas, setLineas] = useState<LineaCompra[]>([{ producto_id: '', cantidad: '1', costo_unitario: '0', iva_porcentaje: '10' }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([proveedoresApi.listar(), productosApi.listar()]).then(([prov, prod]) => {
      setProveedores(prov.data.data as Array<{ id: number; nombre: string }>);
      setProductos(prod.data.data as Array<{ id: number; nombre: string; codigo: string }>);
    });
  }, []);

  const addLinea = () => setLineas([...lineas, { producto_id: '', cantidad: '1', costo_unitario: '0', iva_porcentaje: '10' }]);
  const removeLinea = (i: number) => setLineas(lineas.filter((_, idx) => idx !== i));

  const updateLinea = (i: number, field: string, value: string) => {
    const updated = [...lineas];
    updated[i] = { ...updated[i], [field]: value };
    setLineas(updated);
  };

  const calcTotal = () => lineas.reduce((sum, l) => sum + (parseFloat(l.cantidad) || 0) * (parseFloat(l.costo_unitario) || 0), 0);

  const handleSubmit = async () => {
    if (!proveedor_id) { setError('Seleccione un proveedor'); return; }
    if (lineas.some(l => !l.producto_id || !l.cantidad)) { setError('Complete todos los items'); return; }
    setSaving(true);
    try {
      const items = lineas.map(l => ({
        producto_id: parseInt(l.producto_id),
        cantidad: parseFloat(l.cantidad),
        costo_unitario: parseInt(l.costo_unitario),
        iva_porcentaje: parseFloat(l.iva_porcentaje),
      }));
      const subtotal = items.reduce((s, i) => s + i.cantidad * i.costo_unitario, 0);
      const iva_total = items.reduce((s, i) => s + Math.round(i.cantidad * i.costo_unitario * i.iva_porcentaje / 110), 0);
      await comprasApi.crear({
        proveedor_id: parseInt(proveedor_id),
        numero_factura: numero_factura || null,
        items,
        subtotal,
        iva_total,
        total: subtotal,
      });
      navigate('/compras');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <PageBack to="/compras" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Compra</h1>
          <p className="mt-1 text-sm text-gray-500">Registrar compra a proveedor</p>
        </div>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Proveedor *" value={proveedor_id} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Seleccione...</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Select>
          <Input label="Nro. Factura Proveedor" value={numero_factura} onChange={(e) => setNumeroFactura(e.target.value)} />
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-900 mb-3">Items</h3>
          {lineas.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-end">
              <div className="col-span-4">
                <Select label={i === 0 ? 'Producto' : ''} value={l.producto_id} onChange={(e) => updateLinea(i, 'producto_id', e.target.value)}>
                  <option value="">Seleccione...</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </Select>
              </div>
              <div className="col-span-2">
                <Input label={i === 0 ? 'Cantidad' : ''} type="number" value={l.cantidad} onChange={(e) => updateLinea(i, 'cantidad', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Input label={i === 0 ? 'Costo Unit.' : ''} type="number" value={l.costo_unitario} onChange={(e) => updateLinea(i, 'costo_unitario', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Select label={i === 0 ? 'IVA %' : ''} value={l.iva_porcentaje} onChange={(e) => updateLinea(i, 'iva_porcentaje', e.target.value)}>
                  <option value="10">10%</option>
                  <option value="5">5%</option>
                  <option value="0">Exento</option>
                </Select>
              </div>
              <div className="col-span-1 text-right text-sm font-semibold text-gray-700 pb-2">
                {formatGs((parseFloat(l.cantidad) || 0) * (parseFloat(l.costo_unitario) || 0))}
              </div>
              <div className="col-span-1 pb-2">
                {lineas.length > 1 && (
                  <button onClick={() => removeLinea(i)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
                )}
              </div>
            </div>
          ))}
          <Button variant="secondary" onClick={addLinea}>+ Agregar item</Button>
        </div>

        <div className="border-t pt-4 flex justify-between items-center">
          <div className="text-lg font-bold text-gray-900">Total: {formatGs(calcTotal())}</div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => navigate('/compras')}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando...' : 'Registrar Compra'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
