import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { reservasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Table } from '../../components/UI/Table';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { Alert } from '../../components/UI/Alert';
import { Pagination } from '../../components/UI/Pagination';
import { formatGs, formatFecha, formatFechaHora, getErrorMessage, hoyISO } from '../../lib/utils';

interface Reserva {
  id: number;
  cliente: { nombre: string };
  menu: { titulo: string; fecha: string };
  cantidad: number;
  estado: string;
  total: number | string;
  creado_en: string;
}

export function ReservasPage() {
  const navigate = useNavigate();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [estado, setEstado] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });

  const loadReservas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reservasApi.listar({
        estado: estado || undefined,
        fecha: fecha || undefined,
        page,
        limit: 20,
      });
      setReservas(res.data.data as Reserva[]);
      setMeta(res.data.meta || { total: 0, totalPages: 1 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [estado, fecha, page]);

  useEffect(() => { loadReservas(); }, [loadReservas]);

  const columns = [
    {
      key: 'cliente',
      header: 'Cliente',
      render: (row: Reserva) => <span className="font-medium">{row.cliente?.nombre ?? 'Anónimo'}</span>,
    },
    {
      key: 'menu',
      header: 'Menú',
      render: (row: Reserva) => (
        <div>
          <p className="text-sm">{row.menu?.titulo ?? '-'}</p>
          <p className="text-xs text-gray-500">{formatFecha(row.menu?.fecha)}</p>
        </div>
      ),
    },
    { key: 'cantidad', header: 'Cant.', render: (row: Reserva) => <span>{row.cantidad}</span> },
    {
      key: 'total',
      header: 'Total',
      render: (row: Reserva) => <span className="font-medium">{formatGs(Number(row.total))}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (row: Reserva) => {
        const badge = estadoBadge(row.estado);
        return <Badge variant={badge.variant} size="sm">{badge.label}</Badge>;
      },
    },
    {
      key: 'fecha',
      header: 'Fecha',
      render: (row: Reserva) => <span className="text-xs text-gray-500">{formatFechaHora(row.creado_en)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
        <p className="text-gray-500 text-sm">Gestión de reservas de comidas</p>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="w-48">
            <Input type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); setPage(1); }} label="Fecha" />
          </div>
          <div className="w-48 self-end">
            <select
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={estado}
              onChange={(e) => { setEstado(e.target.value); setPage(1); }}
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="CONFIRMADA">Confirmada</option>
              <option value="EN_COCINA">En cocina</option>
              <option value="PREPARADA">Preparada</option>
              <option value="ENTREGADA">Entregada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
          <div className="self-end">
            <Button variant="secondary" onClick={() => { setFecha(''); setEstado(''); setPage(1); }}>
              Limpiar
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns}
          data={reservas}
          loading={loading}
          emptyMessage="No hay reservas"
          onRowClick={(row) => navigate(`/reservas/${row.id}`)}
        />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={20} onPageChange={setPage} />
      </div>
    </div>
  );
}
