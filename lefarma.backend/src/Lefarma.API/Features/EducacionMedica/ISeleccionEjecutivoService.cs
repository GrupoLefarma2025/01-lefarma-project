using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface ISeleccionEjecutivoService
{
    Task<SeleccionRegionDto?> AsignarEjecutivoAsync(
        int idSeleccionMensual,
        int idRegion,
        AsignarEjecutivoRegionRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<SeleccionHospitalDto?> AsignarEjecutivoHospitalAsync(
        int idSeleccionMensual,
        int idSeleccionHospital,
        AsignarEjecutivoHospitalRequest request,
        int idUsuario,
        CancellationToken ct = default);
}
