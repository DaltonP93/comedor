import React, { useState, useEffect } from 'react';
import { configuracionesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Alert } from '../../components/UI/Alert';
import { Card } from '../../components/UI/Card';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { getErrorMessage } from '../../lib/utils';

// Claves fiscales que se gestionan en esta pantalla
const CAMPOS_FISCALES = [
  { clave: 'RUC_EMISOR', label: 'RUC emisor', placeholder: 'Ej: 80012345-6' },
  { clave: 'RAZON_SOCIAL', label: 'Razón social', placeholder: 'Ej: COMEDOR S.R.L.' },
  { clave: 'NOMBRE_FANTASIA', label: 'Nombre de fantasía', placeholder: 'Ej: Comedor Central' },
  { clave: 'DIRECCION_FISCAL', label: 'Dirección fiscal', placeholder: 'Ej: Avda. Mariscal López 123' },
  { clave: 'TIMBRADO', label: 'Timbrado', placeholder: 'Ej: 12345678' },
  { clave: 'FACTURA_ESTABLECIMIENTO', label: 'Establecimiento (3 dígitos)', placeholder: 'Ej: 001' },
  { clave: 'FACTURA_PUNTO_EXPEDICION', label: 'Punto de expedición (3 dígitos)', placeholder: 'Ej: 001' },
  { clave: 'SIFEN_URL', label: 'URL proveedor SIFEN', placeholder: 'Ej: https://api.sifen.com.py/v1' },
  { clave: 'SIFEN_TOKEN', label: 'Token SIFEN', placeholder: 'Token de autenticación SIFEN' },
];

export default function ConfiguracionTributaria() {
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [sifenHabilitado, setSifenHabilitado] = useState(false);
  const [guardandoSifen, setGuardandoSifen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await configuracionesApi.listar();
      const map = res.data.data as Record<string, { valor: string }>;
      const vals: Record<string, string> = {};
      for (const campo of CAMPOS_FISCALES) {
        vals[campo.clave] = map[campo.clave]?.valor ?? '';
      }
      vals['SIFEN_HABILITADO'] = map['SIFEN_HABILITADO']?.valor ?? 'false';
      setValues(vals);
      setSifenHabilitado(map['SIFEN_HABILITADO']?.valor === 'true');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (clave: string) => {
    setSaving(clave);
    setError('');
    try {
      await configuracionesApi.actualizar(clave, values[clave] ?? '');
      setSuccess(`"${clave}" guardado correctamente`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const handleToggleSifen = async () => {
    setGuardandoSifen(true);
    setError('');
    const nuevoValor = sifenHabilitado ? 'false' : 'true';
    try {
      await configuracionesApi.actualizar('SIFEN_HABILITADO', nuevoValor);
      setSifenHabilitado(!sifenHabilitado);
      setValues((prev) => ({ ...prev, SIFEN_HABILITADO: nuevoValor }));
      setSuccess(
        nuevoValor === 'true'
          ? 'Integración SIFEN habilitada'
          : 'Integración SIFEN deshabilitada'
      );
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGuardandoSifen(false);
    }
  };

  if (loading) return <PageLoader />;

  const camposBasicos = CAMPOS_FISCALES.filter(
    (c) => !c.clave.startsWith('SIFEN_')
  );
  const camposSifen = CAMPOS_FISCALES.filter((c) => c.clave.startsWith('SIFEN_'));

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Configuración Tributaria</h1>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Datos fiscales */}
      <Card title="Datos del emisor">
        <div className="space-y-4">
          {camposBasicos.map((campo) => (
            <div key={campo.clave} className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  label={campo.label}
                  value={values[campo.clave] ?? ''}
                  placeholder={campo.placeholder}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [campo.clave]: e.target.value }))
                  }
                  helpText={`Clave: ${campo.clave}`}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleSave(campo.clave)}
                loading={saving === campo.clave}
              >
                Guardar
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Integración SIFEN */}
      <Card title="Integración SIFEN (Factura Electrónica)">
        <div className="space-y-4">
          {/* Toggle SIFEN */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-800">Facturación electrónica SIFEN</p>
              <p className="text-xs text-gray-500">
                Al habilitar, las facturas emitidas se enviarán automáticamente a SIFEN/DNIT
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleSifen}
              disabled={guardandoSifen}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                sifenHabilitado ? 'bg-blue-600' : 'bg-gray-300'
              } ${guardandoSifen ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label="Alternar SIFEN"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  sifenHabilitado ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Campos SIFEN */}
          {camposSifen.map((campo) => (
            <div key={campo.clave} className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  label={campo.label}
                  value={values[campo.clave] ?? ''}
                  placeholder={campo.placeholder}
                  type={campo.clave === 'SIFEN_TOKEN' ? 'password' : 'text'}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [campo.clave]: e.target.value }))
                  }
                  helpText={`Clave: ${campo.clave}`}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleSave(campo.clave)}
                loading={saving === campo.clave}
              >
                Guardar
              </Button>
            </div>
          ))}

          {!sifenHabilitado && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
              La integración SIFEN está deshabilitada. Las facturas se emitirán en modo local
              sin envío a DNIT.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
