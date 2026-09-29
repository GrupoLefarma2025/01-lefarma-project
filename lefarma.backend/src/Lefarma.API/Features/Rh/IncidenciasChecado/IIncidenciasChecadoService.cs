using ErrorOr;
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Shared.Models;

namespace Lefarma.API.Features.Rh.IncidenciasChecado;

public interface IIncidenciasChecadoService
{
    Task<ErrorOr<List<IncidenciaChecadoResponse>>> GetMisIncidenciasAsync(
        IncidenciasChecadoRequest request,
        int idUsuario,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<PagedResult<IncidenciaChecadoResponse>>> GetAllAsync(
        IncidenciasChecadoConsultaRequest request,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<List<IncidenciaChecadoResponse>>> GetIncidenciasPorEmpleadoAsync(
        long nomina,
        DateTime fechaInicio,
        DateTime fechaFin,
        int limite,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<PagedResult<IncidenciasChecadoResumenEmpleadoResponse>>> GetResumenPorEmpleadoAsync(
        IncidenciasChecadoResumenEmpleadoRequest request,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<ReglasDescuentoResponse>> GetReglasDescuentoAsync(
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Indica si el empleado del usuario tiene el checado deshabilitado (Checa = "No").
    /// En ese caso nunca verá incidencias; el frontend lo usa para explicarlo.
    /// </summary>
    Task<ErrorOr<bool>> TieneChecaDeshabilitadaAsync(
        int idUsuario,
        CancellationToken cancellationToken = default);
}
