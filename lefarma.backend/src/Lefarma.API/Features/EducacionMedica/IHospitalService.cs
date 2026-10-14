using Lefarma.API.Shared.Models;

namespace Lefarma.API.Features.EducacionMedica;

public interface IHospitalService
{
    Task<PagedResult<DTOs.HospitalDto>> GetHospitalesAsync(
        Domain.Interfaces.EducacionMedica.HospitalFilterParams? filter = null,
        CancellationToken ct = default);
    Task<DTOs.HospitalDto?> GetHospitalByIdAsync(int idHospital, CancellationToken ct = default);
    Task<DTOs.HospitalExtensionDto> UpsertExtensionAsync(
        int idHospital,
        DTOs.UpsertHospitalExtensionRequest request,
        int idUsuario,
        CancellationToken ct = default);
    Task<List<DTOs.HospitalUbicacionDto>> GetUbicacionesAsync(
        Domain.Interfaces.EducacionMedica.HospitalFilterParams? filter = null,
        CancellationToken ct = default);

    /// <summary>
    /// Crea las extensiones faltantes de los hospitales del catálogo (activos, sin
    /// Privado/Distribuidor). Las extensiones existentes NO se modifican.
    /// </summary>
    Task<DTOs.SincronizarHospitalesResponse> SincronizarExtensionesAsync(
        int idUsuario,
        CancellationToken ct = default);

    Task<int> RecalcularAnestesiasAsync(int anio, CancellationToken ct = default);
}
