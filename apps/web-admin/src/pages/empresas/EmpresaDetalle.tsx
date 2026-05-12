import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { empresasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { Card } from '../../components/UI/Card';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { Alert } from '../../components/UI/Alert';
import { formatGs, formatFecha, getErrorMessage } from '../../lib/utils';

interface ClienteEmpresa {
  cliente_id: number;
  empresa_id: number;
  cargo: string | null;
  cliente: {
    id: number;
    nombre: string;
    telefono: string | null;
    email: string | null;
    estado: string;
    documento_numero: string | null;
  };
}

interface Libreta {
  id: number;
  tipo: string;
  saldo_actual: number | string;
  saldo_vencido: number | string;
  limite_credito: number | string;
  estado: string;
  creado_en: string;
  cliente: { id: number; nombre: string };
}

interface Empresa {
  id: number;
  nombre: string;
  ruc: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  clientes: ClienteEmpresa[];
  libretas: Libreta[];
}

type Tab = 'clientes' | 'libretas' | 'resumen';

export default function EmpresaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('clientes');

  useEffect(() => {
    loadEmpresa();
  }, [id]);

  const loadEmpresa = async () => {
    setLoading(true);
    try {
      const res = await empresasApi.obtener(parseInt(id!));
      setEmpresa(res.data.data as Empresa);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!empresa) return null;

  const totalDeuda = empresa.libretas.reduce(
    (acc, l) => acc + Number(l.saldo_actual),
    0
  );
  const libretasBloqueadas = empresa.libretas.filter((l) => l.estado === 'BLOQUEADA').length;
  const libretasActivas = empresa.libretas.filter((l) => l.estado === 'ACTIVA').length;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'clientes', label: `Clientes (${empresa.clientes.length})` },
    { key: 'libretas', label: `Libretas (${empresa.libretas.length})` },
    { key: 'resumen', label: 'Resumen' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/empresas')}>
          ← Volver
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{empresa.nombre}</h1>
            <Badge variant={empresa.activo ? 'success' : 'default'} size="sm">
              {empresa.activo ? 'Activa' : 'Inactiva'}
            </Badge>
          </div>
          {empresa.ruc && (
            <p className="text-gray-500 text-sm">RUC: {empresa.ruc}</p>
          )}
        </div>
      </div>

      {/* Info card */}
      <Card title="Información de la empresa">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">RUC</p>
            <p className="text-sm text-gray-900 mt-1">{empresa.ruc || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Teléfono</p>
            <p className="text-sm text-gray-900 mt-1">{empresa.telefono || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</p>
            <p className="text-sm text-gray-900 mt-1">{empresa.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dirección</p>
            <p className="text-sm text-gray-900 mt-1">{empresa.direccion || '—'}</p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Tab: Clientes */}
          {tab === 'clientes' && (
            <div>
              {empresa.clientes.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No hay clientes asociados a esta empresa</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Documento</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Cargo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Teléfono</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {empresa.clientes.map((ce) => {
                        const badge = estadoBadge(ce.cliente.estado);
                        return (
                          <tr key={ce.cliente_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-900">{ce.cliente.nombre}</p>
                              {ce.cliente.email && (
                                <p className="text-xs text-gray-500">{ce.cliente.email}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {ce.cliente.documento_numero || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {ce.cargo || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {ce.cliente.telefono || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                to={`/clientes/${ce.cliente_id}`}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                Ver
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Libretas */}
          {tab === 'libretas' && (
            <div>
              {empresa.libretas.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No hay libretas asociadas a esta empresa</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Saldo actual</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Límite crédito</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Saldo vencido</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Creada</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {empresa.libretas.map((libreta) => {
                        const badge = estadoBadge(libreta.estado);
                        return (
                          <tr key={libreta.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-900">{libreta.cliente.nombre}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{libreta.tipo}</td>
                            <td className="px-4 py-3">
                              <span className={`text-sm font-semibold ${Number(libreta.saldo_actual) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                {formatGs(Number(libreta.saldo_actual))}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatGs(Number(libreta.limite_credito))}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-sm ${Number(libreta.saldo_vencido) > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'}`}>
                                {formatGs(Number(libreta.saldo_vencido))}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {formatFecha(libreta.creado_en)}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                to={`/libretas/${libreta.id}`}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                Ver
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Resumen */}
          {tab === 'resumen' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-red-50 rounded-lg p-5 border border-red-100">
                <p className="text-sm font-medium text-red-700">Total deuda</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{formatGs(totalDeuda)}</p>
                <p className="text-xs text-red-600 mt-1">Suma de saldos actuales de todas las libretas</p>
              </div>
              <div className="bg-green-50 rounded-lg p-5 border border-green-100">
                <p className="text-sm font-medium text-green-700">Libretas activas</p>
                <p className="text-2xl font-bold text-green-900 mt-1">{libretasActivas}</p>
                <p className="text-xs text-green-600 mt-1">Con crédito disponible</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-5 border border-orange-100">
                <p className="text-sm font-medium text-orange-700">Libretas bloqueadas</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">{libretasBloqueadas}</p>
                <p className="text-xs text-orange-600 mt-1">Requieren atención o pago</p>
              </div>
              <div className="md:col-span-3 bg-gray-50 rounded-lg p-5 border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Resumen de clientes</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Total clientes vinculados</p>
                    <p className="text-lg font-semibold text-gray-900">{empresa.clientes.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total libretas</p>
                    <p className="text-lg font-semibold text-gray-900">{empresa.libretas.length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
