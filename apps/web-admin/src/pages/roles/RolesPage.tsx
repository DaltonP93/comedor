import React, { useState, useEffect } from 'react';
import { rolesApi } from '../../api/endpoints';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Modal } from '../../components/UI/Modal';
import { getErrorMessage } from '../../lib/utils';

interface Permiso {
  id: number;
  codigo: string;
  descripcion: string;
  modulo: string;
}

interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  permisos?: Array<{ permiso: Permiso }>;
  _count?: { usuarios: number };
}

export function RolesPage() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Rol | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [rolesRes, permisosRes] = await Promise.all([rolesApi.listar(), rolesApi.permisos()]);
      setRoles(rolesRes.data.data as Rol[]);
      setPermisos(permisosRes.data.data as Permiso[]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setNombre('');
    setDescripcion('');
    setPermisosSeleccionados([]);
    setShowModal(true);
  };

  const openEdit = async (r: Rol) => {
    try {
      const res = await rolesApi.obtener(r.id);
      const rolDetalle = res.data.data as Rol;
      setEditing(rolDetalle);
      setNombre(rolDetalle.nombre);
      setDescripcion(rolDetalle.descripcion || '');
      setPermisosSeleccionados(rolDetalle.permisos?.map(p => p.permiso.id) || []);
      setShowModal(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const togglePermiso = (id: number) => {
    setPermisosSeleccionados(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleModulo = (modulo: string) => {
    const moduloPermisos = permisos.filter(p => p.modulo === modulo).map(p => p.id);
    const allSelected = moduloPermisos.every(id => permisosSeleccionados.includes(id));
    if (allSelected) {
      setPermisosSeleccionados(prev => prev.filter(id => !moduloPermisos.includes(id)));
    } else {
      setPermisosSeleccionados(prev => [...new Set([...prev, ...moduloPermisos])]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = { nombre, descripcion, permisos: permisosSeleccionados };
      if (editing) {
        await rolesApi.actualizar(editing.id, data);
      } else {
        await rolesApi.crear(data);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const modulos = [...new Set(permisos.map(p => p.modulo))].sort();

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles y Permisos</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de roles y permisos del sistema</p>
        </div>
        <Button onClick={openNew}>+ Nuevo Rol</Button>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((r) => (
          <div key={r.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900">{r.nombre}</h3>
                <p className="text-sm text-gray-500">{r.descripcion || 'Sin descripción'}</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${r.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {r.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t">
              <button onClick={() => openEdit(r)} className="text-sm text-blue-600 hover:text-blue-800">Editar permisos</button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? `Editar Rol: ${editing.nombre}` : 'Nuevo Rol'}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <Input label="Nombre *" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />

          <div className="border-t pt-3">
            <p className="text-sm font-medium text-gray-700 mb-3">Permisos ({permisosSeleccionados.length} seleccionados)</p>
            <div className="space-y-3">
              {modulos.map(modulo => {
                const moduloPermisos = permisos.filter(p => p.modulo === modulo);
                const allSelected = moduloPermisos.every(p => permisosSeleccionados.includes(p.id));
                return (
                  <div key={modulo} className="border rounded-md p-3">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input type="checkbox" checked={allSelected} onChange={() => toggleModulo(modulo)} className="rounded border-gray-300 text-blue-600" />
                      <span className="text-sm font-semibold text-gray-700">{modulo}</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1 ml-6">
                      {moduloPermisos.map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permisosSeleccionados.includes(p.id)}
                            onChange={() => togglePermiso(p.id)}
                            className="rounded border-gray-300 text-blue-600"
                          />
                          <span className="text-xs text-gray-600">{p.codigo.split(':')[1]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white pb-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !nombre}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
