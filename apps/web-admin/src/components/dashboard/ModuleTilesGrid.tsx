import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { navItems, menusDelDiaNavItem, type NavItem } from '../Layout/navItems';

const TILE_COLORS = [
  'bg-pink-500',
  'bg-blue-600',
  'bg-orange-500',
  'bg-emerald-500',
  'bg-slate-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-cyan-600',
];

interface ModuleTilesGridProps {
  /** Si se pasa, solo se muestran esas rutas (en ese orden) */
  includePaths?: string[];
  title?: string;
  description?: string;
  className?: string;
}

export function ModuleTilesGrid({ includePaths, title, description, className = '' }: ModuleTilesGridProps) {
  const navigate = useNavigate();
  const { hasPermiso } = useAuth();

  const modulos = useMemo(() => {
    const fromNav = navItems
      .filter((m) => m.path !== '/dashboard' && m.path !== '/menus/portal')
      .filter((m) => !m.permiso || hasPermiso(m.permiso));

    let list = fromNav;
    if ((!includePaths?.length || includePaths.includes('/menus')) && hasPermiso('MENUS:VER') && !list.some((m) => m.path === '/menus')) {
      list = [menusDelDiaNavItem, ...list];
    }

    if (!includePaths?.length) return list;
    return includePaths.map((p) => list.find((m) => m.path === p)).filter((m): m is NavItem => !!m);
  }, [hasPermiso, includePaths]);

  return (
    <div className={className}>
      {title ? (
        <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-gray-500 md:text-left">{title}</h2>
      ) : null}
      {description ? <p className="mb-4 text-center text-sm text-gray-500 md:text-left">{description}</p> : null}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map((m, i) => (
          <button
            key={m.path}
            type="button"
            onClick={() => navigate(m.path)}
            className="group flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-8 text-center shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
          >
            <div
              className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md transition-transform group-hover:scale-105 ${TILE_COLORS[i % TILE_COLORS.length]} [&>svg]:h-7 [&>svg]:w-7`}
            >
              {m.icon}
            </div>
            <span className="text-sm font-bold uppercase leading-snug tracking-wide text-gray-900 group-hover:text-[#0c3c6e]">
              {m.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
