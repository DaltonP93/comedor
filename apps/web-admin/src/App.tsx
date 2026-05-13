import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MainLayout } from './components/Layout/MainLayout';
import { PageLoader } from './components/UI/LoadingSpinner';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClientesPage } from './pages/clientes/ClientesPage';
import { ClienteForm } from './pages/clientes/ClienteForm';
import { ClienteDetalle } from './pages/clientes/ClienteDetalle';
import { ProductosPage } from './pages/productos/ProductosPage';
import { ProductoForm } from './pages/productos/ProductoForm';
import { MenusPage } from './pages/menus/MenusPage';
import { MenuForm } from './pages/menus/MenuForm';
import { MenuDetalle } from './pages/menus/MenuDetalle';
import { PortalModulosPage } from './pages/menus/PortalModulosPage';
import { IntegracionesPage } from './pages/integraciones/IntegracionesPage';
import { ReservasPage } from './pages/reservas/ReservasPage';
import { ReservaDetalle } from './pages/reservas/ReservaDetalle';
import { VentasPage } from './pages/ventas/VentasPage';
import { NuevaVenta } from './pages/ventas/NuevaVenta';
import { VentaDetalle } from './pages/ventas/VentaDetalle';
import { LibretasPage } from './pages/libretas/LibretasPage';
import { LibretaDetalle } from './pages/libretas/LibretaDetalle';
import { StockPage } from './pages/stock/StockPage';
import { EntradaMercaderia } from './pages/stock/EntradaMercaderia';
import { KardexPage } from './pages/stock/KardexPage';
import { CocinaPage } from './pages/cocina/CocinaPage';
import { ReportesDashboard } from './pages/reportes/ReportesDashboard';
import { ReporteVentas } from './pages/reportes/ReporteVentas';
import { ReporteStock } from './pages/reportes/ReporteStock';
import { ReporteLibreta } from './pages/reportes/ReporteLibreta';
import ReportePrediccion from './pages/reportes/ReportePrediccion';
import ReporteRentabilidad from './pages/reportes/ReporteRentabilidad';
import ReporteDesperdicio from './pages/reportes/ReporteDesperdicio';
import { ConfiguracionPage } from './pages/configuracion/ConfiguracionPage';
import { UsuariosPage } from './pages/usuarios/UsuariosPage';
import { AuditoriaPage } from './pages/auditoria/AuditoriaPage';
import { RecetasPage } from './pages/recetas/RecetasPage';
import { RecetaForm } from './pages/recetas/RecetaForm';
import EmpresasPage from './pages/empresas/EmpresasPage';
import EmpresaDetalle from './pages/empresas/EmpresaDetalle';
import NotificacionesPage from './pages/notificaciones/NotificacionesPage';
import ConciliacionPage from './pages/pagos/ConciliacionPage';
import PagosManualesPage from './pages/pagos/PagosManualesPage';
import FacturasPage from './pages/facturas/FacturasPage';
import ConfiguracionTributaria from './pages/configuracion/ConfiguracionTributaria';

// New pages
import { ProveedoresPage } from './pages/proveedores/ProveedoresPage';
import { ComprasPage } from './pages/compras/ComprasPage';
import { NuevaCompra } from './pages/compras/NuevaCompra';
import { EmpresasPage } from './pages/empresas/EmpresasPage';
import { RecetasPage } from './pages/recetas/RecetasPage';
import { RolesPage } from './pages/roles/RolesPage';
import { SucursalesPage } from './pages/sucursales/SucursalesPage';
import { CajasPage } from './pages/cajas/CajasPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <PageLoader />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Clientes */}
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/clientes/nuevo" element={<ClienteForm />} />
        <Route path="/clientes/:id/editar" element={<ClienteForm />} />
        <Route path="/clientes/:id" element={<ClienteDetalle />} />

        {/* Productos */}
        <Route path="/productos" element={<ProductosPage />} />
        <Route path="/productos/nuevo" element={<ProductoForm />} />
        <Route path="/productos/:id/editar" element={<ProductoForm />} />

        {/* Menús del comedor + portal de módulos */}
        <Route path="/menus" element={<MenusPage />} />
        <Route path="/menus/portal" element={<PortalModulosPage />} />
        <Route path="/menus/nuevo" element={<MenuForm />} />
        <Route path="/menus/:id(\\d+)/editar" element={<MenuForm />} />
        <Route path="/menus/:id(\\d+)" element={<MenuDetalle />} />

        {/* Reservas */}
        <Route path="/reservas" element={<ReservasPage />} />
        <Route path="/reservas/:id" element={<ReservaDetalle />} />

        {/* Ventas */}
        <Route path="/ventas" element={<VentasPage />} />
        <Route path="/ventas/nueva" element={<NuevaVenta />} />
        <Route path="/ventas/:id" element={<VentaDetalle />} />

        {/* Libretas */}
        <Route path="/libretas" element={<LibretasPage />} />
        <Route path="/libretas/:id" element={<LibretaDetalle />} />

        {/* Stock */}
        <Route path="/stock" element={<StockPage />} />
        <Route path="/stock/entrada" element={<EntradaMercaderia />} />
        <Route path="/stock/kardex/:productoId" element={<KardexPage />} />

        {/* Recetas */}
        <Route path="/recetas" element={<RecetasPage />} />
        <Route path="/recetas/nueva" element={<RecetaForm />} />
        <Route path="/recetas/:id/editar" element={<RecetaForm />} />

        {/* Cocina */}
        <Route path="/cocina" element={<CocinaPage />} />

        {/* Reportes */}
        <Route path="/reportes" element={<ReportesDashboard />} />
        <Route path="/reportes/ventas" element={<ReporteVentas />} />
        <Route path="/reportes/stock" element={<ReporteStock />} />
        <Route path="/reportes/libretas" element={<ReporteLibreta />} />
        <Route path="/reportes/prediccion" element={<ReportePrediccion />} />
        <Route path="/reportes/rentabilidad" element={<ReporteRentabilidad />} />
        <Route path="/reportes/desperdicio" element={<ReporteDesperdicio />} />

        {/* Empresas */}
        <Route path="/empresas" element={<EmpresasPage />} />
        <Route path="/empresas/:id" element={<EmpresaDetalle />} />

        {/* Notificaciones */}
        <Route path="/notificaciones" element={<NotificacionesPage />} />

        {/* Pagos */}
        <Route path="/pagos/conciliacion" element={<ConciliacionPage />} />
        <Route path="/pagos/manuales" element={<PagosManualesPage />} />

        {/* Facturación */}
        <Route path="/facturas" element={<FacturasPage />} />
        <Route path="/configuracion/tributaria" element={<ConfiguracionTributaria />} />

        {/* Proveedores */}
        <Route path="/proveedores" element={<ProveedoresPage />} />

        {/* Compras */}
        <Route path="/compras" element={<ComprasPage />} />
        <Route path="/compras/nueva" element={<NuevaCompra />} />

        {/* Empresas */}
        <Route path="/empresas" element={<EmpresasPage />} />

        {/* Recetas */}
        <Route path="/recetas" element={<RecetasPage />} />

        {/* Admin */}
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/sucursales" element={<SucursalesPage />} />
        <Route path="/cajas" element={<CajasPage />} />
        <Route path="/auditoria" element={<AuditoriaPage />} />
        <Route path="/integraciones" element={<IntegracionesPage />} />
        <Route path="/configuracion" element={<ConfiguracionPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
