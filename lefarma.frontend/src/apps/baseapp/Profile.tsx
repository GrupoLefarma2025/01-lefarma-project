/**
 * Minimal profile page for the root base-app shell (base-app spec:
 * "Profile Page"). Placeholder surface that renders for any authenticated user.
 *
 * Rendered inside ShellLayout, so the shell chrome stays present around it.
 * Does NOT assume empresa/sucursal/area context (base-app spec: "No Global
 * Context Assumption").
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
