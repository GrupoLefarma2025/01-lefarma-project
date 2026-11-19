using System.Security.Claims;

namespace Lefarma.API.Features.Sigma;

/// <summary>
/// Resuelve el actor de la petición: usuario de Active Directory autenticado por JWT
/// (claims Name = SamAccountName, domain = Dominio, NameIdentifier = IdUsuario) o,
/// si no hay JWT, visitante externo con la cabecera <c>X-Sigma-Visitor</c>.
/// </summary>
public sealed class SigmaIdentity
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly SigmaVisitorTokenService _visitorTokens;

    public SigmaIdentity(IHttpContextAccessor httpContextAccessor, SigmaVisitorTokenService visitorTokens)
    {
        _httpContextAccessor = httpContextAccessor;
        _visitorTokens = visitorTokens;
    }

    /// <summary>Devuelve el actor de la petición o null si no hay identidad válida.</summary>
    public SigmaActor? Resolve()
    {
        var context = _httpContextAccessor.HttpContext;
        if (context is null)
        {
            return null;
        }

        var principal = context.User;
        if (principal?.Identity?.IsAuthenticated == true)
        {
            var samAccountName = principal.FindFirst(ClaimTypes.Name)?.Value ?? principal.Identity.Name;
            var dominio = principal.FindFirst("domain")?.Value;

            if (string.IsNullOrWhiteSpace(samAccountName) || string.IsNullOrWhiteSpace(dominio))
            {
                return null;
            }

            int? idUsuario = int.TryParse(principal.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id)
                ? id
                : null;

            return new SigmaActor(idUsuario, $"{samAccountName}@{dominio}", false, samAccountName);
        }

        var ticket = context.Request.Headers[SigmaVisitorTokenService.HeaderName].FirstOrDefault();
        return _visitorTokens.TryValidate(ticket, out var visitante)
            ? new SigmaActor(visitante.IdUsuario, visitante.Correo, true, visitante.Nombre)
            : null;
    }
}
