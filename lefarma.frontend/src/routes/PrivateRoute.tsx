import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';


/**
 * Componente para proteger rutas que requieren autenticación
 */
export const PrivateRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Si no está autenticado, redirigir al login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si está autenticado, renderizar las rutas hijas
  return <Outlet />;
};
