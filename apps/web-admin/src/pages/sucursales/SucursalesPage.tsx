import React, { useState, useEffect } from 'react';
import { sucursalesApi } from '../../api/endpoints';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Modal } from '../../components/UI/Modal';
import { getErrorMessage } from '../../lib/utils';

interface Sucursal {
  id: number; nombre: string; direccion: string | null; telefono: string | null; activo: boolean;
}

export function SucursalesPage() {
  const [items, setItems] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Sucursal | null>(null);
  const [form, setForm] = useState({ nombre: '', direccion: '', telefono: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { const res = await sucursalesApi.listar(); setItems(res.data.data as Sucursal[]); }
    catch (err) { setError(getErrorMessage(err)); } finally { setLoading(false); }
  };
  const openNew = () => { setEditing(null); setForm({ nombre: '', direccion: '', telefono: '' }); setShowModal(true); };
  const openEdit = (s: Sucursal) => { setEditing(s); setForm({ nombre: s.nombre, direccion: s.direccion || '', telefono: s.telefono || '' }); setShowModal(true); };
  const handleSave = async () => {
    setSaving(true);
    try { editing ? await sucursalesApi.actualizar(editing.id, form) : await sucursalesApi.crear(form); setShowModal(false); load(); }
    catch (err) { setError(getErrorMessage(err)); } finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Sucursales</h1><p className="text-gray-500 text-sm mt-1">Gestión de sucursales</p></div>
        <Button onClick={openNew}>+ Nueva Sucursal</Button>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((s) => (
          <div key={s.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-2"><h3 className="font-semibold text-gray-900">{s.nombre}</h3>
              <span className={`px-2 py-1 text-xs rounded-full ${s.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{s.activo ? 'Activa' : 'Inactiva'}</span></div>
            {s.direccion && <p className="text-sm text-gray-600">📍 {s.direccion}</p>}
            {s.telefono && <p className="text-sm text-gray-600">📞 {s.telefono}</p>}
            <div className="flex gap-2 mt-4 pt-3 border-t"><button onClick={() => openEdit(s)} className="text-sm text-blue-600 hover:text-blue-800">Editar</button></div>
          </div>
        ))}
      </div>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Sucursal' : 'Nueva Sucursal'}>
        <div className="space-y-4">
          <Input label="Nombre *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <Input label="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          <Input label="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4"><Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nombre}>{saving ? 'Guardando...' : 'Guardar'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
