import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { menusApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Table } from '../../components/UI/Table';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { Alert } from '../../components/UI/Alert';
import { formatGs, formatFecha, getErrorMessage, hoyISO } from '../../lib/utils';

interface Menu {
  id: number;
  titulo: string;
  fecha: string;
  precio: number | string;
  precio_convenio: number | string | null;
  cupo_total: number | null;
  cupo_reservado: number;
  estado: string;
  sucursal: { nombre: string };
  _count: { reservas: number };
}

export function MenusPage() {
  const navigate = useNavigate();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [estado, setEstado] = useState('');

  const loadMenus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await menusApi.listar({ fecha: fecha || undefined, estado: estado || undefined });
      setMenus(res.data.data as Menu[]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fecha, estado]);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  const handlePublicar = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await menusApi.publicar(id);
      loadMenus();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const columns = [
    {
      key: 'fecha',
      header: 'Fecha',
      render: (row: Menu) => <span className="text-sm">{formatFecha(row.fecha)}</span>,
    },
    {
      key: 'titulo',
      header: 'Menú',
      render: (row: Menu) => (
        <div>
          <p className="font-medium text-gray-900">{row.titulo}</p>
          <p className="text-xs text-gray-500">{row.sucursal?.nombre}</p>
        </div>
      ),
    },
    {
      key: 'precio',
      header: 'Precio',
      render: (row: Menu) => (
        <div>
          <p className="font-medium">{formatGs(Number(row.precio))}</p>
          {row.precio_convenio && <p className="text-xs text-gray-500">Conv: {formatGs(Number(row.precio_convenio))}</p>}
        </div>
      ),
    },
    {
      key: 'cupo',
      header: 'Cupo',
      render: (row: Menu) => (
        <span>
          {row.cupo_reservado} / {row.cupo_total ?? '∞'}
        </span>
      ),
    },
    {
      key: 'reservas',
      header: 'Reservas',
      render: (row: Menu) => <span className="font-medium">{row._count.reservas}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (row: Menu) => {
        const badge = estadoBadge(row.estado);
        return <Badge variant={badge.variant} size="sm">{badge.label}</Badge>;
      },
    },
    {
      key: 'acciones',
      header: '',
      render: (row: Menu) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {row.estado === 'BORRADOR' && (
            <button onClick={(e) => handlePublicar(row.id, e)} className="text-green-600 hover:text-green-700 text-sm font-medium">
              Publicar
            </button>
          )}
          <Link to={`/menus/${row.id}`} className="text-blue-600 hover:text-blue-700 text-sm">Ver</Link>
          {row.estado === 'BORRADOR' && (
            <Link to={`/menus/${row.id}/editar`} className="text-gray-600 hover:text-gray-700 text-sm">Editar</Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menús</h1>
          <p className="text-gray-500 text-sm">Gestión de menús del comedor</p>
        </div>
        <Button onClick={() => navigate('/menus/nuevo')}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo menú
        </Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="w-48">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} label="Fecha" />
          </div>
          <div className="w-48 self-end">
            <select
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="BORRADOR">Borrador</option>
              <option value="PUBLICADO">Publicado</option>
              <option value="CERRADO">Cerrado</option>
            </select>
          </div>
          <div className="self-end">
            <Button variant="secondary" onClick={() => { setFecha(''); setEstado(''); }}>
              Limpiar filtros
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns}
          data={menus}
          loading={loading}
          emptyMessage="No hay menús para los filtros seleccionados"
          onRowClick={(row) => navigate(`/menus/${row.id}`)}
        />
      </div>
    </div>
  );
}
