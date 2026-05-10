import React, { useState, useEffect } from 'react';
import { configuracionesApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Alert } from '../../components/UI/Alert';
import { Card } from '../../components/UI/Card';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { getErrorMessage } from '../../lib/utils';

interface ConfigItem {
  id: number;
  clave: string;
  valor: string;
  descripcion: string | null;
}

export function ConfiguracionPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadConfigs(); }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const res = await configuracionesApi.listar();
      const list = res.data.list as ConfigItem[];
      setConfigs(list);
      setValues(list.reduce((acc: Record<string, string>, c) => ({ ...acc, [c.clave]: c.valor }), {}));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (clave: string) => {
    setSaving(clave);
    try {
      await configuracionesApi.actualizar(clave, values[clave]);
      setSuccess(`Configuración "${clave}" actualizada`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <PageLoader />;

  // Group by prefix
  const grupos: Record<string, ConfigItem[]> = {};
  configs.forEach((c) => {
    const grupo = c.clave.split('_')[0];
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push(c);
  });

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {Object.entries(grupos).map(([grupo, items]) => (
        <Card key={grupo} title={grupo.charAt(0) + grupo.slice(1).toLowerCase()}>
          <div className="space-y-4">
            {items.map((config) => (
              <div key={config.clave} className="flex items-end gap-3">
                <div className="flex-1">
                  <Input
                    label={config.descripcion || config.clave}
                    value={values[config.clave] ?? config.valor}
                    onChange={(e) => setValues((prev) => ({ ...prev, [config.clave]: e.target.value }))}
                    helpText={`Clave: ${config.clave}`}
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleSave(config.clave)}
                  loading={saving === config.clave}
                  disabled={values[config.clave] === config.valor}
                >
                  Guardar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
