import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clientesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { PageBack } from '../../components/UI/PageBack';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Alert } from '../../components/UI/Alert';
import { Card } from '../../components/UI/Card';
import { getErrorMessage } from '../../lib/utils';

interface ClienteFormData {
  tipo_cliente: string;
  nombre: string;
  razon_social: string;
  documento_tipo: string;
  documento_numero: string;
  ruc: string;
  telefono: string;
  whatsapp: string;
  email: string;
  direccion: string;
  permite_notificaciones: boolean;
  canal_preferido: string;
  estado: string;
  password?: string;
}

const initialData: ClienteFormData = {
  tipo_cliente: 'INDIVIDUAL',
  nombre: '',
  razon_social: '',
  documento_tipo: 'CI',
  documento_numero: '',
  ruc: '',
  telefono: '',
  whatsapp: '',
  email: '',
  direccion: '',
  permite_notificaciones: true,
  canal_preferido: 'WHATSAPP',
  estado: 'ACTIVO',
  password: '',
};

export function ClienteForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [formData, setFormData] = useState<ClienteFormData>(initialData);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEditing) {
      loadCliente();
    }
  }, [id]);

  const loadCliente = async () => {
    setLoading(true);
    try {
      const res = await clientesApi.obtener(parseInt(id!));
      const c = res.data.data as Record<string, unknown>;
      setFormData({
        tipo_cliente: String(c.tipo_cliente ?? 'INDIVIDUAL'),
        nombre: String(c.nombre ?? ''),
        razon_social: String(c.razon_social ?? ''),
        documento_tipo: String(c.documento_tipo ?? 'CI'),
        documento_numero: String(c.documento_numero ?? ''),
        ruc: String(c.ruc ?? ''),
        telefono: String(c.telefono ?? ''),
        whatsapp: String(c.whatsapp ?? ''),
        email: String(c.email ?? ''),
        direccion: String(c.direccion ?? ''),
        permite_notificaciones: Boolean(c.permite_notificaciones ?? true),
        canal_preferido: String(c.canal_preferido ?? 'WHATSAPP'),
        estado: String(c.estado ?? 'ACTIVO'),
        password: '',
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof ClienteFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...formData };
      if (!payload.password) delete payload.password;

      if (isEditing) {
        await clientesApi.actualizar(parseInt(id!), payload as unknown as Record<string, unknown>);
      } else {
        await clientesApi.crear(payload as unknown as Record<string, unknown>);
      }
      navigate('/clientes');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Cargando...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageBack to="/clientes" />
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Editar cliente' : 'Nuevo cliente'}
        </h1>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <form onSubmit={handleSubmit}>
        <Card title="Información básica">
          <div className="space-y-4">
            <Select
              label="Tipo de cliente"
              value={formData.tipo_cliente}
              onChange={(e) => handleChange('tipo_cliente', e.target.value)}
              options={[
                { value: 'INDIVIDUAL', label: 'Individual / Particular' },
                { value: 'EMPRESA', label: 'Empresa' },
              ]}
            />
            <Input
              label="Nombre / Razón social"
              value={formData.nombre}
              onChange={(e) => handleChange('nombre', e.target.value)}
              required
              placeholder="Ingrese el nombre"
            />
            {formData.tipo_cliente === 'EMPRESA' && (
              <Input
                label="Razón social completa"
                value={formData.razon_social}
                onChange={(e) => handleChange('razon_social', e.target.value)}
                placeholder="Razón social"
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Tipo documento"
                value={formData.documento_tipo}
                onChange={(e) => handleChange('documento_tipo', e.target.value)}
                options={[
                  { value: 'CI', label: 'Cédula de Identidad' },
                  { value: 'RUC', label: 'RUC' },
                  { value: 'PASAPORTE', label: 'Pasaporte' },
                  { value: 'DNI', label: 'DNI' },
                ]}
              />
              <Input
                label="Número de documento"
                value={formData.documento_numero}
                onChange={(e) => handleChange('documento_numero', e.target.value)}
                placeholder="Ej: 1234567"
              />
            </div>
            {formData.tipo_cliente === 'EMPRESA' && (
              <Input
                label="RUC"
                value={formData.ruc}
                onChange={(e) => handleChange('ruc', e.target.value)}
                placeholder="Ej: 80012345-6"
              />
            )}
          </div>
        </Card>

        <Card title="Contacto" className="mt-4">
          <div className="space-y-4">
            <Input
              label="Teléfono"
              value={formData.telefono}
              onChange={(e) => handleChange('telefono', e.target.value)}
              placeholder="Ej: 0981-111-222"
            />
            <Input
              label="WhatsApp"
              value={formData.whatsapp}
              onChange={(e) => handleChange('whatsapp', e.target.value)}
              placeholder="Ej: 0981-111-222"
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="correo@ejemplo.com"
            />
            <Input
              label="Dirección"
              value={formData.direccion}
              onChange={(e) => handleChange('direccion', e.target.value)}
              placeholder="Dirección completa"
            />
          </div>
        </Card>

        <Card title="Portal de Cliente" className="mt-4">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Credenciales para que el cliente ingrese a su portal.</p>
            <Input
              label="Contraseña del portal"
              type="password"
              value={formData.password || ''}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder={isEditing ? 'Dejar en blanco para mantener la actual' : 'Ingrese una contraseña'}
              helpText="El cliente usará su Email o Documento junto con esta contraseña."
            />
          </div>
        </Card>

        <Card title="Notificaciones y estado" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="notificaciones"
                checked={formData.permite_notificaciones}
                onChange={(e) => handleChange('permite_notificaciones', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <label htmlFor="notificaciones" className="text-sm text-gray-700">
                Permite notificaciones
              </label>
            </div>
            <Select
              label="Canal preferido"
              value={formData.canal_preferido}
              onChange={(e) => handleChange('canal_preferido', e.target.value)}
              options={[
                { value: 'WHATSAPP', label: 'WhatsApp' },
                { value: 'EMAIL', label: 'Email' },
                { value: 'SMS', label: 'SMS' },
              ]}
            />
            {isEditing && (
              <Select
                label="Estado"
                value={formData.estado}
                onChange={(e) => handleChange('estado', e.target.value)}
                options={[
                  { value: 'ACTIVO', label: 'Activo' },
                  { value: 'INACTIVO', label: 'Inactivo' },
                  { value: 'BLOQUEADO', label: 'Bloqueado' },
                ]}
              />
            )}
          </div>
        </Card>

        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="secondary" type="button" onClick={() => navigate('/clientes')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isEditing ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </div>
      </form>
    </div>
  );
}
