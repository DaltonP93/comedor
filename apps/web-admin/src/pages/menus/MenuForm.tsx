import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { menusApi, productosApi, sucursalesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { PageBack } from '../../components/UI/PageBack';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Alert } from '../../components/UI/Alert';
import { Card } from '../../components/UI/Card';
import { getErrorMessage, hoyISO } from '../../lib/utils';

interface Producto { id: number; nombre: string; }
interface Sucursal { id: number; nombre: string; }
interface MenuItem {
  producto_id?: number;
  descripcion: string;
  tipo: string;
}

const TIPOS_ITEM = ['ENTRADA', 'PRINCIPAL', 'GUARNICION', 'POSTRE', 'BEBIDA', 'OTRO'];

export function MenuForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    sucursal_id: '1',
    fecha: hoyISO(),
    titulo: '',
    descripcion: '',
    precio: '0',
    precio_convenio: '',
    precio_libreta: '',
    cupo_total: '',
    hora_limite_reserva: '',
  });
  const [items, setItems] = useState<MenuItem[]>([{ descripcion: '', tipo: 'PRINCIPAL' }]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      productosApi.listar({ activo: 'true', limit: '100' }),
      sucursalesApi.listar({ activo: 'true' }),
    ]).then(([prodsRes, sucsRes]) => {
      setProductos(prodsRes.data.data as Producto[]);
      setSucursales(sucsRes.data.data as Sucursal[]);
    });

    if (isEditing) loadMenu();
  }, [id]);

  const loadMenu = async () => {
    try {
      const res = await menusApi.obtener(parseInt(id!));
      const m = res.data.data as Record<string, unknown>;
      setFormData({
        sucursal_id: String(m.sucursal_id ?? '1'),
        fecha: String(m.fecha ?? hoyISO()).split('T')[0],
        titulo: String(m.titulo ?? ''),
        descripcion: String(m.descripcion ?? ''),
        precio: String(m.precio ?? '0'),
        precio_convenio: String(m.precio_convenio ?? ''),
        precio_libreta: String(m.precio_libreta ?? ''),
        cupo_total: String(m.cupo_total ?? ''),
        hora_limite_reserva: m.hora_limite_reserva ? String(m.hora_limite_reserva).substring(11, 16) : '',
      });
      const menuItems = (m.items as Array<Record<string, unknown>>) || [];
      setItems(menuItems.map((i) => ({
        producto_id: i.producto_id ? Number(i.producto_id) : undefined,
        descripcion: String(i.descripcion ?? ''),
        tipo: String(i.tipo ?? 'PRINCIPAL'),
      })));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleItemChange = (idx: number, field: keyof MenuItem, value: string | number | undefined) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems((prev) => [...prev, { descripcion: '', tipo: 'PRINCIPAL' }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let horaLimite: string | undefined;
      if (formData.hora_limite_reserva) {
        horaLimite = `${formData.fecha}T${formData.hora_limite_reserva}:00`;
      }

      const payload = {
        sucursal_id: parseInt(formData.sucursal_id),
        fecha: formData.fecha,
        titulo: formData.titulo,
        descripcion: formData.descripcion || undefined,
        precio: parseInt(formData.precio) || 0,
        precio_convenio: formData.precio_convenio ? parseInt(formData.precio_convenio) : undefined,
        precio_libreta: formData.precio_libreta ? parseInt(formData.precio_libreta) : undefined,
        cupo_total: formData.cupo_total ? parseInt(formData.cupo_total) : undefined,
        hora_limite_reserva: horaLimite,
        items: items.filter((item) => item.descripcion.trim()),
      };

      if (isEditing) {
        await menusApi.actualizar(parseInt(id!), payload as unknown as Record<string, unknown>);
      } else {
        await menusApi.crear(payload as unknown as Record<string, unknown>);
      }
      navigate('/menus');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageBack to="/menus" />
        <h1 className="text-2xl font-bold text-gray-900">{isEditing ? 'Editar menú' : 'Nuevo menú'}</h1>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <form onSubmit={handleSubmit}>
        <Card title="Información del menú">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Fecha" type="date" value={formData.fecha} onChange={(e) => setFormData((p) => ({ ...p, fecha: e.target.value }))} required />
              <Select
                label="Sucursal"
                value={formData.sucursal_id}
                onChange={(e) => setFormData((p) => ({ ...p, sucursal_id: e.target.value }))}
                options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
              />
            </div>
            <Input label="Título" value={formData.titulo} onChange={(e) => setFormData((p) => ({ ...p, titulo: e.target.value }))} required placeholder="Ej: Menú del día - Miércoles" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" rows={2} value={formData.descripcion} onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción del menú" />
            </div>
          </div>
        </Card>

        <Card title="Precios y cupo" className="mt-4">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Input label="Precio normal (Gs.)" type="number" min="0" value={formData.precio} onChange={(e) => setFormData((p) => ({ ...p, precio: e.target.value }))} required />
              <Input label="Precio convenio (Gs.)" type="number" min="0" value={formData.precio_convenio} onChange={(e) => setFormData((p) => ({ ...p, precio_convenio: e.target.value }))} />
              <Input label="Precio libreta (Gs.)" type="number" min="0" value={formData.precio_libreta} onChange={(e) => setFormData((p) => ({ ...p, precio_libreta: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Cupo total" type="number" min="1" value={formData.cupo_total} onChange={(e) => setFormData((p) => ({ ...p, cupo_total: e.target.value }))} placeholder="Sin límite" />
              <Input label="Hora límite reserva" type="time" value={formData.hora_limite_reserva} onChange={(e) => setFormData((p) => ({ ...p, hora_limite_reserva: e.target.value }))} />
            </div>
          </div>
        </Card>

        <Card title="Componentes del menú" className="mt-4">
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <div className="w-32">
                  <Select
                    value={item.tipo}
                    onChange={(e) => handleItemChange(idx, 'tipo', e.target.value)}
                    options={TIPOS_ITEM.map((t) => ({ value: t, label: t }))}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={item.descripcion}
                    onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                    placeholder="Descripción del componente"
                  />
                </div>
                <div className="w-48">
                  <Select
                    value={item.producto_id ? String(item.producto_id) : ''}
                    onChange={(e) => handleItemChange(idx, 'producto_id', e.target.value ? parseInt(e.target.value) : undefined)}
                    options={[
                      { value: '', label: 'Sin producto' },
                      ...productos.map((p) => ({ value: p.id, label: p.nombre })),
                    ]}
                  />
                </div>
                <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 mt-2">✕</button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addItem}>
              + Agregar componente
            </Button>
          </div>
        </Card>

        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="secondary" type="button" onClick={() => navigate('/menus')}>Cancelar</Button>
          <Button type="submit" loading={saving}>{isEditing ? 'Guardar cambios' : 'Crear menú'}</Button>
        </div>
      </form>
    </div>
  );
}
