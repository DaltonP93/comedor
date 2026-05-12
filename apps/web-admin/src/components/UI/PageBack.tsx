import React from 'react';
import { useNavigate } from 'react-router-dom';

interface PageBackProps {
  /** Ruta absoluta a la que volver (lista padre del submódulo) */
  to: string;
  label?: string;
  className?: string;
}

export function PageBack({ to, label = 'Volver', className = '' }: PageBackProps) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className={`inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 ${className}`}
    >
      <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  );
}
