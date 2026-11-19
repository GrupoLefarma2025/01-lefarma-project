namespace Lefarma.API.Features.Sigma;

/// <summary>
/// Códigos de permiso del módulo Documentos. Subir y Eliminar ya viven en
/// <see cref="Lefarma.API.Shared.Constants.Permissions.Documentos"/>; aquí se declaran los que
/// SIGMA usaba como literales para el dashboard y la bandeja.
/// </summary>
public static class SigmaPermissions
{
    public const string Aprobar = "documentos.aprobar";
    public const string BandejaVerTodos = "documentos.bandeja.ver.todos";
}
