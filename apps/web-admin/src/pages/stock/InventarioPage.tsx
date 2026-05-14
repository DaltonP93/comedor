import React, { useState, useEffect } from 'react';
import { stockApi, productosApi, sucursalesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Card } from '../../components/UI/Card';
import { Alert } from '../../components/UI/Alert';
import { Badge } from '../../components/UI/Badge';
import { formatGs, hoyISO, getErrorMessage } from '../../lib/utils';

type Paso = 1 | 2 | 3 | 4;

interface Producto {
  id: number;
  nombre: string;
  codigo?: string;
  categoria?: { nombre: string };
}

interface Sucursal {
  id: number;
  nombre: string;
}

interface ItemInventario {
  producto: Producto;
  stock_sistema: number;
  stock_contado: string;
  costo_promedio: number;
}

interface Diferencia {
  producto: Producto;
  stock_sistema: number;
  stock_contado: number;
  diferencia: number;
  costo_promedio: number;
}

export function InventarioPage() {
  const [paso, setPaso] = useState<Paso>(1);

  // Paso 1
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [observacion, setObservacion] = useState('');

  // Paso 2
  const [items, setItems] = useState<ItemInventario[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Paso 3 diferencias
  const [diferencias, setDiferencias] = useState<Diferencia[]>([]);

  // Paso 4 confirmar
  const [confirmando, setConfirmando] = useState(false);
  const [confirmados, setConfirmados] = useState(0);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    sucursalesApi
      .listar()
      .then((r) => setSucursales(r.data.data as Sucursal[]))
      .catch(() => {});
  }, []);

  const handlePaso1 = async () => {
    if (!sucursalId) {
      setError('Seleccione una sucursal');
      return;
    }
    setError('');
    setLoadingItems(true);
    try {
      const [prodRes, stockRes] = await Promise.all([
        productosApi.listar({ activo: true, limit: 500 }),
        stockApi.listar({ sucursal_id: sucursalId }).catch(() => ({ data: { data: [] } })),
      ]);
      const productos = prodRes.data.data as Producto[];
      const stockData = stockRes.data.data as Array<{
        producto_id: number;
        cantidad: number;
        costo_promedio?: number;
      }>;
      const stockMap: Record<number, { cantidad: number; costo_promedio: number }> = {};
      stockData.forEach((s) => {
        stockMap[s.producto_id] = { cantidad: s.cantidad, costo_promedio: s.costo_promedio || 0 };
      });
      setItems(
        productos.map((p) => ({
          producto: p,
          stock_sistema: stockMap[p.id]?.cantidad || 0,
          stock_contado: '',
          costo_promedio: stockMap[p.id]?.costo_promedio || 0,
        }))
      );
      setPaso(2);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingItems(false);
    }
  };

  const handlePaso2 = () => {
    setError('');
    const diffs: Diferencia[] = [];
    items.forEach((item) => {
      const contado = item.stock_contado === '' ? item.stock_sistema : parseInt(item.stock_contado);
      const diff = contado - item.stock_sistema;
      if (diff !== 0) {
        diffs.push({
          producto: item.producto,
          stock_sistema: item.stock_sistema,
          stock_contado: contado,
          diferencia: diff,
          costo_promedio: item.costo_promedio,
        });
      }
    });
    setDiferencias(diffs);
    setPaso(3);
  };

  const handleConfirmar = async () => {
    if (diferencias.length === 0) {
      setSuccess('No hay diferencias para ajustar');
      setPaso(4);
      return;
    }
    setConfirmando(true);
    setError('');
    let ok = 0;
    for (const diff of diferencias) {
      try {
        await stockApi.ajuste({
          producto_id: diff.producto.id,
          sucursal_id: parseInt(sucursalId),
          cantidad: diff.diferencia,
          motivo: `Inventario físico ${fecha}${observacion ? ' - ' + observacion : ''}`,
          tipo: diff.diferencia > 0 ? 'ENTRADA_AJUSTE' : 'SALIDA_AJUSTE',
        });
        ok++;
        setConfirmados(ok);
      } catch {
        // continue with remaining
      }
    }
    setSuccess(`Inventario confirmado: ${ok} ajuste${ok !== 1 ? 's' : ''} generado${ok !== 1 ? 's' : ''}`);
    setConfirmando(false);
    setPaso(4);
  };

  const reiniciar = () => {
    setPaso(1);
    setItems([]);
    setDiferencias([]);
    setConfirmados(0);
    setSuccess('');
    setError('');
    setObservacion('');
    setSucursalId('');
  };

  const pasos = [
    { n: 1, label: 'Configurar' },
    { n: 2, label: 'Contar' },
    { n: 3, label: 'Revisar' },
    { n: 4, label: 'Confirmar' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventario Físico</h1>
        <p className="text-sm text-gray-500 mt-1">Recuento y ajuste de stock</p>
      </div>

      {/* Indicador de pasos */}
      <div className="flex items-center gap-0">
        {pasos.map((p, idx) => (
          <React.Fragment key={p.n}>
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  paso > p.n
                    ? 'bg-green-600 text-white'
                    : paso === p.n
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {paso > p.n ? '✓' : p.n}
              </div>
              <span className={`text-xs mt-1 ${paso === p.n ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                {p.label}
              </span>
            </div>
            {idx < pasos.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 ${paso > p.n ? 'bg-green-600' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      {/* Paso 1: Configurar */}
      {paso === 1 && (
        <Card title="Configurar inventario">
          <div className="space-y-4 max-w-md">
            <Select
              label="Sucursal"
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
            >
              <option value="">Seleccione sucursal...</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </Select>
            <Input
              label="Fecha de inventario"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            <Input
              label="Observación (opcional)"
              type="text"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej: Inventario mensual mayo"
            />
            <Button onClick={handlePaso1} loading={loadingItems}>
              Cargar productos
            </Button>
          </div>
        </Card>
      )}

      {/* Paso 2: Contar */}
      {paso === 2 && (
        <Card
          title={`Conteo de productos (${items.length})`}
          actions={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPaso(1)}>
                Atrás
              </Button>
              <Button size="sm" onClick={handlePaso2}>
                Ver diferencias
              </Button>
            </div>
          }
        >
          <p className="text-sm text-gray-500 mb-4">
            Deje el campo en blanco si la cantidad es igual al stock del sistema.
          </p>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {items.map((item, idx) => (
              <div
                key={item.producto.id}
                className="grid grid-cols-12 gap-2 items-center py-2 border-b border-gray-100"
              >
                <div className="col-span-5">
                  <p className="text-sm font-medium text-gray-900">{item.producto.nombre}</p>
                  <p className="text-xs text-gray-500">{item.producto.categoria?.nombre}</p>
                </div>
                <div className="col-span-3 text-right">
                  <p className="text-xs text-gray-500">Sistema</p>
                  <p className="text-sm font-semibold text-gray-700">{item.stock_sistema}</p>
                </div>
                <div className="col-span-4">
                  <Input
                    type="number"
                    min="0"
                    placeholder={String(item.stock_sistema)}
                    value={item.stock_contado}
                    onChange={(e) => {
                      setItems((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], stock_contado: e.target.value };
                        return next;
                      });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Paso 3: Revisar diferencias */}
      {paso === 3 && (
        <Card
          title="Diferencias encontradas"
          actions={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPaso(2)}>
                Atrás
              </Button>
              <Button size="sm" variant="success" onClick={handleConfirmar} loading={confirmando}>
                Confirmar ajustes
              </Button>
            </div>
          }
        >
          {diferencias.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="font-medium">Sin diferencias</p>
              <p className="text-sm mt-1">El stock contado coincide con el sistema</p>
              <Button className="mt-4" onClick={handleConfirmar}>
                Confirmar sin ajustes
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Se generarán <strong>{diferencias.length}</strong> ajuste{diferencias.length !== 1 ? 's' : ''} de stock.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sistema</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Contado</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Diferencia</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impacto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {diferencias.map((d) => (
                      <tr key={d.producto.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.producto.nombre}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{d.stock_sistema}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{d.stock_contado}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <Badge variant={d.diferencia > 0 ? 'success' : 'danger'}>
                            {d.diferencia > 0 ? '+' : ''}{d.diferencia}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {formatGs(Math.abs(d.diferencia) * d.costo_promedio)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Paso 4: Completado */}
      {paso === 4 && (
        <Card>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Inventario completado</h3>
            <p className="text-gray-500 mt-1">
              {confirmados} ajuste{confirmados !== 1 ? 's' : ''} aplicado{confirmados !== 1 ? 's' : ''} correctamente
            </p>
            <Button className="mt-6" onClick={reiniciar}>
              Nuevo inventario
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
