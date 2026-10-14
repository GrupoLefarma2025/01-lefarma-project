using System.Security.Claims;

namespace Lefarma.API.Shared.Authorization;

/// <summary>
/// Helpers reutilizables para que los controllers lean la identidad y los
/// permisos del solicitante desde <see cref="ClaimsPrincipal"/>.
///
/// Permisos: el handler de JWT emite claims de tipo <c>permission</c>
/// (uno por codigo en app.Permisos). El nombre del tipo coincide con el
/// patron historico de AprobacionesController y se conserva aqui como
/// contrato compartido.
/// </summary>
public static class ClaimsPrincipalExtensions
{
    private const string PermissionClaimType = "permission";

    /// <summary>
    /// Devuelve true si el principal tiene un claim <c>permission</c> con
    /// el codigo indicado. Coincide con el patron historico del modulo
    /// Educacion Medica (AprobacionesController.TienePermiso).
    /// </summary>
    public static bool TienePermiso(this ClaimsPrincipal principal, string permiso)
    {
        if (principal is null || string.IsNullOrEmpty(permiso))
        {
            return false;
        }

        return principal.Claims.Any(c => c.Type == PermissionClaimType && c.Value == permiso);
    }

    /// <summary>
    /// Lee el id de usuario del claim NameIdentifier (estandar
    /// ClaimTypes.NameIdentifier) emitido por el JWT. Devuelve 0 si el
    /// claim falta o no es un entero valido.
    /// </summary>
    public static int GetUserId(this ClaimsPrincipal principal)
    {
        if (principal is null)
        {
            return 0;
        }

        return int.TryParse(principal.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
    }
}