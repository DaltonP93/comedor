import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { navItems } from './navItems';

const navBarClass =
  'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-xs font-medium uppercase tracking-wide text-white/95 transition-colors hover:bg-white/10 sm:px-3 sm:text-sm';

export function TopNav() {
  const { hasPermiso, usuario, logout } = useAuth();
  const navigate = useNavigate();

  const visibleItems = navItems.filter((item) => !item.permiso || hasPermiso(item.permiso));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="shrink-0 bg-[#0c3c6e] text-white shadow-md">
      <div className="flex h-14 items-stretch gap-2 px-3 sm:px-4">
        <NavLink
          to="/dashboard"
          className="flex shrink-0 items-center gap-2 border-r border-white/15 pr-3 sm:pr-4"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="hidden font-bold uppercase tracking-tight text-white sm:inline sm:text-sm">
            Sistema Comedor
          </span>
        </NavLink>

        <nav
          className="flex min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Navegación principal"
        >
          <div className="flex h-full items-center gap-0.5 py-1">
            {visibleItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/dashboard' || item.path === '/menus/portal'}
                className={({ isActive }) =>
                  `${navBarClass} shrink-0 ${isActive ? 'bg-white/20 text-white' : 'text-white/90'}`
                }
              >
                <span className="opacity-90 [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5">{item.icon}</span>
                <span className="max-w-[9rem] truncate sm:max-w-none">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-1 border-l border-white/15 pl-2 sm:gap-2 sm:pl-3">
          <div className="hidden max-w-[140px] text-right text-xs leading-tight text-white/90 md:block lg:max-w-[200px]">
            <p className="truncate font-semibold">
              {usuario?.nombre} {usuario?.apellido}
            </p>
            <p className="truncate text-[10px] text-white/60">{usuario?.sucursal?.nombre ?? usuario?.rol}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1 rounded-md px-2 py-2 text-xs font-semibold uppercase tracking-wide text-white/95 transition-colors hover:bg-white/10 sm:gap-1.5 sm:px-3 sm:text-sm"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
