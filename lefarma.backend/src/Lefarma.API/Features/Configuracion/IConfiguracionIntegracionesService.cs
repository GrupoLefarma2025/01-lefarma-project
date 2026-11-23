using ErrorOr;
using Lefarma.API.Features.Configuracion.DTOs;

namespace Lefarma.API.Features.Configuracion;

public interface IConfiguracionIntegracionesService
{
    Task<ErrorOr<List<IntegracionClienteResponse>>> ListarAsync(CancellationToken ct = default);

    Task<ErrorOr<IntegracionCreadaResponse>> CrearAsync(
        CrearIntegracionRequest request,
        CancellationToken ct = default);

    Task<ErrorOr<IntegracionClienteResponse>> RevocarAsync(int id, CancellationToken ct = default);

    Task<ErrorOr<IntegracionVariableResponse>> ObtenerVariableAsync(
        string? apiKey,
        string clave,
        CancellationToken ct = default);

    Task<ErrorOr<IntegracionBatchResponse>> ConsultarVariablesAsync(
        string? apiKey,
        IntegracionConsultarRequest request,
        CancellationToken ct = default);
}
