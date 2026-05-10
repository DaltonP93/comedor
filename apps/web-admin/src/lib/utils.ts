// Format currency in Guaraníes
export function formatGs(amount: number | bigint | string): string {
  const num = typeof amount === 'bigint' ? Number(amount) : Number(amount);
  if (isNaN(num)) return 'Gs. 0';
  return `Gs. ${num.toLocaleString('es-PY', { maximumFractionDigits: 0 })}`;
}

// Format date to Paraguay locale
export function formatFecha(date: string | Date | null | undefined): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

// Format datetime
export function formatFechaHora(date: string | Date | null | undefined): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

// Get today's date as YYYY-MM-DD
export function hoyISO(): string {
  return new Date().toISOString().split('T')[0];
}

// Extract error message from API error
export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { message?: string } } };
    return axiosError.response?.data?.message || 'Error al procesar la solicitud';
  }
  if (error instanceof Error) return error.message;
  return 'Error desconocido';
}
