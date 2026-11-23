using ErrorOr;
using Lefarma.API.Features.Configuracion.DTOs;

namespace Lefarma.API.Features.Configuracion;

public interface IConfiguracionModulosService
{
    Task<ErrorOr<List<ConfigModuloResponse>>> ListarAsync(
        bool? activo,
        CancellationToken ct = default);

    Task<ErrorOr<ConfigModuloResponse>> CrearAsync(
        CreateConfigModuloRequest request,
        int? idUsuario,
        CancellationToken ct = default);

    Task<ErrorOr<ConfigModuloResponse>> ActualizarAsync(
        long id,
        UpdateConfigModuloRequest request,
        int? idUsuario,
        CancellationToken ct = default);

    Task<ErrorOr<ConfigModuloResponse>> DesactivarAsync(
        long id,
        int? idUsuario,
        CancellationToken ct = default);

    Task<ErrorOr<ConfigModuloResponse>> ReactivarAsync(
        long id,
        int? idUsuario,
        CancellationToken ct = default);
}
