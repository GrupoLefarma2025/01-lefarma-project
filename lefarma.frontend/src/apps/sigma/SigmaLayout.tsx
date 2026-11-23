import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import './sigma-theme.css';

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
