using ErrorOr;
using Lefarma.API.Features.Configuracion.DTOs;

namespace Lefarma.API.Features.Configuracion;

/// <summary>Administración de clientes de integración (API keys).</summary>
public interface IConfiguracionIntegracionesService
{
    Task<ErrorOr<List<IntegracionClienteResponse>>> ListarAsync(CancellationToken ct = default);

    Task<ErrorOr<IntegracionCreadaResponse>> CrearAsync(
        CrearIntegracionRequest request,
        CancellationToken ct = default);

    Task<ErrorOr<IntegracionClienteResponse>> RevocarAsync(int id, CancellationToken ct = default);

    /// <summary>Consulta externa de una variable autenticada por API key.</summary>
    Task<ErrorOr<IntegracionVariableResponse>> ObtenerVariableAsync(
        string? apiKey,
        string clave,
        CancellationToken ct = default);

    /// <summary>Consulta externa por lote autenticada por API key.</summary>
    Task<ErrorOr<IntegracionBatchResponse>> ConsultarVariablesAsync(
        string? apiKey,
        IntegracionConsultarRequest request,
        CancellationToken ct = default);
}
