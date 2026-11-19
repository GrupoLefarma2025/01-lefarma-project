import type { ReactNode } from "react";
import { useSigmaAuth, useSigmaPermission } from "@/apps/sigma/store/sigmaAuth";

interface ProtectedComponentProps {
  children: ReactNode;
  permission?: string;
  fallback?: ReactNode;
  requireAuth?: boolean;
}

/**
 * Componente para proteger contenido basado en permisos o autenticación
 *
 * @example
 * // Requiere autenticación
 * <ProtectedComponent requireAuth>
 *   <div>Contenido solo para usuarios autenticados</div>
 * </ProtectedComponent>
 *
 * @example
 * // Requiere permiso específico
 * <ProtectedComponent permission="usuarios.ver_perfiles_completos">
 *   <div>Contenido solo para usuarios con el permiso</div>
 * </ProtectedComponent>
 *
 * @example
 * // Con fallback personalizado
 * <ProtectedComponent
 *   permission="nomina.ver_todas"
 *   fallback={<div>No tienes permiso para ver la nómina</div>}
 * >
 *   <div>Contenido de nómina</div>
 * </ProtectedComponent>
 */
export function ProtectedComponent({
  children,
  permission,
  fallback = null,
  requireAuth = true,
}: ProtectedComponentProps) {
  const { isAuthenticated } = useSigmaAuth();
  const hasPermission = useSigmaPermission();

  // Si requiere autenticación y no está autenticado
  if (requireAuth && !isAuthenticated) {
    return <>{fallback}</>;
  }

  // Si requiere un permiso específico y no lo tiene
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Si pasa todas las validaciones, mostrar el contenido
  return <>{children}</>;
}

