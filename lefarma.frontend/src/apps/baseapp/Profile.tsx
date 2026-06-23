/**
 * Página de perfil mínima para el shell del base-app raíz (spec base-app:
 * "Profile Page"). Superficie de placeholder que renderiza para cualquier
 * usuario autenticado.
 *
 * Renderizada dentro de MainLayout (config del shell), así el chrome del shell
 * se mantiene presente alrededor. NO asume contexto empresa/sucursal/area
 * (spec base-app: "No Global Context Assumption").
 */
export function Profile() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
      <p className="text-sm text-muted-foreground">
        Esta es la página de perfil del shell. La información detallada del usuario
        se integrará en cambios posteriores.
      </p>
    </div>
  );
}
