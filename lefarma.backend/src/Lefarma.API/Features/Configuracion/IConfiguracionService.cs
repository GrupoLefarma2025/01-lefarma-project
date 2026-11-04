using ErrorOr;
using Lefarma.API.Features.Configuracion.DTOs;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Administración de variables globales de configuración (CRUD, bitácora y restauración).
/// </summary>
public interface IConfiguracionService
{
    Task<ErrorOr<List<ConfigVariableResponse>>> ListarAsync(
        ConfiguracionFiltros filtros,
        CancellationToken ct = default);

    Task<ErrorOr<ConfigVariableResponse>> ObtenerAsync(
        long id,
        CancellationToken ct = default);

    Task<ErrorOr<ConfigVariableResponse>> CrearAsync(
        CreateConfigVariableRequest request,
        int? idUsuario,
        CancellationToken ct = default);

    Task<ErrorOr<ConfigVariableResponse>> ActualizarAsync(
        long id,
        UpdateConfigVariableRequest request,
        int? idUsuario,
        CancellationToken ct = default);

    Task<ErrorOr<ConfigVariableResponse>> DesactivarAsync(
        long id,
        CambiarEstadoVariableRequest request,
        int? idUsuario,
        CancellationToken ct = default);

    Task<ErrorOr<ConfigVariableResponse>> ReactivarAsync(
        long id,
        CambiarEstadoVariableRequest request,
        int? idUsuario,
        CancellationToken ct = default);

    Task<ErrorOr<List<BitacoraResumenResponse>>> ObtenerHistorialAsync(
        long id,
        CancellationToken ct = default);

    Task<ErrorOr<BitacoraDetalleResponse>> ObtenerHistorialDetalleAsync(
        long id,
        long idBitacora,
        CancellationToken ct = default);

    Task<ErrorOr<ConfigVariableResponse>> RestaurarAsync(
        long id,
        RestaurarVariableRequest request,
        int? idUsuario,
        CancellationToken ct = default);

    Task<ErrorOr<FrontendSyncResponse>> ConsultarFrontendAsync(
        FrontendConsultarRequest request,
        CancellationToken ct = default);

    Task<ErrorOr<FrontendSyncResponse>> SincronizarFrontendAsync(
        FrontendSyncRequest request,
        CancellationToken ct = default);
}
