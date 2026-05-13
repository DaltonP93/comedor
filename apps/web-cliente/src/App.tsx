import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import MenuPage from './pages/MenuPage';
import ReservarPage from './pages/ReservarPage';
import MisReservasPage from './pages/MisReservasPage';
import MiLibretaPage from './pages/MiLibretaPage';
import PagarPage from './pages/PagarPage';

function LayoutRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/menu" replace /> : <LoginPage />}
      />

      <Route
        path="/menu"
        element={<LayoutRoute><MenuPage /></LayoutRoute>}
      />
      <Route
        path="/reservar"
        element={<LayoutRoute><ReservarPage /></LayoutRoute>}
      />
      <Route
        path="/mis-reservas"
        element={<LayoutRoute><MisReservasPage /></LayoutRoute>}
      />
      <Route
        path="/mi-libreta"
        element={<LayoutRoute><MiLibretaPage /></LayoutRoute>}
      />
      <Route
        path="/pagar"
        element={<LayoutRoute><PagarPage /></LayoutRoute>}
      />

      <Route path="/" element={<Navigate to="/menu" replace />} />
      <Route path="*" element={<Navigate to="/menu" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
