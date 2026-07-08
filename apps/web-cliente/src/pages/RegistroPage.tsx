import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registroApi } from '../api/portal';

function getErrorMessage(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
  ) {
    return String((err as { response: { data: { message: string } } }).response.data.message);
  }
  return 'Ocurrió un error inesperado. Intentá de nuevo.';
}

export default function RegistroPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmar_password: '',
    ci: '',
    telefono: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const validate = (): string => {
    if (!form.nombre.trim()) return 'El nombre es obligatorio.';
    if (!form.email.trim()) return 'El correo electrónico es obligatorio.';
    if (!form.ci.trim()) return 'La cédula de identidad es obligatoria.';
    if (form.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
    if (form.password !== form.confirmar_password) return 'Las contraseñas no coinciden.';
    return '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await registroApi.registrar({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        ci: form.ci.trim(),
        telefono: form.telefono.trim() || undefined,
      });
      navigate('/login', {
        state: { mensaje: 'Cuenta creada exitosamente. Ya podés iniciar sesión.' },
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🍽️</div>
          <h1 className="text-3xl font-bold text-white">Comedor</h1>
          <p className="text-primary-200 mt-1">Portal del Cliente</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-5">Crear cuenta</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre */}
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                id="nombre"
                type="text"
                value={form.nombre}
                onChange={handleChange('nombre')}
                placeholder="Juan Pérez"
                required
                autoComplete="name"
                className="input-field"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                className="input-field"
              />
            </div>

            {/* CI */}
            <div>
              <label htmlFor="ci" className="block text-sm font-medium text-gray-700 mb-1">
                Cédula de identidad <span className="text-red-500">*</span>
              </label>
              <input
                id="ci"
                type="text"
                value={form.ci}
                onChange={handleChange('ci')}
                placeholder="1234567"
                required
                className="input-field"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                id="telefono"
                type="tel"
                value={form.telefono}
                onChange={handleChange('telefono')}
                placeholder="0981 123 456"
                autoComplete="tel"
                className="input-field"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={handleChange('password')}
                placeholder="Mínimo 6 caracteres"
                required
                autoComplete="new-password"
                className="input-field"
              />
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label
                htmlFor="confirmar_password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirmar contraseña <span className="text-red-500">*</span>
              </label>
              <input
                id="confirmar_password"
                type="password"
                value={form.confirmar_password}
                onChange={handleChange('confirmar_password')}
                placeholder="Repetí tu contraseña"
                required
                autoComplete="new-password"
                className="input-field"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando cuenta...
                </span>
              ) : (
                'Crear cuenta'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
