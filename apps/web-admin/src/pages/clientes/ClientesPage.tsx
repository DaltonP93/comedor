import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Table } from '../../components/UI/Table';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { Pagination } from '../../components/UI/Pagination';
import { Alert } from '../../components/UI/Alert';
import { getErrorMessage } from '../../lib/utils';

interface Cliente {
  id: number;
  nombre: string;
  tipo_cliente: string;
  documento_numero: string | null;
  ruc: string | null;
  telefono: string | null;
  email: string | null;
  estado: string;
  libretas: Array<{ id: number; saldo_actual: number | string; estado: string }>;
}

export function ClientesPage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });

  const loadClientes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientesApi.listar({ buscar: buscar || undefined, estado: estado || undefined, page, limit: 20 });
      setClientes(res.data.data as Cliente[]);
      setMeta(res.data.meta || { total: 0, totalPages: 1 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [buscar, estado, page]);

  useEffect(() => {
    const timer = setTimeout(loadClientes, 300);
    return () => clearTimeout(timer);
  }, [loadClientes]);

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (row: Cliente) => (
        <div>
          <p className="font-medium text-gray-900">{row.nombre}</p>
          <p className="text-xs text-gray-500">{row.tipo_cliente}</p>
        </div>
      ),
    },
    {
      key: 'documento',
      header: 'Documento',
      render: (row: Cliente) => <span className="text-gray-600">{row.documento_numero || row.ruc || '-'}</span>,
    },
    { key: 'telefono', header: 'Teléfono', render: (row: Cliente) => <span>{row.telefono || '-'}</span> },
    { key: 'email', header: 'Email', render: (row: Cliente) => <span className="text-sm">{row.email || '-'}</span> },
    {
      key: 'libreta',
      header: 'Libreta',
      render: (row: Cliente) => {
        const libreta = row.libretas?.[0];
        if (!libreta) return <span className="text-gray-400 text-sm">-</span>;
        return (
          <span className={`text-sm font-medium ${Number(libreta.saldo_actual) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
            Gs. {Number(libreta.saldo_actual).toLocaleString('es-PY')}
          </span>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (row: Cliente) => {
        const badge = estadoBadge(row.estado);
        return <Badge variant={badge.variant} size="sm">{badge.label}</Badge>;
      },
    },
    {
      key: 'acciones',
      header: '',
      render: (row: Cliente) => (
        <div className="flex gap-2">
          <Link to={`/clientes/${row.id}`} className="text-blue-600 hover:text-blue-700 text-sm">
            Ver
          </Link>
          <Link to={`/clientes/${row.id}/editar`} className="text-gray-600 hover:text-gray-700 text-sm">
            Editar
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm">Gestión de clientes del sistema</p>
        </div>
        <Button onClick={() => navigate('/clientes/nuevo')}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo cliente
        </Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              placeholder="Buscar por nombre, documento, email..."
              value={buscar}
              onChange={(e) => { setBuscar(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-48">
            <Select
              value={estado}
              onChange={(e) => { setEstado(e.target.value); setPage(1); }}
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'ACTIVO', label: 'Activo' },
                { value: 'INACTIVO', label: 'Inactivo' },
                { value: 'BLOQUEADO', label: 'Bloqueado' },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns}
          data={clientes}
          loading={loading}
          emptyMessage="No se encontraron clientes"
          onRowClick={(row) => navigate(`/clientes/${row.id}`)}
        />
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={20}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
