import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockApi, categoriasApi, sucursalesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Table } from '../../components/UI/Table';
import { Card } from '../../components/UI/Card';
import { Alert } from '../../components/UI/Alert';
import { Badge } from '../../components/UI/Badge';
import { formatGs, formatFechaHora, getErrorMessage } from '../../lib/utils';

interface StockActualRow {
  id: number;
  producto_id: number;
  producto: {
    id: number;
    nombre: string;
    codigo?: string;
    categoria?: { id: number; nombre: string };
    stock_minimo?: number;
  };
  sucursal?: { id: number; nombre: string };
  cantidad: number;
  costo_promedio: number;
  updated_at: string;
}

interface Categoria {
  id: number;
  nombre: string;
}

interface Sucursal {
  id: number;
  nombre: string;
}

export function StockActualPage() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<StockActualRow[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [soloBajoStock, setSoloBajoStock] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = {};
      if (filtroCategoria) params.categoria_id = filtroCategoria;
      if (filtroSucursal) params.sucursal_id = filtroSucursal;
      if (soloBajoStock) params.bajo_stock = true;

      let data: StockActualRow[] = [];
      try {
        const res = await stockApi.actual(params);
        data = res.data.data as StockActualRow[];
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr?.response?.status === 404) {
          // Fallback: usar /stock con resumen
          const fallback = await stockApi.listar(params);
          data = fallback.data.data as StockActualRow[];
        } else {
          throw err;
        }
      }
      setRows(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filtroCategoria, filtroSucursal, soloBajoStock]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [catRes, sucRes] = await Promise.all([
          categoriasApi.listar(),
          sucursalesApi.listar(),
        ]);
        setCategorias(catRes.data.data as Categoria[]);
        setSucursales(sucRes.data.data as Sucursal[]);
      } catch {
        // no critical
      }
    };
    loadMeta();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtradas = rows.filter((r) => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      r.producto?.nombre?.toLowerCase().includes(term) ||
      r.producto?.codigo?.toLowerCase().includes(term)
    );
  });

  const exportCSV = () => {
    const headers = ['Producto', 'Código', 'Categoría', 'Sucursal', 'Cantidad', 'Costo Promedio', 'Actualizado'];
    const csvRows = [
      headers.join(','),
      ...filtradas.map((r) =>
        [
          `"${r.producto?.nombre || ''}"`,
          r.producto?.codigo || '',
          `"${r.producto?.categoria?.nombre || ''}"`,
          `"${r.sucursal?.nombre || ''}"`,
          r.cantidad,
          r.costo_promedio,
          formatFechaHora(r.updated_at),
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'stock-actual.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      key: 'producto',
      header: 'Producto',
      render: (row: StockActualRow) => (
        <div>
          <p className="font-medium text-gray-900">{row.producto?.nombre}</p>
          {row.producto?.codigo && (
            <p className="text-xs text-gray-500">{row.producto.codigo}</p>
          )}
        </div>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoría',
      render: (row: StockActualRow) => (
        <span className="text-gray-600">{row.producto?.categoria?.nombre || '-'}</span>
      ),
    },
    {
      key: 'sucursal',
      header: 'Sucursal',
      render: (row: StockActualRow) => (
        <span className="text-gray-600">{row.sucursal?.nombre || '-'}</span>
      ),
    },
    {
      key: 'cantidad',
      header: 'Cantidad',
      render: (row: StockActualRow) => {
        const bajo =
          row.producto?.stock_minimo !== undefined &&
          row.cantidad <= row.producto.stock_minimo;
        return (
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${bajo ? 'text-red-600' : 'text-gray-900'}`}>
              {row.cantidad}
            </span>
            {bajo && (
              <Badge variant="danger" size="sm">
                Bajo
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'costo_promedio',
      header: 'Costo Promedio',
      render: (row: StockActualRow) => (
        <span className="text-gray-700">{formatGs(row.costo_promedio)}</span>
      ),
    },
    {
      key: 'updated_at',
      header: 'Actualizado',
      render: (row: StockActualRow) => (
        <span className="text-gray-500 text-xs">{formatFechaHora(row.updated_at)}</span>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (row: StockActualRow) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate(`/stock/kardex/${row.producto_id}`)}
        >
          Ver kardex
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Actual</h1>
          <p className="text-sm text-gray-500 mt-1">Niveles de inventario por producto y sucursal</p>
        </div>
        <Button variant="secondary" onClick={exportCSV}>
          Exportar CSV
        </Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Filtros */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Input
            label="Buscar producto"
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre o código..."
          />
          <Select
            label="Categoría"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
          <Select
            label="Sucursal"
            value={filtroSucursal}
            onChange={(e) => setFiltroSucursal(e.target.value)}
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={soloBajoStock}
                onChange={(e) => setSoloBajoStock(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Solo bajo stock</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card padding={false}>
        <Table
          columns={columns}
          data={filtradas}
          loading={loading}
          emptyMessage="No hay registros de stock disponibles"
        />
      </Card>

      {!loading && (
        <p className="text-sm text-gray-500">
          {filtradas.length} producto{filtradas.length !== 1 ? 's' : ''} mostrado{filtradas.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
