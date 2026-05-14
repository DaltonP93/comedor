import { useState, useEffect } from 'react';
import { facturasClienteApi } from '../api/portal';

const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  EMITIDA_LOCAL: { label: 'Emitida', color: 'bg-blue-100 text-blue-800' },
  APROBADA_SIFEN: { label: 'Aprobada', color: 'bg-green-100 text-green-800' },
  ANULADA: { label: 'Anulada', color: 'bg-red-100 text-red-800' },
  BORRADOR: { label: 'Borrador', color: 'bg-gray-100 text-gray-600' },
};

function formatGs(val: string | number) {
  return `Gs. ${Number(val).toLocaleString('es-PY', { maximumFractionDigits: 0 })}`;
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function MisFacturasPage() {
  const [facturas, setFacturas] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [descargando, setDescargando] = useState<number | null>(null);

  useEffect(() => {
    facturasClienteApi.listar()
      .then(res => setFacturas(res.data.data as Array<Record<string, unknown>>))
      .catch(() => setError('No se pudieron cargar las facturas.'))
      .finally(() => setLoading(false));
  }, []);

  const descargarPDF = async (id: number) => {
    setDescargando(id);
    try {
      const res = await facturasClienteApi.descargarPdf(id);
      const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo descargar el PDF.');
    } finally {
      setDescargando(null);
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
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Mis Facturas</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {facturas.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">🧾</p>
          <p>No tenés facturas aún.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {facturas.map(f => {
            const estado = ESTADO_LABEL[String(f.estado)] || { label: String(f.estado), color: 'bg-gray-100 text-gray-600' };
            return (
              <div key={Number(f.id)} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {String(f.numero || f.numero_formateado || `#${f.id}`)}
                    </p>
                    <p className="text-xs text-gray-500">{f.fecha ? formatFecha(String(f.fecha)) : formatFecha(String(f.creado_en || ''))}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estado.color}`}>
                    {estado.label}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-lg font-bold text-teal-700">{formatGs(String(f.total || 0))}</p>
                  {f.estado !== 'ANULADA' && (
                    <button
                      onClick={() => descargarPDF(Number(f.id))}
                      disabled={descargando === Number(f.id)}
                      className="text-sm text-teal-600 hover:text-teal-700 font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                      {descargando === Number(f.id) ? 'Descargando...' : '⬇ Descargar PDF'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
