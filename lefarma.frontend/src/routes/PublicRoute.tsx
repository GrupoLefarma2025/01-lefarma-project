import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';


/**
 * Componente para rutas públicas (solo accesibles sin autenticación)
 * Si el usuario ya está autenticado, redirige al dashboard
 */
export const PublicRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Si ya está autenticado, redirigir al dashboard
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Si no está autenticado, renderizar las rutas hijas
  return <Outlet />;
};
