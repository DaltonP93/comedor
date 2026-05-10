import React, { useState, useEffect } from 'react';
import { usuariosApi, rolesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Alert } from '../../components/UI/Alert';
import { Modal } from '../../components/UI/Modal';
import { Table } from '../../components/UI/Table';
import { Badge } from '../../components/UI/Badge';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { getErrorMessage } from '../../lib/utils';

interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  activo: boolean;
  rol: { id: number; nombre: string };
  sucursal: { nombre: string } | null;
}

interface Rol { id: number; nombre: string; }

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rol_id: '',
    activo: true,
  });

  useEffect(() => {
    Promise.all([usuariosApi.listar(), rolesApi.listar()]).then(([userRes, rolRes]) => {
      setUsuarios(userRes.data.data as Usuario[]);
      setRoles(rolRes.data.data as Rol[]);
      setLoading(false);
    }).catch((err) => {
      setError(getErrorMessage(err));
      setLoading(false);
    });
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm({ nombre: '', apellido: '', email: '', password: '', rol_id: '', activo: true });
    setShowModal(true);
  };

  const openEdit = (u: Usuario) => {
    setEditId(u.id);
    setForm({ nombre: u.nombre, apellido: u.apellido, email: u.email, password: '', rol_id: String(u.rol.id), activo: u.activo });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, rol_id: parseInt(form.rol_id) };
      if (editId) {
        const { password, ...rest } = payload;
        await usuariosApi.actualizar(editId, password ? payload as unknown as Record<string, unknown> : rest as unknown as Record<string, unknown>);
      } else {
        await usuariosApi.crear(payload as unknown as Record<string, unknown>);
      }
      const res = await usuariosApi.listar();
      setUsuarios(res.data.data as Usuario[]);
      setShowModal(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (u: Usuario) => {
    try {
      if (u.activo) {
        await usuariosApi.eliminar(u.id);
      } else {
        await usuariosApi.actualizar(u.id, { activo: true });
      }
      const res = await usuariosApi.listar();
      setUsuarios(res.data.data as Usuario[]);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const columns = [
    {
      key: 'nombre',
      header: 'Usuario',
      render: (u: Usuario) => (
        <div>
          <p className="font-medium">{u.nombre} {u.apellido}</p>
          <p className="text-xs text-gray-500">{u.email}</p>
        </div>
      ),
    },
    { key: 'rol', header: 'Rol', render: (u: Usuario) => <span className="text-sm">{u.rol.nombre}</span> },
    { key: 'sucursal', header: 'Sucursal', render: (u: Usuario) => <span className="text-sm text-gray-500">{u.sucursal?.nombre || '-'}</span> },
    {
      key: 'activo',
      header: 'Estado',
      render: (u: Usuario) => (
        <Badge variant={u.activo ? 'success' : 'danger'} size="sm">{u.activo ? 'Activo' : 'Inactivo'}</Badge>
      ),
    },
    {
      key: 'acciones',
      header: '',
      render: (u: Usuario) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-700 text-sm">Editar</button>
          <button onClick={() => handleToggle(u)} className={`text-sm ${u.activo ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}>
            {u.activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <Button onClick={openCreate}>+ Nuevo usuario</Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table columns={columns} data={usuarios} emptyMessage="Sin usuarios" />
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Editar usuario' : 'Nuevo usuario'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} required />
            <Input label="Apellido" value={form.apellido} onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))} required />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
          <Input label={editId ? 'Nueva contraseña (dejar en blanco para mantener)' : 'Contraseña'} type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required={!editId} />
          <Select
            label="Rol"
            value={form.rol_id}
            onChange={(e) => setForm((p) => ({ ...p, rol_id: e.target.value }))}
            options={[{ value: '', label: 'Seleccionar rol' }, ...roles.map((r) => ({ value: r.id, label: r.nombre }))]}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
