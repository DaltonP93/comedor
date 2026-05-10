import React from 'react';
import { Link } from 'react-router-dom';

const reportes = [
  {
    path: '/reportes/ventas',
    title: 'Reporte de Ventas',
    description: 'Resumen de ventas con filtros por fecha, sucursal y tipo',
    icon: '📊',
    color: 'blue',
  },
  {
    path: '/reportes/stock',
    title: 'Reporte de Stock',
    description: 'Inventario actual con valuación de productos',
    icon: '📦',
    color: 'green',
  },
  {
    path: '/reportes/libretas',
    title: 'Cuentas Corrientes',
    description: 'Estado de libretas y deudas por cobrar',
    icon: '📒',
    color: 'yellow',
  },
];

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  green: 'bg-green-50 border-green-200 hover:bg-green-100',
  yellow: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
  red: 'bg-red-50 border-red-200 hover:bg-red-100',
};

export function ReportesDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-gray-500 text-sm">Seleccione un reporte para ver</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportes.map((r) => (
          <Link
            key={r.path}
            to={r.path}
            className={`block p-6 rounded-lg border-2 transition-colors ${colorClasses[r.color]}`}
          >
            <p className="text-3xl mb-3">{r.icon}</p>
            <h3 className="font-semibold text-gray-900 mb-1">{r.title}</h3>
            <p className="text-sm text-gray-600">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
