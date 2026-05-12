import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { empresasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Table } from '../../components/UI/Table';
import { Badge } from '../../components/UI/Badge';
import { Modal } from '../../components/UI/Modal';
import { Pagination } from '../../components/UI/Pagination';
import { Alert } from '../../components/UI/Alert';
import { getErrorMessage } from '../../lib/utils';

interface Empresa {
  id: number;
  nombre: string;
  ruc: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  total_clientes: number;
  total_libretas_activas: number;
}

interface FormData {
  nombre: string;
  ruc: string;
  telefono: string;
  email: string;
  direccion: string;
}

const formInicial: FormData = {
  nombre: '',
  ruc: '',
  telefono: '',
  email: '',
  direccion: '',
};

export default function EmpresasPage() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [buscar, setBuscar] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [modalAbierto, setModalAbierto] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState<Empresa | null>(null);
  const [form, setForm] = useState<FormData>(formInicial);
  const [guardando, setGuardando] = useState(false);

  const loadEmpresas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await empresasApi.listar({ buscar: buscar || undefined, page, limit: 20 });
      setEmpresas(res.data.data as Empresa[]);
      setMeta(res.data.meta || { total: 0, totalPages: 1 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [buscar, page]);

  useEffect(() => {
    const timer = setTimeout(loadEmpresas, 300);
    return () => clearTimeout(timer);
  }, [loadEmpresas]);

  const abrirNueva = () => {
    setEmpresaEditando(null);
    setForm(formInicial);
    setModalAbierto(true);
  };

  const abrirEditar = (empresa: Empresa) => {
    setEmpresaEditando(empresa);
    setForm({
      nombre: empresa.nombre,
      ruc: empresa.ruc || '',
      telefono: empresa.telefono || '',
      email: empresa.email || '',
      direccion: empresa.direccion || '',
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEmpresaEditando(null);
    setForm(formInicial);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }
    setGuardando(true);
    try {
      const data: Record<string, unknown> = {
        nombre: form.nombre,
        ruc: form.ruc || null,
        telefono: form.telefono || null,
        email: form.email || null,
        direccion: form.direccion || null,
      };

      if (empresaEditando) {
        await empresasApi.actualizar(empresaEditando.id, data);
        setSuccess('Empresa actualizada correctamente');
      } else {
        await empresasApi.crear(data);
        setSuccess('Empresa creada correctamente');
      }
      cerrarModal();
      loadEmpresas();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (empresa: Empresa) => {
    if (!confirm(`¿Eliminar la empresa "${empresa.nombre}"?`)) return;
    try {
      await empresasApi.eliminar(empresa.id);
      setSuccess('Empresa eliminada');
      loadEmpresas();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (row: Empresa) => (
        <div>
          <p className="font-medium text-gray-900">{row.nombre}</p>
          {row.email && <p className="text-xs text-gray-500">{row.email}</p>}
        </div>
      ),
    },
    {
      key: 'ruc',
      header: 'RUC',
      render: (row: Empresa) => <span className="text-gray-600">{row.ruc || '-'}</span>,
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      render: (row: Empresa) => <span>{row.telefono || '-'}</span>,
    },
    {
      key: 'clientes',
      header: 'Clientes',
      render: (row: Empresa) => (
        <span className="text-gray-700 font-medium">{row.total_clientes}</span>
      ),
    },
    {
      key: 'libretas_activas',
      header: 'Libretas activas',
      render: (row: Empresa) => (
        <span className={`font-medium ${row.total_libretas_activas > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
          {row.total_libretas_activas}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (row: Empresa) => (
        <Badge variant={row.activo ? 'success' : 'default'} size="sm">
          {row.activo ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: '',
      render: (row: Empresa) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => abrirEditar(row)}
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            Editar
          </button>
          <button
            onClick={() => eliminar(row)}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            Eliminar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-gray-500 text-sm">Gestión de empresas y convenios</p>
        </div>
        <Button onClick={abrirNueva}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva empresa
        </Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <Input
          placeholder="Buscar por nombre o RUC..."
          value={buscar}
          onChange={(e) => { setBuscar(e.target.value); setPage(1); }}
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns}
          data={empresas}
          loading={loading}
          emptyMessage="No se encontraron empresas"
          onRowClick={(row) => navigate(`/empresas/${row.id}`)}
        />
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={20}
          onPageChange={setPage}
        />
      </div>

      <Modal
        isOpen={modalAbierto}
        onClose={cerrarModal}
        title={empresaEditando ? 'Editar empresa' : 'Nueva empresa'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre de la empresa"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RUC</label>
            <Input
              value={form.ruc}
              onChange={(e) => setForm({ ...form, ruc: e.target.value })}
              placeholder="RUC de la empresa"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <Input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="Teléfono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@empresa.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <Input
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              placeholder="Dirección de la empresa"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={cerrarModal}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando...' : empresaEditando ? 'Actualizar' : 'Crear empresa'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
