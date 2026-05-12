import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ventasApi, productosApi, clientesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { PageBack } from '../../components/UI/PageBack';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Alert } from '../../components/UI/Alert';
import { formatGs, getErrorMessage } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

interface CartItem {
  producto_id: number;
  nombre: string;
  cantidad: number;
  unidad_medida: string;
  precio_unitario: number;
  iva_porcentaje: number;
  es_kilo: boolean;
  peso_kg?: number;
}

interface Producto {
  id: number;
  nombre: string;
  codigo: string | null;
  precio_venta: number | string;
  precio_por_kg: number | string | null;
  venta_por_kilo: boolean;
  iva_porcentaje: number | string;
  unidad_medida: string;
}

interface Cliente {
  id: number;
  nombre: string;
  documento_numero: string | null;
}

export function NuevaVenta() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [buscarProducto, setBuscarProducto] = useState('');
  const [productosFiltrados, setProductosFiltrados] = useState<Producto[]>([]);
  const [buscarCliente, setBuscarCliente] = useState('');
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [clienteNombre, setClienteNombre] = useState('');
  const [formaPago, setFormaPago] = useState('EFECTIVO');
  const [descuento, setDescuento] = useState('0');
  const [modoKilo, setModoKilo] = useState(false);
  const [pesoKg, setPesoKg] = useState('');
  const [productoKilo, setProductoKilo] = useState<Produto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef<NodeJS.Timeout | null>(null);

  type Produto = Producto;

  useEffect(() => {
    productosApi.listar({ activo: 'true', limit: '200' }).then((res) => {
      setProductos(res.data.data as Produto[]);
    });
  }, []);

  useEffect(() => {
    if (!buscarProducto.trim()) {
      setProductosFiltrados([]);
      return;
    }
    const q = buscarProducto.toLowerCase();
    setProductosFiltrados(
      productos.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.codigo && p.codigo.toLowerCase().includes(q))
      ).slice(0, 8)
    );
  }, [buscarProducto, productos]);

  useEffect(() => {
    if (!buscarCliente.trim()) {
      setClientesFiltrados([]);
      return;
    }
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(async () => {
      try {
        const res = await clientesApi.listar({ buscar: buscarCliente, limit: '5' });
        setClientesFiltrados(res.data.data as Cliente[]);
      } catch {
        // ignore
      }
    }, 300);
  }, [buscarCliente]);

  const addProducto = (prod: Produto) => {
    const existing = cart.findIndex((item) => item.producto_id === prod.id && !item.es_kilo);
    if (existing >= 0) {
      setCart((prev) =>
        prev.map((item, i) =>
          i === existing ? { ...item, cantidad: item.cantidad + 1 } : item
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          producto_id: prod.id,
          nombre: prod.nombre,
          cantidad: 1,
          unidad_medida: prod.unidad_medida,
          precio_unitario: Number(prod.precio_venta),
          iva_porcentaje: Number(prod.iva_porcentaje),
          es_kilo: false,
        },
      ]);
    }
    setBuscarProducto('');
    setProductosFiltrados([]);
  };

  const addKilo = () => {
    if (!productoKilo || !pesoKg) return;
    const peso = parseFloat(pesoKg);
    if (isNaN(peso) || peso <= 0) return;
    setCart((prev) => [
      ...prev,
      {
        producto_id: productoKilo.id,
        nombre: `${productoKilo.nombre} - ${peso}kg`,
        cantidad: peso,
        unidad_medida: 'KG',
        precio_unitario: Number(productoKilo.precio_por_kg ?? 0),
        iva_porcentaje: Number(productoKilo.iva_porcentaje),
        es_kilo: true,
        peso_kg: peso,
      },
    ]);
    setPesoKg('');
    setProductoKilo(null);
    setModoKilo(false);
  };

  const updateCantidad = (idx: number, cantidad: number) => {
    if (cantidad <= 0) {
      setCart((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setCart((prev) => prev.map((item, i) => i === idx ? { ...item, cantidad } : item));
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0);
  const descuentoNum = parseInt(descuento) || 0;
  const total = subtotal - descuentoNum;

  const handleVenta = async () => {
    if (cart.length === 0) {
      setError('Debe agregar al menos un producto');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const sucursalId = usuario?.sucursal?.id || 1;
      await ventasApi.crear({
        sucursal_id: sucursalId,
        cliente_id: clienteId || undefined,
        items: cart.map((item) => ({
          producto_id: item.producto_id,
          descripcion: item.nombre,
          cantidad: item.cantidad,
          unidad_medida: item.unidad_medida,
          precio_unitario: item.precio_unitario,
          iva_porcentaje: item.iva_porcentaje,
        })),
        forma_pago: formaPago,
        condicion_pago: formaPago === 'LIBRETA' ? 'CREDITO' : 'CONTADO',
        descuento: descuentoNum,
      });
      navigate('/ventas');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageBack to="/ventas" />
        <h1 className="text-2xl font-bold text-gray-900">Nueva Venta</h1>
        <button
          type="button"
          onClick={() => setModoKilo(!modoKilo)}
          className={`ml-auto px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${modoKilo ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          {modoKilo ? '⚖ Modo kilo ON' : 'Modo kilo'}
        </button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: search & cart */}
        <div className="lg:col-span-2 space-y-4">
          {/* Product search */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Buscar producto</h3>
            <div className="relative">
              <Input
                placeholder="Nombre o código del producto..."
                value={buscarProducto}
                onChange={(e) => setBuscarProducto(e.target.value)}
                autoFocus
              />
              {productosFiltrados.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {productosFiltrados.map((prod) => (
                    <button
                      key={prod.id}
                      onClick={() => addProducto(prod)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{prod.nombre}</p>
                        <p className="text-xs text-gray-500">{prod.codigo || prod.unidad_medida}</p>
                      </div>
                      <span className="text-sm font-semibold text-blue-600">{formatGs(Number(prod.precio_venta))}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Kilo mode */}
            {modoKilo && (
              <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm font-medium text-orange-800 mb-2">Venta por kilo</p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <select
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={productoKilo?.id ?? ''}
                      onChange={(e) => {
                        const p = productos.find((pr) => pr.id === parseInt(e.target.value));
                        setProductoKilo(p || null);
                      }}
                    >
                      <option value="">Seleccionar producto</option>
                      {productos.filter((p) => p.precio_por_kg).map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre} - {formatGs(Number(p.precio_por_kg))}/kg</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="Kg"
                      value={pesoKg}
                      onChange={(e) => setPesoKg(e.target.value)}
                    />
                  </div>
                  <Button onClick={addKilo} disabled={!productoKilo || !pesoKg}>
                    Agregar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Carrito ({cart.length})</h3>
            </div>
            {cart.length === 0 ? (
              <p className="px-4 py-8 text-center text-gray-500 text-sm">Sin productos. Busque un producto para agregar.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.nombre}</p>
                      <p className="text-xs text-gray-500">{formatGs(item.precio_unitario)} c/u</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateCantidad(idx, item.cantidad - (item.es_kilo ? 0.1 : 1))}
                        className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm"
                      >-</button>
                      <span className="w-12 text-center text-sm font-medium">
                        {item.es_kilo ? item.cantidad.toFixed(3) : item.cantidad}
                      </span>
                      <button
                        onClick={() => updateCantidad(idx, item.cantidad + (item.es_kilo ? 0.1 : 1))}
                        className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm"
                      >+</button>
                    </div>
                    <span className="text-sm font-semibold w-24 text-right">
                      {formatGs(item.precio_unitario * item.cantidad)}
                    </span>
                    <button onClick={() => updateCantidad(idx, 0)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: payment */}
        <div className="space-y-4">
          {/* Client */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Cliente (opcional)</h3>
            <div className="relative">
              <Input
                placeholder="Buscar cliente..."
                value={clienteNombre || buscarCliente}
                onChange={(e) => {
                  setBuscarCliente(e.target.value);
                  setClienteNombre('');
                  setClienteId(null);
                }}
              />
              {clientesFiltrados.length > 0 && !clienteId && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                  {clientesFiltrados.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setClienteId(c.id);
                        setClienteNombre(c.nombre);
                        setBuscarCliente('');
                        setClientesFiltrados([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                    >
                      <p className="font-medium">{c.nombre}</p>
                      <p className="text-xs text-gray-500">{c.documento_numero || 'Sin doc.'}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clienteId && (
              <p className="mt-2 text-xs text-green-600">Cliente: {clienteNombre}</p>
            )}
          </div>

          {/* Payment */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <h3 className="font-medium text-gray-900">Pago</h3>
            <Select
              label="Forma de pago"
              value={formaPago}
              onChange={(e) => setFormaPago(e.target.value)}
              options={[
                { value: 'EFECTIVO', label: 'Efectivo' },
                { value: 'LIBRETA', label: 'Libreta/Cuenta' },
                { value: 'POS', label: 'Tarjeta POS' },
                { value: 'TRANSFERENCIA', label: 'Transferencia' },
                { value: 'CHEQUE', label: 'Cheque' },
              ]}
            />
            <Input
              label="Descuento (Gs.)"
              type="number"
              min="0"
              value={descuento}
              onChange={(e) => setDescuento(e.target.value)}
            />
          </div>

          {/* Totals */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatGs(subtotal)}</span>
              </div>
              {descuentoNum > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Descuento</span>
                  <span>-{formatGs(descuentoNum)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
                <span>TOTAL</span>
                <span className="text-blue-600">{formatGs(total)}</span>
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleVenta}
            loading={loading}
            disabled={cart.length === 0}
          >
            Confirmar venta
          </Button>
        </div>
      </div>
    </div>
  );
}
