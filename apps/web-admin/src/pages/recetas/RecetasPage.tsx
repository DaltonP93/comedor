import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { recetasApi } from '../../api/endpoints';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Badge } from '../../components/UI/Badge';
import { Alert } from '../../components/UI/Alert';
import { Modal } from '../../components/UI/Modal';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { getErrorMessage } from '../../lib/utils';

interface Receta {
  id: number;
  nombre: string;
  activo: boolean;
  producto: { id: number; nombre: string; unidad_medida: string };
  _count: { items: number };
}

export function RecetasPage() {
  const navigate = useNavigate();
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [eliminarId, setEliminarId] = useState<number | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const loadRecetas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await recetasApi.listar({ limit: '200' });
      setRecetas(res.data.data as Receta[]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecetas();
  }, [loadRecetas]);

  const recetasFiltradas = recetas.filter((r) => {
    if (!buscar.trim()) return true;
    const q = buscar.toLowerCase();
    return (
      r.nombre.toLowerCase().includes(q) ||
      r.producto.nombre.toLowerCase().includes(q)
    );
  });

  const handleEliminar = async () => {
    if (!eliminarId) return;
    setEliminando(true);
    try {
      await recetasApi.eliminar(eliminarId);
      setEliminarId(null);
      loadRecetas();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setEliminando(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
          <p className="text-gray-500 text-sm">Ingredientes y proporciones por producto</p>
        </div>
        <Button onClick={() => navigate('/recetas/nueva')}>
          + Nueva receta
        </Button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="w-80">
          <Input
            placeholder="Buscar por producto o nombre de receta..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre receta</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ingredientes</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {recetasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                  {buscar ? 'Sin resultados para la búsqueda' : 'No hay recetas registradas'}
                </td>
              </tr>
            ) : (
              recetasFiltradas.map((receta) => (
                <tr key={receta.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{receta.producto.nombre}</p>
                    <p className="text-xs text-gray-500">{receta.producto.unidad_medida}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{receta.nombre}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                      {receta._count.items}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {receta.activo ? (
                      <Badge variant="success" size="sm">Activa</Badge>
                    ) : (
                      <Badge variant="default" size="sm">Inactiva</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/recetas/${receta.id}/editar`)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setEliminarId(receta.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmar eliminación */}
      {eliminarId && (
        <Modal
          isOpen={true}
          title="Eliminar receta"
          onClose={() => setEliminarId(null)}
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              ¿Está seguro que desea eliminar esta receta? Esta acción desactivará la receta y ya no se descontarán ingredientes automáticamente al vender el producto.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEliminarId(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleEliminar} loading={eliminando}>
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
