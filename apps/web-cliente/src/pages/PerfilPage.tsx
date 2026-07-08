import { useState, useEffect, FormEvent } from 'react';
import { perfilApi, type PerfilData, type ActualizarPerfilPayload } from '../api/portal';

function getErrorMessage(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
  ) {
    return String((err as { response: { data: { message: string } } }).response.data.message);
  }
  return 'Ocurrió un error inesperado.';
}

const ESTADO_LABELS: Record<string, string> = {
  ACTIVO: 'Activo',
  INACTIVO: 'Inactivo',
  SUSPENDIDO: 'Suspendido',
};

const ESTADO_COLORS: Record<string, string> = {
  ACTIVO: 'bg-green-100 text-green-700',
  INACTIVO: 'bg-gray-100 text-gray-600',
  SUSPENDIDO: 'bg-red-100 text-red-700',
};

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState('');

  // Editar datos personales
  const [editando, setEditando] = useState(false);
  const [formPerfil, setFormPerfil] = useState<ActualizarPerfilPayload>({});
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [mensajePerfil, setMensajePerfil] = useState('');
  const [errorEditarPerfil, setErrorEditarPerfil] = useState('');

  // Cambiar contraseña
  const [formPassword, setFormPassword] = useState({
    password_actual: '',
    password_nueva: '',
    confirmar: '',
  });
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [mensajePassword, setMensajePassword] = useState('');
  const [errorPassword, setErrorPassword] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await perfilApi.obtener();
        const data = res.data.data as PerfilData;
        setPerfil(data);
        setFormPerfil({
          nombre: data.nombre,
          apellido: data.apellido ?? '',
          telefono: data.telefono ?? '',
          ruc: data.ruc ?? '',
          razon_social: data.razon_social ?? '',
        });
      } catch (err: unknown) {
        const status =
          err &&
          typeof err === 'object' &&
          'response' in err &&
          (err as { response?: { status?: number } }).response?.status;
        if (status === 404) {
          setErrorPerfil('Funcionalidad próximamente disponible.');
        } else {
          setErrorPerfil('No se pudo cargar el perfil.');
        }
      } finally {
        setLoadingPerfil(false);
      }
    };
    cargar();
  }, []);

  const handleSavePerfil = async (e: FormEvent) => {
    e.preventDefault();
    setErrorEditarPerfil('');
    setMensajePerfil('');
    setGuardandoPerfil(true);
    try {
      const res = await perfilApi.actualizar(formPerfil);
      const data = (res.data as { data: PerfilData }).data;
      setPerfil(data);
      setMensajePerfil('Datos actualizados correctamente.');
      setEditando(false);
    } catch (err: unknown) {
      setErrorEditarPerfil(getErrorMessage(err));
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setErrorPassword('');
    setMensajePassword('');
    if (formPassword.password_nueva.length < 6) {
      setErrorPassword('La contraseña nueva debe tener al menos 6 caracteres.');
      return;
    }
    if (formPassword.password_nueva !== formPassword.confirmar) {
      setErrorPassword('Las contraseñas no coinciden.');
      return;
    }
    setGuardandoPassword(true);
    try {
      await perfilApi.cambiarPassword({
        password_actual: formPassword.password_actual,
        password_nueva: formPassword.password_nueva,
      });
      setMensajePassword('Contraseña actualizada correctamente.');
      setFormPassword({ password_actual: '', password_nueva: '', confirmar: '' });
    } catch (err: unknown) {
      setErrorPassword(getErrorMessage(err));
    } finally {
      setGuardandoPassword(false);
    }
  };

  if (loadingPerfil) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (errorPerfil) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-800">Mi perfil</h1>
        <div className="card p-6 text-center space-y-3">
          <div className="text-4xl">🚧</div>
          <p className="text-gray-500">{errorPerfil}</p>
        </div>
      </div>
    );
  }

  if (!perfil) return null;

  const estadoLabel = ESTADO_LABELS[perfil.estado] ?? perfil.estado;
  const estadoColor = ESTADO_COLORS[perfil.estado] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800">Mi perfil</h1>

      {/* Datos de la cuenta (solo lectura: email, CI) */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Datos de la cuenta</h2>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${estadoColor}`}>
            {estadoLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-400 text-xs mb-0.5">Correo electrónico</p>
            <p className="font-medium text-gray-700 break-all">{perfil.email}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-0.5">Cédula de identidad</p>
            <p className="font-medium text-gray-700">{perfil.ci}</p>
          </div>
        </div>
      </div>

      {/* Datos editables */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">Datos personales</h2>
          {!editando && (
            <button
              onClick={() => setEditando(true)}
              className="text-sm text-primary-600 font-medium hover:underline"
            >
              Editar
            </button>
          )}
        </div>

        {mensajePerfil && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {mensajePerfil}
          </div>
        )}
        {errorEditarPerfil && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorEditarPerfil}
          </div>
        )}

        {!editando ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Nombre</p>
              <p className="font-medium text-gray-700">
                {perfil.nombre} {perfil.apellido}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Teléfono</p>
              <p className="font-medium text-gray-700">{perfil.telefono ?? '—'}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSavePerfil} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={formPerfil.nombre ?? ''}
                onChange={(e) => setFormPerfil((p) => ({ ...p, nombre: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input
                type="text"
                value={formPerfil.apellido ?? ''}
                onChange={(e) => setFormPerfil((p) => ({ ...p, apellido: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                value={formPerfil.telefono ?? ''}
                onChange={(e) => setFormPerfil((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="0981 123 456"
                className="input-field"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  setErrorEditarPerfil('');
                }}
                className="flex-1 py-2 px-4 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoPerfil}
                className="flex-1 btn-primary py-2"
              >
                {guardandoPerfil ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </span>
                ) : (
                  'Guardar'
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Sección fiscal (RUC / empresa) */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">Datos fiscales</h2>
          {!editando && (
            <button
              onClick={() => setEditando(true)}
              className="text-sm text-primary-600 font-medium hover:underline"
            >
              Editar
            </button>
          )}
        </div>
        {!editando ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-0.5">RUC</p>
              <p className="font-medium text-gray-700">{perfil.ruc ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Razón social</p>
              <p className="font-medium text-gray-700">{perfil.razon_social ?? '—'}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSavePerfil} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RUC</label>
              <input
                type="text"
                value={formPerfil.ruc ?? ''}
                onChange={(e) => setFormPerfil((p) => ({ ...p, ruc: e.target.value }))}
                placeholder="80012345-6"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Razón social / Empresa
              </label>
              <input
                type="text"
                value={formPerfil.razon_social ?? ''}
                onChange={(e) => setFormPerfil((p) => ({ ...p, razon_social: e.target.value }))}
                placeholder="Mi Empresa S.A."
                className="input-field"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  setErrorEditarPerfil('');
                }}
                className="flex-1 py-2 px-4 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoPerfil}
                className="flex-1 btn-primary py-2"
              >
                {guardandoPerfil ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </span>
                ) : (
                  'Guardar'
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Cambiar contraseña */}
      <div className="card">
        <h2 className="font-semibold text-gray-700 mb-4">Cambiar contraseña</h2>

        {mensajePassword && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {mensajePassword}
          </div>
        )}
        {errorPassword && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorPassword}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña actual
            </label>
            <input
              type="password"
              value={formPassword.password_actual}
              onChange={(e) =>
                setFormPassword((p) => ({ ...p, password_actual: e.target.value }))
              }
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña nueva
            </label>
            <input
              type="password"
              value={formPassword.password_nueva}
              onChange={(e) =>
                setFormPassword((p) => ({ ...p, password_nueva: e.target.value }))
              }
              placeholder="Mínimo 6 caracteres"
              required
              autoComplete="new-password"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar contraseña nueva
            </label>
            <input
              type="password"
              value={formPassword.confirmar}
              onChange={(e) =>
                setFormPassword((p) => ({ ...p, confirmar: e.target.value }))
              }
              placeholder="Repetí la contraseña"
              required
              autoComplete="new-password"
              className="input-field"
            />
          </div>
          <button
            type="submit"
            disabled={guardandoPassword}
            className="btn-primary w-full py-3 mt-1"
          >
            {guardandoPassword ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Actualizando...
              </span>
            ) : (
              'Cambiar contraseña'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
