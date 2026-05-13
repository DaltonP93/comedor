import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { recetasApi, productosApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Alert } from '../../components/UI/Alert';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { getErrorMessage } from '../../lib/utils';

interface Producto {
  id: number;
  nombre: string;
  unidad_medida: string;
}

interface IngredienteRow {
  insumo_id: number | '';
  cantidad: string;
  unidad: string;
}

const UNIDADES = [
  { value: 'UNIDAD', label: 'Unidad' },
  { value: 'KG', label: 'Kilogramo (kg)' },
  { value: 'GRAMO', label: 'Gramo (g)' },
  { value: 'LITRO', label: 'Litro (L)' },
  { value: 'ML', label: 'Mililitro (ml)' },
];

export function RecetaForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [productos, setProductos] = useState<Producto[]>([]);
  const [productoId, setProductoId] = useState<number | ''>('');
  const [nombre, setNombre] = useState('');
  const [ingredientes, setIngredientes] = useState<IngredienteRow[]>([
    { insumo_id: '', cantidad: '', unidad: 'UNIDAD' },
  ]);

  // Search states for product and ingredient selects
  const [buscarProducto, setBuscarProducto] = useState('');
  const [productosFiltrados, setProductosFiltrados] = useState<Producto[]>([]);
  const [mostrarListaProducto, setMostrarListaProducto] = useState(false);
  const [productoNombre, setProductoNombre] = useState('');

  useEffect(() => {
    productosApi.listar({ activo: 'true', limit: '500' }).then((res) => {
      setProductos(res.data.data as Producto[]);
    });
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    recetasApi.obtener(parseInt(id!)).then((res) => {
      const r = res.data.data as {
        id: number;
        nombre: string;
        producto_id: number;
        producto: Producto;
        items: Array<{ insumo_id: number; cantidad: string | number; unidad: string }>;
      };
      setNombre(r.nombre);
      setProductoId(r.producto_id);
      setProductoNombre(r.producto.nombre);
      setIngredientes(
        r.items.length > 0
          ? r.items.map((item) => ({
              insumo_id: item.insumo_id,
              cantidad: String(item.cantidad),
              unidad: item.unidad,
            }))
          : [{ insumo_id: '', cantidad: '', unidad: 'UNIDAD' }]
      );
    }).catch((err) => {
      setError(getErrorMessage(err));
    }).finally(() => {
      setLoading(false);
    });
  }, [id, isEditing]);

  useEffect(() => {
    if (!buscarProducto.trim()) {
      setProductosFiltrados([]);
      return;
    }
    const q = buscarProducto.toLowerCase();
    setProductosFiltrados(
      productos.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 8)
    );
  }, [buscarProducto, productos]);

  const seleccionarProducto = (prod: Producto) => {
    setProductoId(prod.id);
    setProductoNombre(prod.nombre);
    setBuscarProducto('');
    setProductosFiltrados([]);
    setMostrarListaProducto(false);
  };

  const agregarIngrediente = () => {
    setIngredientes((prev) => [...prev, { insumo_id: '', cantidad: '', unidad: 'UNIDAD' }]);
  };

  const removeIngrediente = (idx: number) => {
    setIngredientes((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateIngrediente = (idx: number, field: keyof IngredienteRow, value: string | number) => {
    setIngredientes((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!productoId) {
      setError('Debe seleccionar un producto');
      return;
    }
    if (!nombre.trim()) {
      setError('El nombre de la receta es obligatorio');
      return;
    }

    const ingredientesValidos = ingredientes.filter(
      (i) => i.insumo_id !== '' && i.cantidad !== ''
    );

    if (ingredientesValidos.length === 0) {
      setError('Debe agregar al menos un ingrediente');
      return;
    }

    for (const ing of ingredientesValidos) {
      if (Number(ing.cantidad) <= 0) {
        setError('Las cantidades deben ser mayores a 0');
        return;
      }
    }

    setSaving(true);
    try {
      const data = {
        producto_id: productoId,
        nombre: nombre.trim(),
        items: ingredientesValidos.map((i) => ({
          insumo_id: Number(i.insumo_id),
          cantidad: parseFloat(i.cantidad),
          unidad: i.unidad,
        })),
      };

      if (isEditing) {
        await recetasApi.actualizar(parseInt(id!), data);
      } else {
        await recetasApi.crear(data);
      }

      navigate('/recetas');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/recetas')}>
          ← Volver
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Editar receta' : 'Nueva receta'}
        </h1>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos principales */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Datos de la receta</h2>

          {/* Producto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Producto <span className="text-red-500">*</span>
            </label>
            {productoId ? (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-sm font-medium text-blue-800 flex-1">{productoNombre}</span>
                <button
                  type="button"
                  onClick={() => {
                    setProductoId('');
                    setProductoNombre('');
                    setMostrarListaProducto(true);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={buscarProducto}
                  onChange={(e) => {
                    setBuscarProducto(e.target.value);
                    setMostrarListaProducto(true);
                  }}
                  onFocus={() => setMostrarListaProducto(true)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {mostrarListaProducto && productosFiltrados.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {productosFiltrados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => seleccionarProducto(p)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                      >
                        <span className="font-medium">{p.nombre}</span>
                        <span className="text-gray-500 ml-2 text-xs">{p.unidad_medida}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nombre de receta */}
          <Input
            label="Nombre de receta *"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Receta milanesa estándar"
            required
          />
        </div>

        {/* Ingredientes */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Ingredientes</h2>
            <Button type="button" variant="secondary" size="sm" onClick={agregarIngrediente}>
              + Agregar ingrediente
            </Button>
          </div>

          <div className="space-y-3">
            {ingredientes.map((ing, idx) => (
              <div key={idx} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                {/* Insumo select */}
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Insumo / Ingrediente</label>
                  <select
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={ing.insumo_id}
                    onChange={(e) => updateIngrediente(idx, 'insumo_id', e.target.value ? parseInt(e.target.value) : '')}
                  >
                    <option value="">Seleccionar insumo...</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Cantidad */}
                <div className="w-28">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0.000"
                    value={ing.cantidad}
                    onChange={(e) => updateIngrediente(idx, 'cantidad', e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Unidad */}
                <div className="w-36">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
                  <select
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={ing.unidad}
                    onChange={(e) => updateIngrediente(idx, 'unidad', e.target.value)}
                  >
                    {UNIDADES.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>

                {/* Remove button */}
                <div className="pt-5">
                  <button
                    type="button"
                    onClick={() => removeIngrediente(idx)}
                    disabled={ingredientes.length === 1}
                    className="p-2 text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Quitar ingrediente"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {ingredientes.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              Sin ingredientes. Haga clic en "Agregar ingrediente".
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={() => navigate('/recetas')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isEditing ? 'Guardar cambios' : 'Crear receta'}
          </Button>
        </div>
      </form>
    </div>
  );
}
