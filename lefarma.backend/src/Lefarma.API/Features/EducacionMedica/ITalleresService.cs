using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface ITalleresService
{
    /// <summary>Equipo del usuario, su matriz individual del periodo y los talleres capturados.</summary>
    Task<MisTalleresResponse> GetMisTalleresAsync(int idUsuario, string? periodo, CancellationToken ct = default);

    /// <summary>Captura un taller (FOR-005); hace get-or-create de la matriz individual y de la general.</summary>
    Task<TallerDto> CrearAsync(CrearTallerRequest request, int idUsuario, CancellationToken ct = default);

    Task<TallerDto> ActualizarAsync(int idTaller, ActualizarTallerRequest request, int idUsuario, CancellationToken ct = default);
    Task EliminarAsync(int idTaller, int idUsuario, CancellationToken ct = default);

    /// <summary>Genera (bloquea) la matriz individual del equipo.</summary>
    Task<MatrizIndividualDto> GenerarMatrizIndividualAsync(int idMatrizIndividual, int idUsuario, CancellationToken ct = default);

    /// <summary>Reabre la captura de una matriz individual generada (solo GV participante, general en CREADA).</summary>
    Task<MatrizIndividualDto> ReabrirMatrizIndividualAsync(int idMatrizIndividual, int idUsuario, CancellationToken ct = default);
}
