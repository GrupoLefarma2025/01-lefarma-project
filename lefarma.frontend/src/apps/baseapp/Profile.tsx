/**
 * Página de perfil mínima para el shell del base-app raíz (spec base-app:
 * "Profile Page"). Superficie de placeholder que renderiza para cualquier
 * usuario autenticado. Ahora aloja la sección de subida de firma digital.
 *
 * Renderizada dentro de MainLayout (config del shell), así el chrome del shell
 * se mantiene presente alrededor. NO asume contexto empresa/sucursal/area
 * (spec base-app: "No Global Context Assumption").
 */
import { FirmaUploadCard } from '@/components/common/FirmaUploadCard';

export function Profile() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
      <FirmaUploadCard />
      <p className="text-sm text-muted-foreground">
        Gestiona tu firma digital. Más opciones de perfil se integrarán en cambios posteriores.
      </p>
    </div>
  );
}
