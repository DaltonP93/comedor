import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';

export function MainLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100">
      <TopNav />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
