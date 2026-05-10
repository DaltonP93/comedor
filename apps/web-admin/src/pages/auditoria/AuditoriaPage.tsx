import React, { useState, useEffect, useCallback } from 'react';
import { auditoriaApi } from '../../api/endpoints';
import { Input } from '../../components/UI/Input';
import { Button } from '../../components/UI/Button';
import { Alert } from '../../components/UI/Alert';
import { Table } from '../../components/UI/Table';
import { Pagination } from '../../components/UI/Pagination';
import { formatFechaHora, getErrorMessage, hoyISO } from '../../lib/utils';

interface AuditoriaEntry {
  id: number;
  modulo: string;
  accion: string;
  registro_id: string | null;
  ip: string | null;
  creado_en: string;
  usuario: { nombre: string; apellido: string; email: string } | null;
}

export function AuditoriaPage() {
  const [entries, setEntries] = useState<AuditoriaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modulo, setModulo] = useState('');
  const [fechaDesde, setFechaDesde] = useState(hoyISO());
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditoriaApi.listar({
        modulo: modulo || undefined,
        fecha_desde: fechaDesde ? new Date(fechaDesde).toISOString() : undefined,
        page,
        limit: 30,
      });
      setEntries(res.data.data as AuditoriaEntry[]);
      setMeta(res.data.meta || { total: 0, totalPages: 1 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [modulo, fechaDesde, page]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: 'fecha', header: 'Fecha', render: (r: AuditoriaEntry) => <span className="text-xs text-gray-500">{formatFechaHora(r.creado_en)}</span> },
    { key: 'usuario', header: 'Usuario', render: (r: AuditoriaEntry) => <span className="text-sm">{r.usuario ? `${r.usuario.nombre} ${r.usuario.apellido}` : 'Sistema'}</span> },
    { key: 'modulo', header: 'Módulo', render: (r: AuditoriaEntry) => <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{r.modulo}</span> },
    { key: 'accion', header: 'Acción', render: (r: AuditoriaEntry) => <span className="text-sm font-medium">{r.accion}</span> },
    { key: 'registro', header: 'Registro', render: (r: AuditoriaEntry) => <span className="text-xs text-gray-500">#{r.registro_id || '-'}</span> },
    { key: 'ip', header: 'IP', render: (r: AuditoriaEntry) => <span className="text-xs text-gray-400">{r.ip || '-'}</span> },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 flex-wrap items-end">
          <Input type="date" label="Desde" value={fechaDesde} onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }} />
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Módulo</label>
            <select className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={modulo} onChange={(e) => { setModulo(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {['AUTH', 'VENTAS', 'CLIENTES', 'PRODUCTOS', 'MENUS', 'RESERVAS', 'LIBRETAS', 'STOCK', 'USUARIOS', 'COMPRAS'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <Button variant="secondary" onClick={() => { setModulo(''); setFechaDesde(''); setPage(1); }}>Limpiar</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table columns={columns} data={entries} loading={loading} emptyMessage="Sin registros de auditoría" />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={30} onPageChange={setPage} />
      </div>
    </div>
  );
}
