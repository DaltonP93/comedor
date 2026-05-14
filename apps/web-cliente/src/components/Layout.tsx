import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { cliente, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/menu', label: 'Menú', icon: '🍽️' },
    { to: '/mis-reservas', label: 'Reservas', icon: '📋' },
    { to: '/mi-libreta', label: 'Libreta', icon: '📒' },
    { to: '/mis-facturas', label: 'Facturas', icon: '🧾' },
    { to: '/perfil', label: 'Perfil', icon: '👤' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top navigation bar */}
      <header className="bg-primary-700 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            <span className="font-bold text-lg tracking-tight">Comedor</span>
          </div>
          <div className="flex items-center gap-3">
            {cliente && (
              <span className="text-sm text-primary-100 hidden sm:block">
                {cliente.nombre} {cliente.apellido}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-primary-100 hover:text-white text-sm font-medium transition-colors px-2 py-1 rounded hover:bg-primary-600"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {children}
      </main>

      {/* Bottom tab navigation (mobile style) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-10">
        <div className="max-w-lg mx-auto flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-2 px-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-primary-600 border-t-2 border-primary-600'
                    : 'text-gray-500 hover:text-primary-500'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
