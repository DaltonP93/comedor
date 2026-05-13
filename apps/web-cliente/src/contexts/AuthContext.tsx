import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  permisos: string[];
}

interface AuthContextType {
  cliente: Cliente | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermiso: (_permiso: string) => boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('cliente_token'));
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const savedToken = localStorage.getItem('cliente_token');
    if (!savedToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.get('/auth/me');
      setCliente(response.data.data as Cliente);
      setToken(savedToken);
    } catch {
      localStorage.removeItem('cliente_token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    const { token: newToken, usuario } = response.data.data;
    localStorage.setItem('cliente_token', newToken);
    setToken(newToken);
    setCliente(usuario as Cliente);
  };

  const logout = () => {
    localStorage.removeItem('cliente_token');
    setToken(null);
    setCliente(null);
  };

  // Los clientes siempre tienen acceso a sus propios datos
  const hasPermiso = (_permiso: string): boolean => {
    return !!cliente;
  };

  return (
    <AuthContext.Provider
      value={{
        cliente,
        token,
        loading,
        login,
        logout,
        hasPermiso,
        isAuthenticated: !!cliente,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
