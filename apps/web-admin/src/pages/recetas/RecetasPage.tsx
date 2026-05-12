import React, { useState, useEffect } from 'react';
import { recetasApi, productosApi } from '../../api/endpoints';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Modal } from '../../components/UI/Modal';
import { getErrorMessage } from '../../lib/utils';

interface RecetaItem {
  insumo_id: string;
  cantidad: string;
  unidad: string;
  insumo?: { nombre: string };
}

interface Receta {
  id: number;
  nombre: string;
  activo: boolean;
  producto: { id: number; nombre: string; codigo: string };
  items: Array<{
    id: number;
    cantidad: string;
    unidad: string;
    insumo: { id: number; nombre: string; codigo: string; unidad_medida: string };
  }>;
}

export function RecetasPage() {
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [productos, setProductos] = useState<Array<{ id: number; nombre: string; codigo: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Receta | null>(null);
  const [nombre, setNombre] = useState('');
  const [productoId, setProductoId] = useState('');
  const [items, setItems] = useState<RecetaItem[]>([{ insumo_id: '', cantidad: '1', unidad: 'KG' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [recRes, prodRes] = await Promise.all([recetasApi.listar(), productosApi.listar()]);
      setRecetas(recRes.data.data as Receta[]);
      setProductos(prodRes.data.data as Array<{ id: number; nombre: string; codigo: string }>);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setNombre('');
    setProductoId('');
    setItems([{ insumo_id: '', cantidad: '1', unidad: 'KG' }]);
    setShowModal(true);
  };

  const openEdit = (r: Receta) => {
    setEditing(r);
    setNombre(r.nombre);
    setProductoId(String(r.producto.id));
    setItems(r.items.map(i => ({ insumo_id: String(i.insumo.id), cantidad: String(i.cantidad), unidad: i.unidad })));
    setShowModal(true);
  };

  const addItem = () => setItems([...items, { insumo_id: '', cantidad: '1', unidad: 'KG' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: string) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: value };
    setItems(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        nombre,
        producto_id: productoId,
        items: items.filter(i => i.insumo_id).map(i => ({
          insumo_id: parseInt(i.insumo_id),
          cantidad: parseFloat(i.cantidad),
          unidad: i.unidad,
        })),
      };
      if (editing) {
        await recetasApi.actualizar(editing.id, data);
      } else {
        await recetasApi.crear(data);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta receta?')) return;
    try {
      await recetasApi.eliminar(id);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
          <p className="text-gray-500 text-sm mt-1">Composición de insumos por producto/menú</p>
        </div>
        <Button onClick={openNew}>+ Nueva Receta</Button>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recetas.map((r) => (
          <div key={r.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{r.nombre}</h3>
                <p className="text-sm text-gray-500">Producto: {r.producto.nombre}</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${r.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {r.activo ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <div className="space-y-1 mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase">Insumos:</p>
              {r.items.map((item, i) => (
                <div key={i} className="text-sm text-gray-700 flex justify-between">
                  <span>{item.insumo.nombre}</span>
                  <span className="text-gray-500">{item.cantidad} {item.unidad}</span>
                </div>
              ))}
              {r.items.length === 0 && <p className="text-sm text-gray-400">Sin insumos definidos</p>}
            </div>
            <div className="flex gap-2 pt-3 border-t">
              <button onClick={() => openEdit(r)} className="text-sm text-blue-600 hover:text-blue-800">Editar</button>
              <button onClick={() => handleDelete(r.id)} className="text-sm text-red-600 hover:text-red-800">Eliminar</button>
            </div>
          </div>
        ))}
        {recetas.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">No hay recetas registradas</div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Receta' : 'Nueva Receta'}>
        <div className="space-y-4">
          <Input label="Nombre de la receta *" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Select label="Producto resultado *" value={productoId} onChange={(e) => setProductoId(e.target.value)} disabled={!!editing}>
            <option value="">Seleccione...</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.codigo})</option>)}
          </Select>

          <div className="border-t pt-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Insumos de la receta</p>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-end">
                <div className="col-span-5">
                  <Select label={i === 0 ? 'Insumo' : ''} value={item.insumo_id} onChange={(e) => updateItem(i, 'insumo_id', e.target.value)}>
                    <option value="">Seleccione...</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input label={i === 0 ? 'Cantidad' : ''} type="number" step="0.001" value={item.cantidad} onChange={(e) => updateItem(i, 'cantidad', e.target.value)} />
                </div>
                <div className="col-span-3">
                  <Select label={i === 0 ? 'Unidad' : ''} value={item.unidad} onChange={(e) => updateItem(i, 'unidad', e.target.value)}>
                    <option value="KG">Kg</option>
                    <option value="GRAMO">Gramo</option>
                    <option value="LITRO">Litro</option>
                    <option value="ML">ML</option>
                    <option value="UNIDAD">Unidad</option>
                    <option value="PORCION">Porción</option>
                  </Select>
                </div>
                <div className="col-span-1 pb-2">
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700">✕</button>
                  )}
                </div>
              </div>
            ))}
            <Button variant="secondary" onClick={addItem}>+ Agregar insumo</Button>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !nombre || !productoId}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
