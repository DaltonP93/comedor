import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { recuperarPasswordApi } from '../api/portal';

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await recuperarPasswordApi.solicitar(email.trim());
    } catch (err: unknown) {
      // Si el endpoint no existe (404) u otro error, igual mostramos el mensaje neutro
      const status =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status;
      if (status === 404) {
        // Endpoint no implementado aún — mostramos mensaje informativo igual
      }
      // No se expone nada diferente para evitar enumeración de usuarios
    } finally {
      setLoading(false);
      setEnviado(true);
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
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Recuperar contraseña</h2>

          {!enviado ? (
            <>
              <p className="text-sm text-gray-500 mb-5">
                Ingresá tu correo electrónico y te enviaremos instrucciones para restablecer tu
                contraseña.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    autoComplete="email"
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
                      Enviando...
                    </span>
                  ) : (
                    'Enviar instrucciones'
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="text-5xl">✉️</div>
              <p className="text-gray-700 font-medium">
                Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu
                contraseña.
              </p>
              <p className="text-sm text-gray-400">
                Revisá también tu carpeta de spam.
              </p>
            </div>
          )}

          <div className="mt-5 text-center">
            <Link
              to="/login"
              className="text-sm text-primary-600 font-medium hover:underline"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
