using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface IPersonasService
{
    Task<List<EjecutivoRegionDto>> GetEjecutivosAsync(
        string? busqueda,
        int? idTipoGerencia,
        bool? soloActivos,
        CancellationToken ct = default);

    Task<EjecutivoRegionDto> CrearEjecutivoAsync(
        CrearEjecutivoRegionRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<EjecutivoRegionDto?> ActualizarEjecutivoAsync(
        int idEjecutivoRegion,
        ActualizarEjecutivoRegionRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<List<EjecutivoSuplenteDto>> GetEjecutivosSuplentesAsync(
        string? busqueda,
        int? idTipoGerencia,
        bool? soloActivos,
        CancellationToken ct = default);

    Task<EjecutivoSuplenteDto> CrearEjecutivoSuplenteAsync(
        CrearEjecutivoSuplenteRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<EjecutivoSuplenteDto?> ActualizarEjecutivoSuplenteAsync(
        int idEjecutivoSuplente,
        ActualizarEjecutivoSuplenteRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<List<EspecialistaDto>> GetEspecialistasAsync(
        string? busqueda,
        bool? soloActivos,
        CancellationToken ct = default);

    Task<EspecialistaDto> GuardarEspecialistaAsync(
        GuardarEspecialistaRequest request,
        int idUsuario,
        CancellationToken ct = default);
}
