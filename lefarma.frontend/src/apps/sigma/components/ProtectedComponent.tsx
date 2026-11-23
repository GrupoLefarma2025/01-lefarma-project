import type { ReactNode } from "react";
import { useSigmaAuth, useSigmaPermission } from "@/apps/sigma/store/sigmaAuth";

interface ProtectedComponentProps {
  children: ReactNode;
  permission?: string;
  fallback?: ReactNode;
  requireAuth?: boolean;
}

export function ProtectedComponent({
  children,
  permission,
  fallback = null,
  requireAuth = true,
}: ProtectedComponentProps) {
  const { isAuthenticated } = useSigmaAuth();
  const hasPermission = useSigmaPermission();

  if (requireAuth && !isAuthenticated) {
    return <>{fallback}</>;
  }

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

