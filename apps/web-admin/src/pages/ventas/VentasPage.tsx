import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ventasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Table } from '../../components/UI/Table';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { Pagination } from '../../components/UI/Pagination';
import { Alert } from '../../components/UI/Alert';
import { formatGs, formatFechaHora, getErrorMessage, hoyISO } from '../../lib/utils';

interface Venta {
  id: number;
  tipo_venta: string;
  estado: string;
  total: number | string;
  condicion_pago: string;
  creado_en: string;
  cliente: { nombre: string } | null;
  usuario: { nombre: string } | null;
}

export function VentasPage() {
  const navigate = useNavigate();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [estado, setEstado] = useState('');
  const [fechaDesde, setFechaDesde] = useState(hoyISO());
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });

  const loadVentas = useCallback(async () => {
    setLoading(true);
    try {
      const fechaFin = new Date(fechaDesde);
      fechaFin.setDate(fechaFin.getDate() + 1);
      const res = await ventasApi.listar({
        estado: estado || undefined,
        fecha_desde: fechaDesde ? new Date(fechaDesde).toISOString() : undefined,
        fecha_hasta: fechaDesde ? fechaFin.toISOString() : undefined,
        page,
        limit: 20,
      });
      setVentas(res.data.data as Venta[]);
      setMeta(res.data.meta || { total: 0, totalPages: 1 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [estado, fechaDesde, page]);

  useEffect(() => { loadVentas(); }, [loadVentas]);

  const columns = [
    { key: 'id', header: '#', render: (row: Venta) => <span className="text-gray-500 text-sm">#{row.id}</span> },
    {
      key: 'cliente',
      header: 'Cliente',
      render: (row: Venta) => <span className="font-medium">{row.cliente?.nombre ?? 'Anónimo'}</span>,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (row: Venta) => <span className="text-xs text-gray-500">{row.tipo_venta}</span>,
    },
    {
      key: 'pago',
      header: 'Pago',
      render: (row: Venta) => <span className="text-xs">{row.condicion_pago}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (row: Venta) => <span className="font-semibold">{formatGs(Number(row.total))}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (row: Venta) => {
        const badge = estadoBadge(row.estado);
        return <Badge variant={badge.variant} size="sm">{badge.label}</Badge>;
      },
    },
    {
      key: 'fecha',
      header: 'Fecha',
      render: (row: Venta) => <span className="text-xs text-gray-500">{formatFechaHora(row.creado_en)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-500 text-sm">Historial de ventas</p>
        </div>
        <Button onClick={() => navigate('/ventas/nueva')}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva venta
        </Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="w-48">
            <Input type="date" value={fechaDesde} onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }} label="Fecha" />
          </div>
          <div className="w-48 self-end">
            <select className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              <option value="COMPLETADA">Completada</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="ANULADA">Anulada</option>
            </select>
          </div>
          <div className="self-end">
            <Button variant="secondary" onClick={() => { setFechaDesde(''); setEstado(''); setPage(1); }}>Limpiar</Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table columns={columns} data={ventas} loading={loading} emptyMessage="No hay ventas" />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={20} onPageChange={setPage} />
      </div>
    </div>
  );
}
