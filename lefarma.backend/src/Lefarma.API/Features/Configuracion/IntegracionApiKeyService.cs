using ErrorOr;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Valida la API key contra config.integraciones: activa, no expirada y con hash correcto.
/// Actualiza la última utilización cuando la autenticación es exitosa.
/// </summary>
public class IntegracionApiKeyService : IIntegracionApiKeyService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<IntegracionApiKeyService> _logger;

    public IntegracionApiKeyService(
        ApplicationDbContext context,
        ILogger<IntegracionApiKeyService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ErrorOr<IntegracionAutenticada>> AutenticarAsync(
        string? apiKey,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Error.Unauthorized(
                "Integracion.ApiKeyRequerida",
                "El encabezado X-API-Key es obligatorio.");
        }

        var llave = apiKey.Trim();

        if (!llave.StartsWith(IntegracionLlaves.Prefijo, StringComparison.Ordinal))
        {
            return ApiKeyInvalida();
        }

        var hashCalculado = IntegracionLlaves.CalcularHash(llave);

        var integracion = await _context.ConfigIntegraciones
            .FirstOrDefaultAsync(i => i.HashLlave == hashCalculado, ct);

        if (integracion is null)
        {
            _logger.LogWarning("Intento de integración con una API key desconocida (prefijo {Prefijo})",
                IntegracionLlaves.ObtenerPrefijoVisible(llave));
            return ApiKeyInvalida();
        }

        if (!IntegracionLlaves.HashesIguales(integracion.HashLlave, hashCalculado))
        {
            return ApiKeyInvalida();
        }

        if (!integracion.Activo)
        {
            return Error.Unauthorized(
                "Integracion.ApiKeyRevocada",
                "La API key fue revocada.");
        }

        if (integracion.FechaExpiracion.HasValue && integracion.FechaExpiracion.Value <= DateTime.UtcNow)
        {
            return Error.Unauthorized(
                "Integracion.ApiKeyExpirada",
                "La API key expiró.");
        }

        integracion.UltimaUtilizacion = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        return new IntegracionAutenticada(
            integracion.IdIntegracion,
            integracion.Nombre,
            IntegracionLlaves.DeserializarClaves(integracion.ClavesPermitidasJson));
    }

    private static Error ApiKeyInvalida()
        => Error.Unauthorized("Integracion.ApiKeyInvalida", "La API key no es válida.");
}
