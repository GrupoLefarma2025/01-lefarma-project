using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface IAsignadorEspecialistasService
{
    Task<bool> AsignarEspecialistaAsync(
        int idRutaVisita,
        AsignarEspecialistaVisitaRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<List<SugerenciaEspecialistaDto>> GetSugerenciasAsync(
        int idSeleccionMensual,
        DateOnly? desde,
        DateOnly? hasta,
        CancellationToken ct = default);
}
