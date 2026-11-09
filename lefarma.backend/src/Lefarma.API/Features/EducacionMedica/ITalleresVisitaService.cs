using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface ITalleresVisitaService
{
    Task<TallerDto> CrearAsync(CrearTallerRequest request, int idUsuario, CancellationToken ct = default);
}
