import type { ReactNode } from "react";
import { usePermissions } from "@/apps/sigma/lib/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission: string;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredPermission, 
  fallback,
  redirectTo = "/SIGMA/home"
}: ProtectedRouteProps) {
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  if (!hasPermission(requiredPermission)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl">Acceso Denegado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              No tienes los permisos necesarios para acceder a esta página.
            </p>
            <p className="text-sm text-muted-foreground">
              Permiso requerido: <code className="bg-muted px-1 py-0.5 rounded text-xs">{requiredPermission}</code>
            </p>
            <Button 
              onClick={() => navigate(redirectTo)} 
              className="w-full"
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

// Componente para proteger elementos individuales del UI
interface ProtectedElementProps {
  children: ReactNode;
  requiredPermission?: string;
  fallback?: ReactNode;
  showFallback?: boolean;
}

export function ProtectedElement({ 
  children, 
  requiredPermission, 
  fallback = null,
  showFallback = false
}: ProtectedElementProps) {
  const { hasPermission } = usePermissions();

  if (!requiredPermission || !hasPermission(requiredPermission)) {
    return showFallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}