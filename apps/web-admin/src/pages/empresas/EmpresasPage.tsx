import React, { useState, useEffect } from 'react';
import { empresasApi } from '../../api/endpoints';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Modal } from '../../components/UI/Modal';
import { getErrorMessage } from '../../lib/utils';

interface Empresa {
  id: number;
  nombre: string;
  ruc: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  _count?: { clientes: number; libretas: number };
}

export function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState({ nombre: '', ruc: '', telefono: '', email: '', direccion: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await empresasApi.listar();
      setEmpresas(res.data.data as Empresa[]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ nombre: '', ruc: '', telefono: '', email: '', direccion: '' });
    setShowModal(true);
  };

  const openEdit = (e: Empresa) => {
    setEditing(e);
    setForm({ nombre: e.nombre, ruc: e.ruc || '', telefono: e.telefono || '', email: e.email || '', direccion: e.direccion || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await empresasApi.actualizar(editing.id, form);
      } else {
        await empresasApi.crear(form);
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
    if (!confirm('¿Desactivar esta empresa?')) return;
    try {
      await empresasApi.eliminar(id);
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
          <h1 className="text-2xl font-bold text-gray-900">Empresas / Convenios</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de empresas asociadas y convenios</p>
        </div>
        <Button onClick={openNew}>+ Nueva Empresa</Button>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {empresas.map((e) => (
          <div key={e.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{e.nombre}</h3>
                {e.ruc && <p className="text-sm text-gray-500">RUC: {e.ruc}</p>}
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${e.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {e.activo ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            {e.telefono && <p className="text-sm text-gray-600">📞 {e.telefono}</p>}
            {e.email && <p className="text-sm text-gray-600">✉️ {e.email}</p>}
            <div className="flex gap-4 mt-3 text-sm text-gray-500">
              <span>{e._count?.clientes || 0} funcionarios</span>
              <span>{e._count?.libretas || 0} libretas</span>
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t">
              <button onClick={() => openEdit(e)} className="text-sm text-blue-600 hover:text-blue-800">Editar</button>
              <button onClick={() => handleDelete(e.id)} className="text-sm text-red-600 hover:text-red-800">Desactivar</button>
            </div>
          </div>
        ))}
        {empresas.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">No hay empresas registradas</div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Empresa' : 'Nueva Empresa'}>
        <div className="space-y-4">
          <Input label="Nombre *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <Input label="RUC" value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
          <Input label="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nombre}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
