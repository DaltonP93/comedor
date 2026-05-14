import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { cajasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Card, StatCard } from '../../components/UI/Card';
import { Badge, estadoBadge } from '../../components/UI/Badge';
import { Alert } from '../../components/UI/Alert';
import { Modal } from '../../components/UI/Modal';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { PageBack } from '../../components/UI/PageBack';
import { formatGs, formatFechaHora, getErrorMessage } from '../../lib/utils';
import apiClient from '../../api/client';

interface ResumenFormaPago {
  forma_pago: string;
  total: number;
  cantidad: number;
}

interface Movimiento {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  created_at: string;
}

interface CajaEstado {
  caja: {
    id: number;
    nombre: string;
    estado: string;
    sucursal?: { nombre: string };
  };
  apertura?: {
    id: number;
    monto_inicial: number;
    fecha_apertura: string;
    usuario?: { nombre: string };
    movimientos?: Movimiento[];
  };
}

const FORMAS_PAGO = ['EFECTIVO', 'POS', 'TRANSFERENCIA', 'CHEQUE', 'ONLINE'];

export default function CajaAperturaPage() {
  const { id: cajaId } = useParams();

  const [estado, setEstado] = useState<CajaEstado | null>(null);
  const [resumen, setResumen] = useState<ResumenFormaPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Abrir caja form
  const [montoInicial, setMontoInicial] = useState('');
  const [obsAbrir, setObsAbrir] = useState('');
  const [abriendo, setAbriendo] = useState(false);

  // Cerrar caja modal
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [montoDeclarado, setMontoDeclarado] = useState<Record<string, string>>({});
  const [obsCerrar, setObsCerrar] = useState('');
  const [cerrando, setCerrando] = useState(false);

  // Retiro modal
  const [showRetiroModal, setShowRetiroModal] = useState(false);
  const [montoRetiro, setMontoRetiro] = useState('');
  const [descripcionRetiro, setDescripcionRetiro] = useState('');
  const [retirando, setRetirando] = useState(false);

  const loadEstado = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(`/caja/${cajaId}/estado`);
      const data = res.data.data as CajaEstado;
      setEstado(data);

      if (data.apertura?.id) {
        try {
          const resRes = await apiClient.get(`/caja/aperturas/${data.apertura.id}/resumen`);
          setResumen(resRes.data.data as ResumenFormaPago[]);
        } catch {
          setResumen([]);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [cajaId]);

  useEffect(() => {
    loadEstado();
  }, [loadEstado]);

  const handleAbrir = async () => {
    if (!montoInicial || parseInt(montoInicial) < 0) {
      setError('Ingrese un monto inicial válido');
      return;
    }
    setAbriendo(true);
    setError('');
    try {
      await apiClient.post(`/caja/${cajaId}/abrir`, {
        monto_inicial: parseInt(montoInicial),
        observacion: obsAbrir || undefined,
      });
      setSuccess('Caja abierta correctamente');
      setMontoInicial('');
      setObsAbrir('');
      await loadEstado();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAbriendo(false);
    }
  };

  const handleCerrar = async () => {
    setCerrando(true);
    setError('');
    try {
      const montoDeclaradoObj: Record<string, number> = {};
      FORMAS_PAGO.forEach((fp) => {
        const val = parseInt(montoDeclarado[fp] || '0');
        if (val > 0) montoDeclaradoObj[fp] = val;
      });

      await apiClient.post(`/caja/aperturas/${estado?.apertura?.id}/cerrar`, {
        monto_declarado: montoDeclaradoObj,
        observacion: obsCerrar || undefined,
      });
      setSuccess('Caja cerrada correctamente');
      setShowCerrarModal(false);
      setMontoDeclarado({});
      setObsCerrar('');
      await loadEstado();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCerrando(false);
    }
  };

  const handleRetiro = async () => {
    if (!montoRetiro || parseInt(montoRetiro) <= 0) {
      setError('Ingrese un monto válido');
      return;
    }
    setRetirando(true);
    setError('');
    try {
      await apiClient.post(`/caja/aperturas/${estado?.apertura?.id}/retiro`, {
        monto: parseInt(montoRetiro),
        descripcion: descripcionRetiro || 'Retiro de caja',
      });
      setSuccess('Retiro registrado correctamente');
      setShowRetiroModal(false);
      setMontoRetiro('');
      setDescripcionRetiro('');
      await loadEstado();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRetirando(false);
    }
  };

  if (loading) return <PageLoader />;

  const cajaAbierta = estado?.caja?.estado === 'ABIERTA';
  const badge = estadoBadge(estado?.caja?.estado || '');
  const movimientos = estado?.apertura?.movimientos || [];

  const totalResumen = resumen.reduce((acc, r) => acc + r.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <PageBack to="/cajas" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Caja: {estado?.caja?.nombre || `#${cajaId}`}
            </h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          {estado?.caja?.sucursal && (
            <p className="text-sm text-gray-500">{estado.caja.sucursal.nombre}</p>
          )}
        </div>
        {cajaAbierta && (
          <div className="flex gap-2">
            <Button variant="warning" onClick={() => setShowRetiroModal(true)}>
              Registrar retiro
            </Button>
            <Button variant="danger" onClick={() => setShowCerrarModal(true)}>
              Cerrar caja
            </Button>
          </div>
        )}
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Estado: CERRADA → formulario para abrir */}
      {!cajaAbierta && (
        <Card title="Abrir caja">
          <div className="space-y-4 max-w-md">
            <Input
              label="Monto inicial (Gs.)"
              type="number"
              min="0"
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Observación (opcional)"
              type="text"
              value={obsAbrir}
              onChange={(e) => setObsAbrir(e.target.value)}
              placeholder="Ej: Apertura de turno mañana"
            />
            <Button onClick={handleAbrir} loading={abriendo} variant="success">
              Abrir caja
            </Button>
          </div>
        </Card>
      )}

      {/* Estado: ABIERTA → resumen */}
      {cajaAbierta && estado?.apertura && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Monto inicial"
              value={formatGs(estado.apertura.monto_inicial)}
              color="blue"
            />
            <StatCard
              title="Total en caja"
              value={formatGs(totalResumen + estado.apertura.monto_inicial)}
              color="green"
            />
            <StatCard
              title="Apertura"
              value={formatFechaHora(estado.apertura.fecha_apertura)}
              subtitle={estado.apertura.usuario ? `por ${estado.apertura.usuario.nombre}` : undefined}
              color="purple"
            />
          </div>

          {/* Resumen por forma de pago */}
          {resumen.length > 0 && (
            <Card title="Resumen por forma de pago">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Forma de pago</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resumen.map((r) => (
                      <tr key={r.forma_pago}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.forma_pago}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{r.cantidad}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{formatGs(r.total)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {resumen.reduce((a, r) => a + r.cantidad, 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatGs(totalResumen)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Movimientos recientes */}
      {movimientos.length > 0 && (
        <Card title="Movimientos recientes">
          <div className="divide-y divide-gray-100">
            {movimientos.map((mov) => (
              <div key={mov.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{mov.descripcion || mov.tipo}</p>
                  <p className="text-xs text-gray-500">{formatFechaHora(mov.created_at)}</p>
                </div>
                <p className={`text-sm font-semibold ${mov.tipo === 'RETIRO' ? 'text-red-600' : 'text-green-600'}`}>
                  {mov.tipo === 'RETIRO' ? '-' : '+'}{formatGs(mov.monto)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal cerrar caja */}
      <Modal
        isOpen={showCerrarModal}
        onClose={() => setShowCerrarModal(false)}
        title="Cerrar caja - Arqueo"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Ingrese el monto contado por forma de pago para realizar el arqueo.
          </p>
          {FORMAS_PAGO.map((fp) => (
            <Input
              key={fp}
              label={`${fp} (Gs.)`}
              type="number"
              min="0"
              value={montoDeclarado[fp] || ''}
              onChange={(e) =>
                setMontoDeclarado((prev) => ({ ...prev, [fp]: e.target.value }))
              }
              placeholder="0"
            />
          ))}
          <Input
            label="Observación (opcional)"
            type="text"
            value={obsCerrar}
            onChange={(e) => setObsCerrar(e.target.value)}
            placeholder="Ej: Cierre de turno tarde"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowCerrarModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleCerrar} loading={cerrando}>
              Confirmar cierre
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal retiro */}
      <Modal
        isOpen={showRetiroModal}
        onClose={() => setShowRetiroModal(false)}
        title="Registrar retiro"
      >
        <div className="space-y-4">
          <Input
            label="Monto a retirar (Gs.)"
            type="number"
            min="1"
            value={montoRetiro}
            onChange={(e) => setMontoRetiro(e.target.value)}
            placeholder="0"
          />
          <Input
            label="Motivo / descripción"
            type="text"
            value={descripcionRetiro}
            onChange={(e) => setDescripcionRetiro(e.target.value)}
            placeholder="Ej: Pago de proveedor"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowRetiroModal(false)}>
              Cancelar
            </Button>
            <Button variant="warning" onClick={handleRetiro} loading={retirando}>
              Confirmar retiro
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
