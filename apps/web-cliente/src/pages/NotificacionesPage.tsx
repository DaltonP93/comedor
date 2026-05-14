import { useState, useEffect } from 'react';
import { notificacionesClienteApi, type PreferenciasNotificaciones } from '../api/portal';

const DEFAULT_PREFS: PreferenciasNotificaciones = {
  canal_whatsapp: false,
  canal_email: true,
  canal_sms: false,
  tipo_menu_publicado: true,
  tipo_reserva_confirmada: true,
  tipo_libreta_vencida: true,
  tipo_pago_confirmado: true,
};

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-teal-600' : 'bg-gray-200'}`}
        role="switch"
        aria-checked={checked}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

export default function NotificacionesPage() {
  const [prefs, setPrefs] = useState<PreferenciasNotificaciones>(DEFAULT_PREFS);
  const [notifs, setNotifs] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      notificacionesClienteApi.obtenerPreferencias().then(r => setPrefs(r.data.data || DEFAULT_PREFS)).catch(() => {}),
      notificacionesClienteApi.listarRecientes().then(r => setNotifs(r.data.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const guardar = async () => {
    setSaving(true);
    setMsg('');
    try {
      await notificacionesClienteApi.guardarPreferencias(prefs);
      setMsg('Preferencias guardadas correctamente.');
    } catch {
      setMsg('No se pudieron guardar las preferencias.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Notificaciones</h1>

      {/* Preferencias */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="font-semibold text-gray-800 text-sm">Canales de notificación</p>
        </div>
        <div className="px-4 divide-y divide-gray-100">
          <Toggle checked={prefs.canal_email} onChange={v => setPrefs(p => ({ ...p, canal_email: v }))} label="Email" description="Recibir notificaciones por correo electrónico" />
          <Toggle checked={prefs.canal_whatsapp} onChange={v => setPrefs(p => ({ ...p, canal_whatsapp: v }))} label="WhatsApp" description="Recibir mensajes de WhatsApp" />
          <Toggle checked={prefs.canal_sms} onChange={v => setPrefs(p => ({ ...p, canal_sms: v }))} label="SMS" description="Recibir mensajes de texto" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="font-semibold text-gray-800 text-sm">Tipos de notificación</p>
        </div>
        <div className="px-4 divide-y divide-gray-100">
          <Toggle checked={prefs.tipo_menu_publicado} onChange={v => setPrefs(p => ({ ...p, tipo_menu_publicado: v }))} label="Menú publicado" description="Cuando se publique el menú del día" />
          <Toggle checked={prefs.tipo_reserva_confirmada} onChange={v => setPrefs(p => ({ ...p, tipo_reserva_confirmada: v }))} label="Reserva confirmada" description="Confirmación de tus reservas" />
          <Toggle checked={prefs.tipo_libreta_vencida} onChange={v => setPrefs(p => ({ ...p, tipo_libreta_vencida: v }))} label="Deuda por vencer" description="Recordatorio cuando tu saldo vence" />
          <Toggle checked={prefs.tipo_pago_confirmado} onChange={v => setPrefs(p => ({ ...p, tipo_pago_confirmado: v }))} label="Pago confirmado" description="Confirmación de pagos realizados" />
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${msg.includes('correctamente') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </div>
      )}

      <button
        onClick={guardar}
        disabled={saving}
        className="w-full py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors"
      >
        {saving ? 'Guardando...' : 'Guardar preferencias'}
      </button>

      {/* Notificaciones recientes */}
      {notifs.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Recientes</h2>
          <div className="space-y-2">
            {notifs.map(n => (
              <div key={Number(n.id)} className={`bg-white rounded-xl shadow-sm border p-4 ${!n.leida ? 'border-teal-200' : 'border-gray-100'}`}>
                <div className="flex justify-between items-start">
                  <p className="text-sm font-medium text-gray-900">{String(n.titulo || n.tipo)}</p>
                  {!n.leida && <span className="w-2 h-2 bg-teal-500 rounded-full mt-1" />}
                </div>
                <p className="text-sm text-gray-600 mt-1">{String(n.mensaje || '')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
