import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { libretasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Table } from '../../components/UI/Table';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { Pagination } from '../../components/UI/Pagination';
import { Alert } from '../../components/UI/Alert';
import { formatGs, getErrorMessage } from '../../lib/utils';

interface Libreta {
  id: number;
  tipo: string;
  saldo_actual: number | string;
  saldo_vencido: number | string;
  limite_credito: number | string;
  estado: string;
  cliente: { nombre: string; documento_numero: string | null };
  empresa: { nombre: string } | null;
}

export function LibretasPage() {
  const navigate = useNavigate();
  const [libretas, setLibretas] = useState<Libreta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [estado, setEstado] = useState('ACTIVA');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });

  const loadLibretas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await libretasApi.listar({ estado: estado || undefined, page, limit: 20 });
      setLibretas(res.data.data as Libreta[]);
      setMeta(res.data.meta || { total: 0, totalPages: 1 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [estado, page]);

  useEffect(() => { loadLibretas(); }, [loadLibretas]);

  const columns = [
    {
      key: 'cliente',
      header: 'Cliente',
      render: (row: Libreta) => (
        <div>
          <p className="font-medium">{row.cliente?.nombre}</p>
          <p className="text-xs text-gray-500">{row.cliente?.documento_numero || row.empresa?.nombre || '-'}</p>
        </div>
      ),
    },
    { key: 'tipo', header: 'Tipo', render: (row: Libreta) => <span className="text-sm">{row.tipo}</span> },
    {
      key: 'saldo',
      header: 'Saldo',
      render: (row: Libreta) => (
        <span className={`font-semibold ${Number(row.saldo_actual) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
          {formatGs(Number(row.saldo_actual))}
        </span>
      ),
    },
    {
      key: 'limite',
      header: 'Límite',
      render: (row: Libreta) => <span className="text-sm text-gray-600">{formatGs(Number(row.limite_credito))}</span>,
    },
    {
      key: 'disponible',
      header: 'Disponible',
      render: (row: Libreta) => {
        const disponible = Number(row.limite_credito) - Number(row.saldo_actual);
        return <span className={`text-sm font-medium ${disponible <= 0 ? 'text-red-600' : 'text-green-600'}`}>{formatGs(disponible)}</span>;
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (row: Libreta) => {
        const badge = estadoBadge(row.estado);
        return <Badge variant={badge.variant} size="sm">{badge.label}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Libretas</h1>
        <p className="text-gray-500 text-sm">Cuentas corrientes de clientes</p>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4">
          <div className="w-48">
            <select className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              <option value="ACTIVA">Activa</option>
              <option value="BLOQUEADA">Bloqueada</option>
              <option value="CERRADA">Cerrada</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns}
          data={libretas}
          loading={loading}
          emptyMessage="No hay libretas"
          onRowClick={(row) => navigate(`/libretas/${row.id}`)}
        />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={20} onPageChange={setPage} />
      </div>
    </div>
  );
}
