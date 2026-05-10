interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
};

export function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variantClasses[variant]} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-sm'
      }`}
    >
      {children}
    </span>
  );
}

// Helper to map status to badge variant
export function estadoBadge(estado: string) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    ACTIVO: { label: 'Activo', variant: 'success' },
    INACTIVO: { label: 'Inactivo', variant: 'danger' },
    PENDIENTE: { label: 'Pendiente', variant: 'warning' },
    CONFIRMADA: { label: 'Confirmada', variant: 'info' },
    CANCELADA: { label: 'Cancelada', variant: 'danger' },
    COMPLETADA: { label: 'Completada', variant: 'success' },
    ANULADA: { label: 'Anulada', variant: 'danger' },
    PUBLICADO: { label: 'Publicado', variant: 'success' },
    BORRADOR: { label: 'Borrador', variant: 'default' },
    CERRADO: { label: 'Cerrado', variant: 'danger' },
    ACTIVA: { label: 'Activa', variant: 'success' },
    BLOQUEADA: { label: 'Bloqueada', variant: 'danger' },
    EN_COCINA: { label: 'En cocina', variant: 'warning' },
    PREPARADA: { label: 'Preparada', variant: 'info' },
    ENTREGADA: { label: 'Entregada', variant: 'success' },
    ABIERTA: { label: 'Abierta', variant: 'success' },
    CERRADA: { label: 'Cerrada', variant: 'default' },
  };
  return map[estado] || { label: estado, variant: 'default' as const };
}
