import React from 'react';
import { ModuleTilesGrid } from '../../components/dashboard/ModuleTilesGrid';

export function PortalModulosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Portal</h1>
        <p className="text-sm text-gray-500">
          Módulos del sistema habilitados para su usuario. La gestión del menú por fecha está en «Menús del día».
        </p>
      </div>
      <ModuleTilesGrid title="Módulos del sistema" />
    </div>
  );
}
