import { Loader2 } from 'lucide-react';

/**
 * Spinner de pantalla completa para el arranque de la SPA: se muestra
 * mientras el authStore hidrata la sesión desde `localStorage` y, por tanto,
 * todavía no se puede decidir si una ruta está permitida.
 */
export function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
