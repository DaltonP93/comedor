import React, { useState, useEffect } from 'react';
import { cajasApi } from '../../api/endpoints';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { Button } from '../../components/UI/Button';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { getErrorMessage } from '../../lib/utils';

interface Caja { id: number; nombre: string; estado: string; activo: boolean; sucursal?: { nombre: string }; }

export function CajasPage() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { load(); }, []);
  const load = async () => {
    try { const res = await cajasApi.listar(); setCajas(res.data.data as Caja[]); }
    catch (err) { setError(getErrorMessage(err)); } finally { setLoading(false); }
  };
  const toggleCaja = async (c: Caja) => {
    try {
      if (c.estado === 'CERRADA') { await cajasApi.abrir(c.id); } else { await cajasApi.cerrar(c.id); }
      load();
    } catch (err) { setError(getErrorMessage(err)); }
  };

  if (loading) return <PageLoader />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Cajas</h1><p className="text-gray-500 text-sm mt-1">Gestión de cajas registradoras</p></div>
      {error && <Alert type="error">{error}</Alert>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cajas.map((c) => {
          const isOpen = c.estado === 'ABIERTA';
          return (
            <div key={c.id} className={`bg-white rounded-lg shadow-sm border-2 p-5 ${isOpen ? 'border-green-300' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div><h3 className="font-semibold text-gray-900 text-lg">{c.nombre}</h3>
                  <p className="text-sm text-gray-500">{c.sucursal?.nombre || 'Sin sucursal'}</p></div>
                <Badge variant={isOpen ? 'success' : 'default'} size="sm">{c.estado}</Badge>
              </div>
              <Button variant={isOpen ? 'danger' : 'primary'} className="w-full mt-2" onClick={() => toggleCaja(c)}>
                {isOpen ? '🔒 Cerrar Caja' : '🔓 Abrir Caja'}
              </Button>
            </div>
          );
        })}
        {cajas.length === 0 && <div className="col-span-full text-center py-12 text-gray-500">No hay cajas registradas</div>}
      </div>
    </div>
  );
}
