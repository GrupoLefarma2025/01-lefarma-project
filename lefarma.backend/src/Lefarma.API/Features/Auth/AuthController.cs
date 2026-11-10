using Lefarma.API.Features.Auth.DTOs;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Auth;
/// <summary>
/// Controller for authentication operations including two-step login flow.
/// </summary>
[Route("api/auth")]
[ApiController]
[EndpointGroupName("Auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ISseService _sseService;
    private readonly ISseTicketService _sseTicketService;

    public AuthController(
        IAuthService authService,
        ISseService sseService,
        ISseTicketService sseTicketService)
    {
        _authService = authService;
        _sseService = sseService;
        _sseTicketService = sseTicketService;
    }

    /// <summary>
    /// Step 1: Find user in Active Directory and get available domains.
    /// </summary>
    /// <param name="request">The login step one request containing username.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Available domains for the user.</returns>
    [AllowAnonymous]
    [HttpPost("login-step-one")]
    [SwaggerOperation(
        Summary = "Paso 1: Buscar dominios del usuario",
        Description = "Busca el usuario en el Directorio Activo y retorna los dominios disponibles donde existe el usuario.")]
    [SwaggerResponse(200, "Dominios encontrados exitosamente", typeof(ApiResponse<LoginStepOneResponse>))]
    [SwaggerResponse(400, "Datos de entrada invalidos", typeof(ApiResponse<object>))]
    [SwaggerResponse(404, "Usuario no encontrado", typeof(ApiResponse<object>))]
    public async Task<IActionResult> LoginStepOne(
        [SwaggerRequestBody(Description = "Datos del paso 1 del login", Required = true)]
        LoginStepOneRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _authService.LoginStepOneAsync(request, cancellationToken);

        return result.ToActionResult(this, data => Ok(new ApiResponse<LoginStepOneResponse>
        {
            Success = true,
            Message = data.RequiresDomainSelection
                ? "Usuario encontrado en multiples dominios. Seleccione un dominio."
                : "Usuario encontrado exitosamente.",
            Data = data
        }));
    }

    /// <summary>
    /// Step 2: Authenticate user with credentials and create session.
    /// </summary>
    /// <param name="request">The login step two request with credentials and domain.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Login response with tokens and user info.</returns>
    [AllowAnonymous]
    [HttpPost("login-step-two")]
    [SwaggerOperation(
        Summary = "Paso 2: Autenticar usuario",
        Description = "Valida las credenciales del usuario contra LDAP, crea la sesion y genera los tokens de acceso.")]
    [SwaggerResponse(200, "Autenticacion exitosa", typeof(ApiResponse<LoginResponse>))]
    [SwaggerResponse(400, "Credenciales invalidas", typeof(ApiResponse<object>))]
    [SwaggerResponse(401, "No autorizado", typeof(ApiResponse<object>))]
    public async Task<IActionResult> LoginStepTwo(
        [SwaggerRequestBody(Description = "Datos del paso 2 del login", Required = true)]
        LoginStepTwoRequest request,
        CancellationToken cancellationToken)
    {
        var ipAddress = GetClientIpAddress();
        var userAgent = Request.Headers.UserAgent.ToString();

        var result = await _authService.LoginStepTwoAsync(request, ipAddress, userAgent, cancellationToken);

        return result.ToActionResult(this, data => Ok(new ApiResponse<LoginResponse>
        {
            Success = true,
            Message = "Autenticacion exitosa.",
            Data = data
        }));
    }

    /// <summary>
    /// Refresh access token using refresh token.
    /// </summary>
    /// <param name="request">The refresh token request.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>New login response with fresh tokens.</returns>
    [AllowAnonymous]
    [HttpPost("refresh")]
    [SwaggerOperation(
        Summary = "Refrescar token de acceso",
        Description = "Genera un nuevo token de acceso utilizando un refresh token valido.")]
    [SwaggerResponse(200, "Token refrescado exitosamente", typeof(ApiResponse<LoginResponse>))]
    [SwaggerResponse(400, "Refresh token invalido", typeof(ApiResponse<object>))]
    public async Task<IActionResult> RefreshToken(
        [SwaggerRequestBody(Description = "Refresh token", Required = true)]
        RefreshTokenRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _authService.RefreshTokenAsync(request, cancellationToken);

        return result.ToActionResult(this, data => Ok(new ApiResponse<LoginResponse>
        {
            Success = true,
            Message = "Token refrescado exitosamente.",
            Data = data
        }));
    }

    /// <summary>
    /// Logout user by revoking tokens.
    /// </summary>
    /// <param name="request">Optional logout request with refresh token.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Logout response.</returns>
    [AllowAnonymous]
    [HttpPost("logout")]
    [SwaggerOperation(
        Summary = "Cerrar sesion",
        Description = "Revoca los tokens del usuario y cierra la sesion activa.")]
    [SwaggerResponse(200, "Sesion cerrada exitosamente", typeof(ApiResponse<LogoutResponse>))]
    public async Task<IActionResult> Logout(
        [SwaggerRequestBody(Description = "Datos del logout (opcional)")]
        LogoutRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await _authService.LogoutAsync(request?.RefreshToken, null, cancellationToken);

        return result.ToActionResult(this, data => Ok(new ApiResponse<LogoutResponse>
        {
            Success = true,
            Message = data.Message,
            Data = data
        }));
    }

/// <summary>
    /// Genera un ticket de corta duración para establecer la conexión SSE.
    /// Evita enviar el JWT completo en la URL del EventSource.
    /// </summary>
    [Authorize]
    [HttpPost("sse-ticket")]
    [SwaggerOperation(
        Summary = "SSE: generar ticket de conexion",
        Description = "Genera un ticket de un solo uso para abrir el canal Server-Sent Events sin exponer el token en la URL.")]
    [SwaggerResponse(200, "Ticket generado")]
    [SwaggerResponse(401, "No autenticado")]
    public IActionResult CreateSseTicket()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized(new { error = "Identidad de usuario inválida." });
        }

        var ticket = _sseTicketService.GenerateTicket(userId);
        return Ok(new { ticket, expiresInSeconds = 300 });
    }

    /// <summary>
    /// SSE endpoint for real-time user synchronization.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("sse")]
    [SwaggerOperation(
        Summary = "SSE: Sincronizacion en tiempo real",
        Description = "Establece una conexion Server-Sent Events. Acepta un ticket de un solo uso o un JWT valido en el encabezado Authorization.")]
    [SwaggerResponse(200, "Conexion SSE establecida")]
    [SwaggerResponse(401, "Ticket invalido, expirado o sin autenticacion")]
    public async Task SseConnect([FromQuery] string? ticket, CancellationToken cancellationToken)
    {
        int userId;

        // Si ya viene un JWT valido (por ejemplo, una prueba con curl), se usa.
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        if (userIdClaim != null && int.TryParse(userIdClaim.Value, out var authenticatedUserId))
        {
            userId = authenticatedUserId;
        }
        else if (!string.IsNullOrWhiteSpace(ticket)
                 && _sseTicketService.ValidateAndConsumeTicket(ticket) is int ticketUserId)
        {
            userId = ticketUserId;
        }
        else
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        Response.ContentType = "text/event-stream";
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");
        Response.Headers.Append("X-Accel-Buffering", "no");

        await _sseService.RegisterConnectionAsync(userId, Response, cancellationToken);
    }

    private string? GetClientIpAddress()
    {
        // Check for forwarded headers first (when behind proxy/load balancer)
        var forwardedFor = Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            // Take the first IP in the chain (original client)
            var ip = forwardedFor.Split(',').FirstOrDefault()?.Trim();
            if (!string.IsNullOrEmpty(ip))
            {
                return ip;
            }
        }

        // Check X-Real-IP header
        var realIp = Request.Headers["X-Real-IP"].FirstOrDefault();
        if (!string.IsNullOrEmpty(realIp))
        {
            return realIp;
        }

        // Fall back to connection remote IP
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }
}
