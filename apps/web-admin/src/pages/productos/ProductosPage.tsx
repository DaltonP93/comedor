import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { productosApi, categoriasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Table } from '../../components/UI/Table';
import { Badge } from '../../components/UI/Badge';
import { Pagination } from '../../components/UI/Pagination';
import { Alert } from '../../components/UI/Alert';
import { formatGs, getErrorMessage } from '../../lib/utils';

interface Producto {
  id: number;
  codigo: string | null;
  nombre: string;
  categoria: { nombre: string } | null;
  unidad_medida: string;
  precio_venta: number | string;
  controla_stock: boolean;
  stock_actual: number;
  activo: boolean;
}

interface Categoria { id: number; nombre: string; }

export function ProductosPage() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });

  useEffect(() => {
    categoriasApi.listar({ activo: 'true' }).then((res) => {
      setCategorias(res.data.data as Categoria[]);
    });
  }, []);

  const loadProductos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productosApi.listar({
        buscar: buscar || undefined,
        categoria_id: categoriaId || undefined,
        page,
        limit: 20,
      });
      setProductos(res.data.data as Producto[]);
      setMeta(res.data.meta || { total: 0, totalPages: 1 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [buscar, categoriaId, page]);

  useEffect(() => {
    const timer = setTimeout(loadProductos, 300);
    return () => clearTimeout(timer);
  }, [loadProductos]);

  const columns = [
    {
      key: 'codigo',
      header: 'Código',
      render: (row: Producto) => <span className="text-gray-500 text-xs font-mono">{row.codigo || '-'}</span>,
    },
    {
      key: 'nombre',
      header: 'Producto',
      render: (row: Producto) => (
        <div>
          <p className="font-medium text-gray-900">{row.nombre}</p>
          <p className="text-xs text-gray-500">{row.categoria?.nombre || '-'}</p>
        </div>
      ),
    },
    { key: 'unidad_medida', header: 'Unidad', render: (row: Producto) => <span>{row.unidad_medida}</span> },
    {
      key: 'precio_venta',
      header: 'Precio venta',
      render: (row: Producto) => <span className="font-medium">{formatGs(Number(row.precio_venta))}</span>,
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (row: Producto) => {
        if (!row.controla_stock) return <span className="text-gray-400 text-xs">Sin control</span>;
        return (
          <span className={`font-medium text-sm ${row.stock_actual <= 0 ? 'text-red-600' : row.stock_actual <= 10 ? 'text-yellow-600' : 'text-green-600'}`}>
            {row.stock_actual}
          </span>
        );
      },
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (row: Producto) => (
        <Badge variant={row.activo ? 'success' : 'danger'} size="sm">
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: '',
      render: (row: Producto) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Link to={`/productos/${row.id}/editar`} className="text-blue-600 hover:text-blue-700 text-sm">Editar</Link>
          <Link to={`/stock/kardex/${row.id}`} className="text-gray-600 hover:text-gray-700 text-sm">Kardex</Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-500 text-sm">Catálogo de productos</p>
        </div>
        <Button onClick={() => navigate('/productos/nuevo')}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo producto
        </Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input placeholder="Buscar por nombre, código..." value={buscar} onChange={(e) => { setBuscar(e.target.value); setPage(1); }} />
          </div>
          <div className="w-48">
            <Select
              value={categoriaId}
              onChange={(e) => { setCategoriaId(e.target.value); setPage(1); }}
              options={[
                { value: '', label: 'Todas las categorías' },
                ...categorias.map((c) => ({ value: c.id, label: c.nombre })),
              ]}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table columns={columns} data={productos} loading={loading} emptyMessage="No hay productos" />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={20} onPageChange={setPage} />
      </div>
    </div>
  );
}
