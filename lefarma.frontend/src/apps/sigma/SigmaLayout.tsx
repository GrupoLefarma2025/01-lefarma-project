import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import './sigma-theme.css';

/**
 * Marco visual de SIGMA.
 *
 * Aísla la paleta del módulo bajo la clase `.sigma-theme` (ver
 * `sigma-theme.css`) y sirve como layout-route: las páginas protegidas se
 * renderizan en el `<Outlet />`. También acepta `children` para poder usarse
 * como wrapper directo fuera del router.
 *
 * NO monta sidebar propio a propósito: cada página de SIGMA monta el suyo.
 */
export interface SigmaLayoutProps {
  children?: ReactNode;
}

export function SigmaLayout({ children }: SigmaLayoutProps) {
  return (
    <div className="sigma-theme min-h-screen text-foreground">
      {children ?? <Outlet />}
    </div>
  );
}

export default SigmaLayout;
