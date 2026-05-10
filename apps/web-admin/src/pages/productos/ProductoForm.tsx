import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { productosApi, categoriasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Alert } from '../../components/UI/Alert';
import { Card } from '../../components/UI/Card';
import { getErrorMessage } from '../../lib/utils';

interface Categoria { id: number; nombre: string; }

const initialData = {
  codigo: '',
  codigo_barra: '',
  nombre: '',
  descripcion: '',
  categoria_id: '',
  unidad_medida: 'UNIDAD',
  precio_venta: '0',
  precio_por_kg: '',
  costo_promedio: '0',
  iva_porcentaje: '10',
  controla_stock: true,
  venta_por_kilo: false,
  activo: true,
};

export function ProductoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [formData, setFormData] = useState(initialData);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    categoriasApi.listar({ activo: 'true' }).then((res) => {
      setCategorias(res.data.data as Categoria[]);
    });
    if (isEditing) loadProducto();
  }, [id]);

  const loadProducto = async () => {
    setLoading(true);
    try {
      const res = await productosApi.obtener(parseInt(id!));
      const p = res.data.data as Record<string, unknown>;
      setFormData({
        codigo: String(p.codigo ?? ''),
        codigo_barra: String(p.codigo_barra ?? ''),
        nombre: String(p.nombre ?? ''),
        descripcion: String(p.descripcion ?? ''),
        categoria_id: String(p.categoria_id ?? ''),
        unidad_medida: String(p.unidad_medida ?? 'UNIDAD'),
        precio_venta: String(p.precio_venta ?? '0'),
        precio_por_kg: String(p.precio_por_kg ?? ''),
        costo_promedio: String(p.costo_promedio ?? '0'),
        iva_porcentaje: String(p.iva_porcentaje ?? '10'),
        controla_stock: Boolean(p.controla_stock),
        venta_por_kilo: Boolean(p.venta_por_kilo),
        activo: Boolean(p.activo ?? true),
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...formData,
        categoria_id: formData.categoria_id ? parseInt(formData.categoria_id) : undefined,
        precio_venta: parseInt(formData.precio_venta) || 0,
        precio_por_kg: formData.precio_por_kg ? parseInt(formData.precio_por_kg) : undefined,
        costo_promedio: parseInt(formData.costo_promedio) || 0,
        iva_porcentaje: parseFloat(formData.iva_porcentaje) || 10,
      };

      if (isEditing) {
        await productosApi.actualizar(parseInt(id!), payload as unknown as Record<string, unknown>);
      } else {
        await productosApi.crear(payload as unknown as Record<string, unknown>);
      }
      navigate('/productos');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Cargando...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/productos')}>← Volver</Button>
        <h1 className="text-2xl font-bold text-gray-900">{isEditing ? 'Editar producto' : 'Nuevo producto'}</h1>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <form onSubmit={handleSubmit}>
        <Card title="Información del producto">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Código interno" value={formData.codigo} onChange={(e) => handleChange('codigo', e.target.value)} placeholder="Ej: ALM001" />
              <Input label="Código de barra" value={formData.codigo_barra} onChange={(e) => handleChange('codigo_barra', e.target.value)} placeholder="EAN/UPC" />
            </div>
            <Input label="Nombre del producto" value={formData.nombre} onChange={(e) => handleChange('nombre', e.target.value)} required placeholder="Nombre del producto" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                rows={3}
                value={formData.descripcion}
                onChange={(e) => handleChange('descripcion', e.target.value)}
                placeholder="Descripción opcional"
              />
            </div>
            <Select
              label="Categoría"
              value={formData.categoria_id}
              onChange={(e) => handleChange('categoria_id', e.target.value)}
              options={[
                { value: '', label: 'Sin categoría' },
                ...categorias.map((c) => ({ value: c.id, label: c.nombre })),
              ]}
            />
            <Select
              label="Unidad de medida"
              value={formData.unidad_medida}
              onChange={(e) => handleChange('unidad_medida', e.target.value)}
              options={[
                { value: 'UNIDAD', label: 'Unidad' },
                { value: 'KG', label: 'Kilogramo' },
                { value: 'LITRO', label: 'Litro' },
                { value: 'PORCION', label: 'Porción' },
                { value: 'DOCENA', label: 'Docena' },
              ]}
            />
          </div>
        </Card>

        <Card title="Precios" className="mt-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Precio de venta (Gs.)" type="number" min="0" value={formData.precio_venta} onChange={(e) => handleChange('precio_venta', e.target.value)} required />
              <Input label="Precio por kilo (Gs.)" type="number" min="0" value={formData.precio_por_kg} onChange={(e) => handleChange('precio_por_kg', e.target.value)} helpText="Dejar en blanco si no aplica" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Costo promedio (Gs.)" type="number" min="0" value={formData.costo_promedio} onChange={(e) => handleChange('costo_promedio', e.target.value)} />
              <Select
                label="IVA"
                value={formData.iva_porcentaje}
                onChange={(e) => handleChange('iva_porcentaje', e.target.value)}
                options={[
                  { value: '0', label: 'Exento (0%)' },
                  { value: '5', label: '5%' },
                  { value: '10', label: '10%' },
                ]}
              />
            </div>
          </div>
        </Card>

        <Card title="Configuración" className="mt-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="controla_stock" checked={formData.controla_stock} onChange={(e) => handleChange('controla_stock', e.target.checked)} className="h-4 w-4 rounded" />
              <label htmlFor="controla_stock" className="text-sm text-gray-700">Controla stock</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="venta_por_kilo" checked={formData.venta_por_kilo} onChange={(e) => handleChange('venta_por_kilo', e.target.checked)} className="h-4 w-4 rounded" />
              <label htmlFor="venta_por_kilo" className="text-sm text-gray-700">Venta por kilo</label>
            </div>
            {isEditing && (
              <div className="flex items-center gap-3">
                <input type="checkbox" id="activo" checked={formData.activo} onChange={(e) => handleChange('activo', e.target.checked)} className="h-4 w-4 rounded" />
                <label htmlFor="activo" className="text-sm text-gray-700">Producto activo</label>
              </div>
            )}
          </div>
        </Card>

        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="secondary" type="button" onClick={() => navigate('/productos')}>Cancelar</Button>
          <Button type="submit" loading={saving}>{isEditing ? 'Guardar cambios' : 'Crear producto'}</Button>
        </div>
      </form>
    </div>
  );
}
